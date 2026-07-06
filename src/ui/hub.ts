// ============================================================
//  HUB — menu de gestion entre les semaines.
//  Grille de tuiles avec pastille de notification, + bouton de lancement.
// ============================================================

import type { GameState } from "../game/types";
import { joursOuverture, statutNotif } from "../game/engine";
import { barreStats, echap } from "./components";

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const TUILES: { id: string; emoji: string; label: string; bientotDispo?: boolean }[] = [
  { id: "salaries", emoji: "👥", label: "Salariés" },
  { id: "cv", emoji: "📄", label: "CV" },
  { id: "stock", emoji: "📦", label: "Fournisseur & prix" },
  { id: "reparations", emoji: "🔧", label: "Réparations" },
  { id: "menage", emoji: "🧹", label: "Ménage" },
  { id: "travaux", emoji: "🏗", label: "Travaux" },
  { id: "banque", emoji: "🏦", label: "Banque" },
  { id: "historique", emoji: "📜", label: "Historique" },
  { id: "calendrier", emoji: "📅", label: "Calendrier" },
];

export function ecranHub(s: GameState): string {
  const tuiles = TUILES.map((t) => {
    if (t.bientotDispo || s.barFerme) {
      return `
        <button class="tuile desactivee" disabled>
          <span class="tuile-emoji">${t.emoji}</span>
          <span class="tuile-label">${s.barFerme ? (s.barFermeRaison === "travaux" ? "Chantier" : "Fermé") : "Bientôt dispo"}</span>
        </button>`;
    }
    const statut = statutNotif(s, t.id);
    return `
      <button class="tuile" data-action="ouvrirMenu" data-value="${t.id}">
        <span class="dot ${statut}"></span>
        <span class="tuile-emoji">${t.emoji}</span>
        <span class="tuile-label">${t.label}</span>
      </button>`;
  }).join("");

  const lancer = `<button class="principal" data-action="lancerSemaine">Lancer la semaine ${s.semaine} →</button>`;

  // Résumé des fermetures prévues (planning des repos, menu Salariés).
  const ouverts = joursOuverture(s);
  const fermes = JOURS.filter((_, i) => !ouverts[i]);
  const fermetureInfo = s.barFerme
    ? s.barFermeRaison === "travaux"
      ? `<p class="hint-small neg">🏗 Chantier en cours cette semaine : porte close, aucune gestion possible. Salaires et charges restent dus.</p>`
      : `<p class="hint-small neg">🚔 Fermeture administrative cette semaine : porte close, aucune gestion possible. Salaires et charges restent dus.</p>`
    : fermes.length === 0
      ? `<p class="hint-small">🍺 Bar ouvert 7j/7 — pense au repos de ton équipe.</p>`
      : `<p class="hint-small ${fermes.length > 2 ? "neg" : ""}">🚪 Fermé : ${fermes.join(", ")}${fermes.length > 2 ? " — au-delà de 2 jours, la notoriété baisse !" : ""}</p>`;

  return `
    <div class="ecran jeu hub">
      <header class="hub-header">
        <button class="reglages-btn" data-action="ouvrirMenu" data-value="reglages" aria-label="Réglages">⚙</button>
        <h1 class="jeu-titre">BAR SURVIVAL</h1>
        <div class="jeu-bar">${echap(s.nomBar || "Avant d'ouvrir")}</div>
      </header>
      ${barreStats(s)}
      <div class="tuiles">${tuiles}</div>
      ${fermetureInfo}
      ${lancer}
    </div>
  `;
}
