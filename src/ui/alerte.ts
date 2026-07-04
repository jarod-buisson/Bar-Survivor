// ============================================================
//  POP-UP D'ALERTE — s'affiche après le récap quand la semaine
//  finit dans le rouge (résultat négatif). Texte explicatif
//  généré selon ce qui a mal tourné (ruptures, notoriété, refus).
// ============================================================

import type { GameState } from "../game/types";
import { eur } from "./components";

export function ecranAlerte(s: GameState): string {
  const b = s.dernierBilan;
  if (!b) return "";
  const perte = -b.resultat;

  const raisons: string[] = [];
  if (b.ruptures.length > 0) {
    const liste = b.ruptures.join(", ").toLowerCase();
    raisons.push(
      `Tu as tourné <strong>sans ${liste}</strong> : beaucoup de clients sont repartis déçus.`,
    );
  }
  if (b.notorDelta < 0) {
    raisons.push(`Ta réputation a chuté de <strong>${-b.notorDelta} points</strong>.`);
  }
  if (b.refusesTotal >= 50) {
    raisons.push(
      `Tu as refusé <strong>${b.refusesTotal} clients</strong> faute de capacité de service.`,
    );
  }
  if (b.evenements < 0) {
    raisons.push(
      `Les événements de la semaine t'ont coûté <strong>${eur(-b.evenements)}</strong>.`,
    );
  }
  if (raisons.length === 0) {
    raisons.push(`Tes charges ont dépassé tes recettes : surveille salaires, loyer et emprunt.`);
  }

  return `
    <div class="ecran modal-ecran">
      <div class="modal-backdrop"></div>
      <div class="modal alerte-modal">
        <div class="grand-portrait">⚠️</div>
        <h2>Semaine dans le rouge</h2>
        <p class="alerte-perte">Tu as perdu <strong>${eur(perte)}</strong> cette semaine.</p>
        <ul class="alerte-raisons">
          ${raisons.map((r) => `<li>${r}</li>`).join("")}
        </ul>
        <p class="hint">Ressaisis-toi pour ne pas finir en faillite.</p>
        <button class="principal" data-action="fermerAlerte">J'ai compris →</button>
      </div>
    </div>
  `;
}
