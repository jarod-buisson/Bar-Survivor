// Harnais de simulation headless — valide l'équilibrage économique en jouant
// des centaines de parties avec des bots, pour plusieurs tailles d'équipe.
//
// Lancer :
//   ./node_modules/.bin/esbuild sim/simulation.ts --bundle --format=esm \
//     --platform=node --outfile=/tmp/bar-sim.mjs && node /tmp/bar-sim.mjs
//
// Deux bots :
// - run(teamTarget) : bot NAÏF, équipe figée, ignore Travaux/machines. C'est un
//   PLANCHER pessimiste, pas une estimation du joueur habile.
// - runHabile() : bot HABILE — fait les Travaux et améliore les machines dès que
//   la trésorerie le permet, adapte sa cible d'embauche à la taille du LOCAL
//   actuel (pas un nombre fixe). Sert à calibrer le taux de victoire "joueur qui
//   joue bien", pas juste "joueur qui ne fait rien".
// Limite commune : événements ignorés (pas de vacances → le bot pose une semaine
// de repos complète quand la fatigue dépasse 70, pour simuler l'effet).
import {
  creerPartie,
  simulerSemaine,
  preparerSemaineSuivante,
  commanderStocks,
  coutCommande,
  menagePro,
  menageEquipe,
  reparerPro,
  embaucherCV,
  agrandirBar,
  ameliorerMachine,
  ameliorationsDebloquees,
  coutTravaux,
  capaciteLocale,
} from "../src/game/engine";
import { CATEGORIES_STOCK } from "../src/game/content";
import { coutAmelioration } from "../src/game/machines";
import type { GameState, StockCategorie } from "../src/game/types";

const MAX_SEMAINES = 120;
const RUNS = 300;
const RESERVE_CAPEX = 6000; // matelas de sécurité gardé APRÈS avoir couvert le coût d'une semaine de chantier

// Constantes dupliquées d'engine.ts (non exportées) pour estimer la taille
// d'équipe qui sature le LOCAL ACTUEL — indépendamment de l'état des machines.
// Sans ça, une cible basée sur capaciteBar() (qui inclut le facteur machines)
// s'emballe : des machines usées font baisser la capacité perçue, le bot
// embauche encore plus au lieu de réparer/améliorer, ce qui use encore plus vite.
const EFF_PATRON_APPROX = 32;
const EFF_SALARIE_APPROX = 10;
const FATIGUE_MOYENNE_APPROX = 0.85; // rendement moyen avec repos tournants
const CHARGES_APPROX = 900; // dupliqué d'engine.ts (CHARGES, non exporté)
function equipeCibleLocal(s: GameState): number {
  const effNecessaire = capaciteLocale(s) / 3 - EFF_PATRON_APPROX;
  const n = Math.round(effNecessaire / (EFF_SALARIE_APPROX * FATIGUE_MOYENNE_APPROX));
  return Math.max(1, n) + 1; // +1 de marge pour les rotations de repos
}
/** Coût connu d'avance d'une semaine de fermeture (Travaux) : salaires + charges +
 *  loyer, TOUJOURS dus même à 0 CA. Sans compter cette dépense certaine, le bot
 *  achetait les Travaux avec un matelas qui semblait suffisant... et se retrouvait
 *  en faillite la semaine même, la fermeture ayant tout aspiré. */
function coutSemaineFermee(s: GameState): number {
  const salaires = s.employes.filter((e) => !e.demissionne).reduce((sum, e) => sum + e.salaire, 0);
  return salaires + CHARGES_APPROX + s.loyer;
}

interface RunResult {
  victoire?: number; // semaine de victoire (dette soldée)
  faillite?: number; // semaine de game over (faillite ou départ d'Antho)
  panierMoyen: number;
  caMoyen: number;
  resultatMoyen: number;
  equipeFinale: number;
  niveauLocalFinal: number;
}

function actifsN(s: GameState): number {
  return s.employes.filter((e) => !e.demissionne).length;
}

function moyenne(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

/** Corvées communes aux deux bots : planning de repos, réassort, ménage, réparations. */
function gererSemaineCourante(s: GameState): void {
  const emps = s.employes.filter((e) => !e.demissionne);
  emps.forEach((e, i) => {
    if (e.vacances) return; // géré par le moteur
    const repos = [false, false, false, false, false, false, false];
    if (e.fatigue >= 70) {
      repos.fill(true); // pseudo-vacances (pas d'événement vacances en sim)
    } else if (emps.length === 1) {
      repos[0] = repos[1] = true; // solo : bar fermé lun-mar (toléré)
    } else if (i % 2 === 0) {
      repos[0] = repos[1] = true;
    } else {
      repos[2] = repos[3] = true;
    }
    e.reposJours = repos;
  });
  // Garde-fou : si tout le monde est en repos complet, le plus frais reprend 5 jours.
  if (emps.length > 0 && emps.every((e) => e.reposJours.every(Boolean))) {
    const frais = emps.reduce((a, b) => (a.fatigue <= b.fatigue ? a : b));
    frais.reposJours = [true, true, false, false, false, false, false];
  }

  // --- Réassort : vise 85, sinon des cibles plus basses, en gardant un matelas ---
  for (const niveau of [85, 70, 55, 40]) {
    const cibles: Partial<Record<StockCategorie, number>> = {};
    for (const c of CATEGORIES_STOCK) cibles[c.id] = Math.max(niveau, Math.ceil(s.stocks[c.id]));
    const cout = coutCommande(s, cibles);
    if (cout <= 0) break; // déjà au niveau
    if (s.budget - cout > 800) {
      commanderStocks(s, cibles);
      break;
    }
  }

  // --- Ménage ---
  if (s.proprete < 65) {
    if (s.budget > 1500) menagePro(s);
    else menageEquipe(s);
  }

  // --- Réparations (toujours, même en chantier) ---
  for (const m of s.machines) {
    if (m.etat === "panne") reparerPro(s, m.id);
  }
}

function run(teamTarget: number): RunResult {
  const s = creerPartie("difficile", "populaire");
  const paniers: number[] = [];
  const cas: number[] = [];
  const resultats: number[] = [];

  for (let w = 1; w <= MAX_SEMAINES; w++) {
    // --- Embauche : compléter l'équipe via les CV reçus, cible FIGÉE ---
    for (const cv of [...s.cvRecus]) {
      if (actifsN(s) >= teamTarget) break;
      embaucherCV(s, cv.profil.id);
    }

    gererSemaineCourante(s);
    simulerSemaine(s);
    const b = s.dernierBilan!;
    resultats.push(b.resultat);
    cas.push(b.chiffreAffaires);
    for (const j of b.jours) if (!j.ferme && j.clients > 0) paniers.push(j.panier);

    const bilan = {
      panierMoyen: moyenne(paniers),
      caMoyen: moyenne(cas),
      resultatMoyen: moyenne(resultats),
      equipeFinale: actifsN(s),
      niveauLocalFinal: s.niveauLocal,
    };
    if (s.phase === "gameover") return { faillite: w, ...bilan };
    if (s.semaineVictoire !== undefined) return { victoire: w, ...bilan };
    preparerSemaineSuivante(s);
    if (s.phase === "gameover") return { faillite: w, ...bilan };
  }
  return {
    panierMoyen: moyenne(paniers),
    caMoyen: moyenne(cas),
    resultatMoyen: moyenne(resultats),
    equipeFinale: actifsN(s),
    niveauLocalFinal: s.niveauLocal,
  };
}

/** Bot HABILE : Travaux + machines dès que la trésorerie le permet, embauche
 *  tant que l'équipe ne sature pas encore le LOCAL ACTUEL (pas une cible figée). */
function runHabile(): RunResult {
  const s = creerPartie("difficile", "populaire");
  const paniers: number[] = [];
  const cas: number[] = [];
  const resultats: number[] = [];

  for (let w = 1; w <= MAX_SEMAINES; w++) {
    // --- Travaux : seulement si le matelas couvre AUSSI le coût certain de la
    // semaine de chantier (0 CA mais salaires/charges/loyer dus quand même) —
    // sinon le chantier lui-même provoque la faillite qu'on croyait éviter.
    const coutT = coutTravaux(s);
    const peutTravaux =
      coutT !== undefined && s.budget - coutT - coutSemaineFermee(s) > RESERVE_CAPEX;
    if (peutTravaux) agrandirBar(s);

    // --- Embauche : cible dérivée du LOCAL actuel, pas de l'état des machines.
    // On n'embauche PAS la semaine du chantier : un salarié de plus ce soir-là
    // n'ajoute qu'un salaire à payer sur une semaine à 0 CA, pour rien.
    if (!peutTravaux) {
      const cible = equipeCibleLocal(s);
      for (const cv of [...s.cvRecus]) {
        if (actifsN(s) >= cible) break;
        embaucherCV(s, cv.profil.id);
      }
    }

    // --- Machines : PRIORITÉ aux Travaux — une amélioration/semaine max, et
    // seulement si la caisse suffirait ENCORE à payer le PROCHAIN Travaux (+ sa
    // semaine de chantier) après l'achat. Sans cette priorité, le bot grignotait
    // sa caisse en petites améliorations et n'atteignait plus jamais le seuil
    // Travaux — un joueur habile met la capacité avant le confort du matériel.
    const coutTSuivant = coutTravaux(s);
    const reserveTravauxFuture = coutTSuivant === undefined ? 0 : coutTSuivant + coutSemaineFermee(s);
    if (!peutTravaux && ameliorationsDebloquees(s)) {
      for (const m of s.machines) {
        if (m.etat === "panne") continue; // réparée plus bas
        const coutA = coutAmelioration(m);
        if (s.budget - coutA - reserveTravauxFuture > RESERVE_CAPEX) {
          ameliorerMachine(s, m.id);
          break; // une seule par semaine : on ne vide pas la caisse d'un coup
        }
      }
    }

    gererSemaineCourante(s);
    simulerSemaine(s);
    const b = s.dernierBilan!;
    resultats.push(b.resultat);
    cas.push(b.chiffreAffaires);
    for (const j of b.jours) if (!j.ferme && j.clients > 0) paniers.push(j.panier);

    const bilan = {
      panierMoyen: moyenne(paniers),
      caMoyen: moyenne(cas),
      resultatMoyen: moyenne(resultats),
      equipeFinale: actifsN(s),
      niveauLocalFinal: s.niveauLocal,
    };
    if (s.phase === "gameover") return { faillite: w, ...bilan };
    if (s.semaineVictoire !== undefined) return { victoire: w, ...bilan };
    preparerSemaineSuivante(s);
    if (s.phase === "gameover") return { faillite: w, ...bilan };
  }
  return {
    panierMoyen: moyenne(paniers),
    caMoyen: moyenne(cas),
    resultatMoyen: moyenne(resultats),
    equipeFinale: actifsN(s),
    niveauLocalFinal: s.niveauLocal,
  };
}

function mediane(a: number[]): number {
  if (!a.length) return NaN;
  const t = [...a].sort((x, y) => x - y);
  return t[Math.floor(t.length / 2)];
}

console.log(
  "équipe | victoires | méd.sem.victoire | moy.sem.victoire | faillites | panier moy | CA moy/sem | résultat moy/sem",
);
for (const target of [1, 2, 3, 4, 5, 6]) {
  const res: RunResult[] = [];
  for (let i = 0; i < RUNS; i++) res.push(run(target));
  const vict = res.filter((r) => r.victoire !== undefined);
  const fail = res.filter((r) => r.faillite !== undefined);
  const moy = (f: (r: RunResult) => number) => res.reduce((sum, r) => sum + f(r), 0) / res.length;
  console.log(
    [
      `  ${target}   `,
      `${((vict.length / RUNS) * 100).toFixed(0)} %`,
      `sem ${mediane(vict.map((r) => r.victoire!))}`,
      `sem ${moyenne(vict.map((r) => r.victoire!)).toFixed(1)}`,
      `${((fail.length / RUNS) * 100).toFixed(1)} %`,
      `${moy((r) => r.panierMoyen).toFixed(2)} €`,
      `${Math.round(moy((r) => r.caMoyen))} €`,
      `${Math.round(moy((r) => r.resultatMoyen))} €`,
    ].join(" | "),
  );
}

console.log("\n--- Bot HABILE (Travaux + machines + embauche adaptée au local) ---");
console.log(
  "victoires | méd.sem.victoire | moy.sem.victoire | faillites | panier moy | CA moy/sem | résultat moy/sem | équipe finale moy | local final moy",
);
{
  const res: RunResult[] = [];
  for (let i = 0; i < RUNS; i++) res.push(runHabile());
  const vict = res.filter((r) => r.victoire !== undefined);
  const fail = res.filter((r) => r.faillite !== undefined);
  const moy = (f: (r: RunResult) => number) => res.reduce((sum, r) => sum + f(r), 0) / res.length;
  console.log(
    [
      `${((vict.length / RUNS) * 100).toFixed(0)} %`,
      `sem ${mediane(vict.map((r) => r.victoire!))}`,
      `sem ${moyenne(vict.map((r) => r.victoire!)).toFixed(1)}`,
      `${((fail.length / RUNS) * 100).toFixed(1)} %`,
      `${moy((r) => r.panierMoyen).toFixed(2)} €`,
      `${Math.round(moy((r) => r.caMoyen))} €`,
      `${Math.round(moy((r) => r.resultatMoyen))} €`,
      `${moy((r) => r.equipeFinale).toFixed(1)}`,
      `${moy((r) => r.niveauLocalFinal).toFixed(1)}`,
    ].join(" | "),
  );
}
