// Harnais de simulation headless — valide l'équilibrage économique en jouant
// des centaines de parties avec un bot simple, pour plusieurs tailles d'équipe.
//
// Lancer :
//   ./node_modules/.bin/esbuild sim/simulation.ts --bundle --format=esm \
//     --platform=node --outfile=/tmp/bar-sim.mjs && node /tmp/bar-sim.mjs
//
// Limites assumées (identiques d'un scénario à l'autre, donc comparaison valable) :
// - Événements ignorés (pas de vacances → le bot pose une semaine de repos complète
//   quand la fatigue dépasse 70, pour simuler l'effet).
// - Pas de Travaux ni d'améliorations de machines : le local reste à 150 places,
//   les médianes de victoire sont donc un peu pessimistes vs une vraie partie.
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
} from "../src/game/engine";
import { CATEGORIES_STOCK } from "../src/game/content";
import type { GameState, StockCategorie } from "../src/game/types";

const MAX_SEMAINES = 120;
const RUNS = 300;

interface RunResult {
  victoire?: number; // semaine de victoire (dette soldée)
  faillite?: number; // semaine de game over (faillite ou départ d'Antho)
  panierMoyen: number;
  caMoyen: number;
  resultatMoyen: number;
  equipeFinale: number;
}

function actifsN(s: GameState): number {
  return s.employes.filter((e) => !e.demissionne).length;
}

function moyenne(a: number[]): number {
  return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
}

function run(teamTarget: number): RunResult {
  const s = creerPartie("difficile", "populaire");
  const paniers: number[] = [];
  const cas: number[] = [];
  const resultats: number[] = [];

  for (let w = 1; w <= MAX_SEMAINES; w++) {
    // --- Embauche : compléter l'équipe via les CV reçus ---
    for (const cv of [...s.cvRecus]) {
      if (actifsN(s) >= teamTarget) break;
      embaucherCV(s, cv.profil.id);
    }

    // --- Planning de repos : 2 jours échelonnés ; semaine complète si épuisé ---
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

    // --- Réparations ---
    for (const m of s.machines) {
      if (m.etat === "panne") reparerPro(s, m.id);
    }

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
  };
}

function mediane(a: number[]): number {
  if (!a.length) return NaN;
  const t = [...a].sort((x, y) => x - y);
  return t[Math.floor(t.length / 2)];
}

console.log("équipe | victoires | méd.sem.victoire | faillites | panier moy | CA moy/sem | résultat moy/sem");
for (const target of [1, 2, 3, 4]) {
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
      `${((fail.length / RUNS) * 100).toFixed(1)} %`,
      `${moy((r) => r.panierMoyen).toFixed(2)} €`,
      `${Math.round(moy((r) => r.caMoyen))} €`,
      `${Math.round(moy((r) => r.resultatMoyen))} €`,
    ].join(" | "),
  );
}
