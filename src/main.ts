// ============================================================
//  POINT D'ENTRÉE — relie le moteur (engine) et l'interface (ui).
//  Garde l'état du jeu, réagit aux clics, ré-affiche l'écran.
// ============================================================

import "./style.css";
import type { Difficulty, GameState, OfferType } from "./game/types";
import { choisir, commanderStocks, creerPartie, semaineSuivante } from "./game/engine";
import { ecranAccueil, ecranBilan, ecranEvenement, ecranFin } from "./ui";

const app = document.getElementById("app")!;

// État courant. `null` = on est sur l'écran d'accueil, pas encore en partie.
let state: GameState | null = null;

// Sélections temporaires de l'écran d'accueil.
let choixDifficulte: Difficulty | null = null;
let choixOffre: OfferType | null = null;

/** Affiche l'écran correspondant à la phase actuelle. */
function rendre(): void {
  if (!state) {
    app.innerHTML = ecranAccueil(choixDifficulte, choixOffre);
    return;
  }
  switch (state.phase) {
    case "evenement":
      app.innerHTML = ecranEvenement(state);
      break;
    case "bilan":
      app.innerHTML = ecranBilan(state);
      break;
    case "gameover":
    case "victoire":
      app.innerHTML = ecranFin(state);
      break;
    default:
      app.innerHTML = ecranAccueil(choixDifficulte, choixOffre);
  }
}

/** Gestion centralisée des clics (délégation via data-action). */
app.addEventListener("click", (e) => {
  const cible = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
  if (!cible) return;
  const action = cible.dataset.action!;
  const value = cible.dataset.value;
  const index = cible.dataset.index;

  switch (action) {
    case "diff":
      choixDifficulte = value as Difficulty;
      break;
    case "offre":
      choixOffre = value as OfferType;
      break;
    case "commencer":
      if (choixDifficulte && choixOffre) {
        state = creerPartie(choixDifficulte, choixOffre);
      }
      break;
    case "choix":
      if (state) choisir(state, Number(index));
      break;
    case "reassort":
      if (state) commanderStocks(state);
      break;
    case "suivante":
      if (state) semaineSuivante(state);
      break;
    case "rejouer":
      state = null;
      choixDifficulte = null;
      choixOffre = null;
      break;
  }
  rendre();
});

rendre();
