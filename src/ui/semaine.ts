// ============================================================
//  ANIMATION DE LA SEMAINE — les 7 jours défilent (chargement fictif).
//  L'avancement (s.jourAnim, 0→7) est piloté par un timer dans main.ts.
// ============================================================

import type { GameState } from "../game/types";
import { joursOuverture } from "../game/engine";
import { barreStats, enteteJeu } from "./components";
import { bandeauTuilesReduites, TUILES } from "./hub";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

/** Transition (2 s, voir main.ts) entre le hub et l'animation de semaine : les
 *  tuiles du hub s'aplatissent et se collent en bas pendant que l'intro de
 *  semaine prend leur place. Le JS bascule la classe "reduites"/"visible" une
 *  fois ce cadre peint, pour que la transition CSS parte bien de l'état plein. */
export function ecranLancement(s: GameState): string {
  const tuiles = TUILES.map(
    (t) => `<div class="tuile"><span class="tuile-emoji">${t.emoji}</span><span class="tuile-label">${t.label}</span></div>`,
  ).join("");
  return `
    <div class="ecran lancement">
      ${enteteJeu(s)}
      ${barreStats(s)}
      <div class="lancement-intro">
        <div class="grand-portrait">🍺</div>
        <h2>Semaine ${s.semaine}</h2>
        <p class="hint">Ouverture du bar…</p>
      </div>
      <div class="tuiles lancement-tuiles">${tuiles}</div>
    </div>
  `;
}

export function ecranSemaine(s: GameState): string {
  const ouverts = joursOuverture(s);
  const dots = JOURS.map((j, i) => {
    const passe = i < s.jourAnim ? "passe" : "";
    const actif = i + 1 === s.jourAnim ? "actif" : "";
    const ferme = ouverts[i] ? "" : "ferme";
    return `<div class="jour ${passe} ${actif} ${ferme}"><span>${ouverts[i] ? j : "🚪"}</span></div>`;
  }).join("");

  const pct = Math.round((s.jourAnim / JOURS.length) * 100);

  return `
    <div class="ecran semaine-anim">
      ${enteteJeu(s)}
      ${barreStats(s)}
      <div class="semaine-centre">
        <div class="grand-portrait">🍺</div>
        <h2>Semaine ${s.semaine}</h2>
        <p class="hint">Service en cours…</p>
        <div class="jours">${dots}</div>
        <div class="barre-prog"><div class="barre-fill" style="width:${pct}%"></div></div>
        <p class="hint-small">Les clients défilent, la caisse tourne…</p>
      </div>
      ${bandeauTuilesReduites()}
    </div>
  `;
}
