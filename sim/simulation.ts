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
// - runHabile(true) : le bot HABILE rejoue EN PLUS les pop-ups d'événements de
//   chaque semaine (choix "engagé mais pas suicidaire", voir choisirChoixBot), et
//   on trace l'impact € de chaque événement pour repérer les réglages aberrants.
// Limite : runNaïf et runHabile(false) ignorent les événements (pas de vacances →
// le bot pose une semaine de repos complète quand la fatigue dépasse 70).
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
  planifierEvenements,
  tirerEvenement,
  declencherEvenement,
  appliquerChoix,
} from "../src/game/engine";
import { CATEGORIES_STOCK } from "../src/game/content";
import { coutAmelioration } from "../src/game/machines";
import type { Choice, Effect, GameState, StockCategorie } from "../src/game/types";

const MAX_SEMAINES = 120;
const RUNS = 300;

// ---- RNG à graine fixable (remplace Math.random pour TOUT le moteur) ----
// Sert au contrefactuel des événements : on rejoue une semaine avec la MÊME
// graine "avec" puis "sans" événements. Comme simulerSemaine tire toujours le
// même NOMBRE d'aléas par jour (indépendamment de la notoriété/stock/boosts),
// les deux passes restent en phase → le diff isole l'effet des événements
// (common random numbers), avec très peu de bruit.
let graine = 0x9e3779b9 >>> 0;
function prochainAleatoire(): number {
  graine = (graine + 0x6d2b79f5) | 0;
  let t = Math.imul(graine ^ (graine >>> 15), 1 | graine);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
Math.random = prochainAleatoire;
function fixerGraine(n: number): void {
  graine = n >>> 0;
}
function graineCourante(): number {
  return graine >>> 0;
}
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

// ============================================================
//  ÉVÉNEMENTS (prototype) — le bot résout les pop-ups de la semaine
//  comme le ferait un joueur "engagé mais pas suicidaire".
// ============================================================

const NOTOR_EN_EUROS = 40; // valeur € approx. d'un point de notoriété (pour arbitrer les choix)
const MORAL_EN_EUROS = 5; // idem pour un point de moral d'équipe

// Traçage par événement : combien de fois chacun tombe + son impact.
interface StatEvenement {
  n: number;
  budget: number; // Σ delta budget DIRECT au choix (hors CA du soir)
  notor: number; // Σ delta notoriété au choix
  nSolo: number; // occurrences sur des semaines à UN SEUL événement (contrefactuel net)
  deltaSolo: number; // Σ (résultat semaine avec − sans) sur ces semaines : impact TOTAL (CA soir inclus)
}
const statsEvenements = new Map<string, StatEvenement>();
function statDe(id: string): StatEvenement {
  let s = statsEvenements.get(id);
  if (!s) {
    s = { n: 0, budget: 0, notor: 0, nSolo: 0, deltaSolo: 0 };
    statsEvenements.set(id, s);
  }
  return s;
}
function tracer(id: string, dBudget: number, dNotor: number): void {
  const s = statDe(id);
  s.n += 1;
  s.budget += dBudget;
  s.notor += dNotor;
}
// Ids des événements résolus dans la semaine courante (pour l'attribution solo).
let evenementsDeLaSemaine: string[] = [];

/** Utilité € approximative d'un Effect, pour que le bot arbitre entre les choix.
 *  Récursif sur les tirages (espérance). Pénalise les coûts récurrents (salaire
 *  de la mascotte V-NOME) pour ne pas accepter naïvement les pièges à 10 000 €/sem. */
function scoreEffet(s: GameState, effet: Effect): number {
  let v = 0;
  v += effet.budget ?? 0;
  v += (effet.budgetPourcentage ?? 0) * s.budget;
  v += (effet.notoriete ?? 0) * NOTOR_EN_EUROS;
  v += (effet.moralEquipe ?? 0) * MORAL_EN_EUROS;
  // Coût récurrent (mascotte) : valeur × ~10 semaines de charge à venir.
  if (effet.poseDrapeau?.cle === "chien_cout_hebdo") {
    v -= Number(effet.poseDrapeau.valeur) * 10;
  }
  if (effet.tirage) {
    const p = effet.tirage.proba;
    v += p * scoreEffet(s, effet.tirage.succes) + (1 - p) * scoreEffet(s, effet.tirage.echec);
  }
  return v;
}

/** Le bot choisit l'index de choix le plus favorable (skip la négociation Olmo,
 *  qui n'est pas résoluble hors UI). */
function choisirChoixBot(s: GameState, choix: Choice[]): number {
  let meilleur = 0;
  let meilleurScore = -Infinity;
  for (let i = 0; i < choix.length; i++) {
    if (choix[i].effet.ouvrirNegociationOlmo) continue; // pas résoluble sans curseur
    if (choix[i].effet.ouvrirConfigTacos) continue; // pas résoluble sans l'écran de config
    const sc = scoreEffet(s, choix[i].effet);
    if (sc > meilleurScore) {
      meilleurScore = sc;
      meilleur = i;
    }
  }
  return meilleur;
}

/** Résout un pop-up déjà ouvert (state.evenementCourant) : le bot choisit,
 *  on applique, on trace l'impact. Le moteur tire lui-même les paris (tirageForce
 *  undefined). */
function resoudreUnPopup(s: GameState): void {
  const ev = s.evenementCourant;
  if (!ev || ev.choix.length === 0) return;
  const idx = choisirChoixBot(s, ev.choix);
  const bAvant = s.budget;
  const nAvant = s.notoriete;
  appliquerChoix(s, idx);
  tracer(ev.id, s.budget - bAvant, s.notoriete - nAvant);
  evenementsDeLaSemaine.push(ev.id);
}

/** Rejoue le flux d'événements d'une semaine (main.ts avancerJour/reprendreApresEvenement) :
 *  pour chaque jour d'événement, tire l'événement, le bot répond, on suit les
 *  enchaînements. `planifierEvenements` doit avoir été appelé juste avant. */
function resoudreEvenementsSemaine(s: GameState): void {
  evenementsDeLaSemaine = [];
  for (const jour of [...s.joursEvenements]) {
    s.jourAnim = jour;
    tirerEvenement(s); // ne passe en "evenement" que s'il y a un événement éligible
    if (s.phase !== "evenement" || !s.evenementCourant) continue;
    resoudreUnPopup(s);
    // Enchaînements (ex : soirée étudiante → vomi le même soir).
    let garde = 0;
    while (s.evenementEnchaine && garde++ < 5) {
      const ench = s.evenementEnchaine;
      s.evenementEnchaine = undefined;
      declencherEvenement(s, ench.id, ench.texte);
      if (!s.evenementCourant) break;
      resoudreUnPopup(s);
    }
    s.evenementCourant = undefined;
    s.phase = "semaine";
  }
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
 *  tant que l'équipe ne sature pas encore le LOCAL ACTUEL (pas une cible figée).
 *  `avecEvenements` : rejoue en plus les pop-ups d'événements de chaque semaine. */
function runHabile(avecEvenements = false): RunResult {
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
    // Événements : planifie les jours (+ reset des états par-semaine) puis rejoue
    // les pop-ups AVANT la simulation, qui lira boostsJour/notoriété à jour.
    if (avecEvenements) {
      // Snapshot d'AVANT les événements → contrefactuel "sans événements".
      const base = structuredClone(s) as GameState;
      base.boostsJour = {}; // réplique les resets NON aléatoires de planifierEvenements
      base.doubleFatigueFin = [];
      base.demissionsForceesFin = [];
      base.joursEvenements = [];
      base.notorieteDebutSemaine = base.notoriete;

      planifierEvenements(s);
      resoudreEvenementsSemaine(s);
      s.jourAnim = 7; // l'animation est "finie" : simulerSemaine tourne sur la semaine complète

      // Deux passes à graine IDENTIQUE : AVEC événements (officiel) puis SANS
      // (jetable). Le diff des résultats = impact TOTAL des événements de la
      // semaine (CA des boosts du soir, conso stock, fatigue… inclus).
      // ATTENTION : mesure LOCALE à la semaine — ne capte pas les conséquences
      // différées (perte d'équipe Lanela = capacité perdue plus tard, blanchiment
      // → bust futur, don_asso rendu ×2 en sem. 5). Un chiffre solo peut donc
      // paraître positif alors que le vrai coût tombe les semaines suivantes.
      const wkSeed = graineCourante();
      fixerGraine(wkSeed);
      simulerSemaine(s);
      fixerGraine(wkSeed);
      simulerSemaine(base);

      // Attribution nette : seulement les semaines à UN SEUL événement distinct
      // (sinon on ne saurait pas à qui attribuer le diff).
      const uniques = [...new Set(evenementsDeLaSemaine)];
      if (uniques.length === 1) {
        const st = statDe(uniques[0]);
        st.nSolo += 1;
        st.deltaSolo += s.dernierBilan!.resultat - base.dernierBilan!.resultat;
      }
    } else {
      simulerSemaine(s);
    }
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

console.log("\n--- Bot HABILE (Travaux + machines + embauche adaptée au local) — SANS vs AVEC événements ---");
console.log(
  "victoires | méd.sem.victoire | moy.sem.victoire | faillites | panier moy | CA moy/sem | résultat moy/sem | équipe finale moy | local final moy",
);
function ligneHabile(res: RunResult[]): string {
  const vict = res.filter((r) => r.victoire !== undefined);
  const fail = res.filter((r) => r.faillite !== undefined);
  const moy = (f: (r: RunResult) => number) => res.reduce((sum, r) => sum + f(r), 0) / res.length;
  return [
    `${((vict.length / RUNS) * 100).toFixed(0)} %`,
    `sem ${mediane(vict.map((r) => r.victoire!))}`,
    `sem ${moyenne(vict.map((r) => r.victoire!)).toFixed(1)}`,
    `${((fail.length / RUNS) * 100).toFixed(1)} %`,
    `${moy((r) => r.panierMoyen).toFixed(2)} €`,
    `${Math.round(moy((r) => r.caMoyen))} €`,
    `${Math.round(moy((r) => r.resultatMoyen))} €`,
    `${moy((r) => r.equipeFinale).toFixed(1)}`,
    `${moy((r) => r.niveauLocalFinal).toFixed(1)}`,
  ].join(" | ");
}

{
  const sans: RunResult[] = [];
  for (let i = 0; i < RUNS; i++) sans.push(runHabile(false));
  console.log(ligneHabile(sans) + "  (sans événements)");

  statsEvenements.clear();
  const avec: RunResult[] = [];
  for (let i = 0; i < RUNS; i++) avec.push(runHabile(true));
  console.log(ligneHabile(avec) + "  (AVEC événements)");

  // --- Diagnostic par événement : fréquence & impact (repère les outliers) ---
  // "€ direct/occ" = delta budget au moment du choix (hors CA du soir).
  // "€ TOTAL/occ (solo)" = contrefactuel net sur les semaines à un seul événement :
  //   inclut le CA des boosts du soir, la conso de stock, la fatigue. C'est LA colonne
  //   qui rend enfin visibles yeda/ayms/vieux_manoir/anniversaire. (— = trop peu de
  //   semaines solo pour un chiffre fiable.)
  console.log(`\n--- Impact des événements (${RUNS} parties AVEC événements) ---`);
  console.log(
    "événement              | occ | /partie | € direct/occ | notor/occ | € TOTAL/occ (solo) | n.solo",
  );
  const lignes = [...statsEvenements.entries()].sort((a, b) => b[1].n - a[1].n);
  const totalOcc = lignes.reduce((s, [, v]) => s + v.n, 0);
  for (const [id, v] of lignes) {
    const totalSolo = v.nSolo >= 10 ? `${Math.round(v.deltaSolo / v.nSolo)} €` : "—";
    console.log(
      [
        id.padEnd(22),
        `${v.n}`.padStart(4),
        `${(v.n / RUNS).toFixed(2)}`.padStart(6),
        `${Math.round(v.budget / v.n)} €`.padStart(11),
        `${(v.notor / v.n).toFixed(1)}`.padStart(8),
        totalSolo.padStart(17),
        `${v.nSolo}`.padStart(6),
      ].join(" | "),
    );
  }
  console.log(`total : ${totalOcc} occurrences, soit ${(totalOcc / RUNS).toFixed(1)} événements/partie en moyenne.`);
}
