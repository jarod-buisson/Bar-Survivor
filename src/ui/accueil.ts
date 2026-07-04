// ============================================================
//  ÉCRAN D'ACCUEIL — intro narrative + lancement de la partie.
//  Difficulté et type d'offre sont figés pour l'instant
//  (difficile · petits prix). Les choix reviendront plus tard.
// ============================================================

import { machineEcrire } from "./components";

export function ecranAccueil(): string {
  return `
    <div class="ecran accueil">
      <h1 class="logo">Bar Survival</h1>

      <div class="histoire">
        <p>${machineEcrire(
          "Bienvenue dans ce qui s'apprête à être ton nouveau bar ! Tu vas devoir le gérer et essayer de survivre !",
          1800,
        )}</p>
      </div>

      <button class="principal pres-suite" data-action="commencer">
        Commencer la partie
      </button>
    </div>
  `;
}
