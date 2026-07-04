// ============================================================
//  ANIMATION DE LA SEMAINE — les 7 jours défilent (chargement fictif).
//  L'avancement (s.jourAnim, 0→7) est piloté par un timer dans main.ts.
// ============================================================

import type { GameState } from "../game/types";
import { joursOuverture } from "../game/engine";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

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
      <div class="grand-portrait">🍺</div>
      <h2>Semaine ${s.semaine}</h2>
      <p class="hint">Service en cours…</p>
      <div class="jours">${dots}</div>
      <div class="barre-prog"><div class="barre-fill" style="width:${pct}%"></div></div>
      <p class="hint-small">Les clients défilent, la caisse tourne…</p>
    </div>
  `;
}
