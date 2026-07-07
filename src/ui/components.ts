// ============================================================
//  COMPOSANTS UI PARTAGÉS — petits bouts de HTML réutilisés
//  par plusieurs écrans (barre de stats, salariés, jauges…).
// ============================================================

import type { Employee, GameState } from "../game/types";
import { capaciteLocale, efficaciteActuelle } from "../game/engine";
import { CATEGORIES_STOCK, moisAbrege, moisDeSemaine } from "../game/content";
import { trait } from "../game/traits";

export const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** Échappe un texte saisi par le joueur avant insertion dans du HTML. */
export const echap = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Effet « machine à écrire » : chaque lettre apparaît l'une après l'autre
 *  (animation CSS .tw, décalée par lettre). Durée totale ≈ dureeMs, cap à
 *  30 ms/lettre pour que les textes courts ne traînent pas. */
export function machineEcrire(texte: string, dureeMs = 2200): string {
  const lettres = [...texte];
  const pas = Math.min(26, dureeMs / Math.max(1, lettres.length));
  return lettres
    .map((c, i) =>
      c === " "
        ? " " // les espaces restent nus : la césure des mots reste naturelle
        : `<span class="tw" style="animation-delay:${Math.round(i * pas)}ms">${echap(c)}</span>`,
    )
    .join("");
}

/** Moral affiché en 3 cœurs (comme dans le GDD §15). */
export function coeurs(moral: number): string {
  const pleins = Math.round((moral / 100) * 3);
  return "❤".repeat(pleins) + "🖤".repeat(3 - pleins);
}

/** Petite jauge en blocs : ex. ███░░ */
export function jauge(valeur: number): string {
  const pleins = Math.round((valeur / 100) * 5);
  return "█".repeat(pleins) + "░".repeat(5 - pleins);
}

/** Badge d'un trait (force/faiblesse) avec infobulle au survol. */
export function badgeTrait(id: string): string {
  const t = trait(id);
  if (!t) return "";
  const tip = `${t.nom} — ${t.description}`;
  return `<span class="trait trait-${t.type}" data-tip="${tip}">${t.emoji}</span>`;
}

/** Tous les badges de traits d'un salarié (forces puis faiblesses). */
export function badgesTraits(e: Employee): string {
  const tous = [...e.forces, ...e.faiblesses].map(badgeTrait).join("");
  return `<span class="traits">${tous}</span>`;
}

/** Barre de stats du haut (budget / propreté / efficacité / notoriété / capacité / semaine), sur 2 lignes. */
/** Bandeau de marque (titre + ⚙ réglages + nom du bar) — identique sur hub,
 *  transition de lancement, animation de semaine et événements : reste en
 *  place sans jamais disparaître pendant que le centre de l'écran change. */
export function enteteJeu(s: GameState): string {
  return `
    <header class="hub-header">
      <button class="reglages-btn" data-action="ouvrirMenu" data-value="reglages" aria-label="Réglages">⚙</button>
      <h1 class="jeu-titre">BAR SURVIVAL</h1>
      <div class="jeu-bar">${echap(s.nomBar || "Avant d'ouvrir")}</div>
    </header>
  `;
}

export function barreStats(s: GameState): string {
  return `
    <div class="stats">
      <div class="stats-ligne">
        <div><span class="lbl">BUDGET</span><span class="val">${eur(s.budget)}</span></div>
        <div><span class="lbl">🧹 PROPRETÉ</span><span class="val">${Math.round(s.proprete)}%</span></div>
        <div><span class="lbl">SEMAINE</span><span class="val">${s.semaine} ${moisAbrege(moisDeSemaine(s.semaine, s.moisDepart).nom)}</span></div>
      </div>
      <div class="stats-ligne">
        <div data-tip="Indice d'efficacité : capacité de service de l'équipe et des machines (0-100)."><span class="lbl">⚙ EFFICACITÉ</span><span class="val">${Math.round(efficaciteActuelle(s))}%</span></div>
        <div><span class="lbl">NOTORIÉTÉ</span><span class="val">${Math.round(s.notoriete)}%</span></div>
        <div data-tip="Clients max par soir (taille du local). Agrandis le bar via la case Travaux."><span class="lbl">🪑 CAPACITÉ</span><span class="val">${capaciteLocale(s)}</span></div>
      </div>
    </div>
  `;
}

/** Bandeau des salariés (portrait, moral). */
export function bandeauSalaries(s: GameState): string {
  const cases = s.employes
    .filter((e: Employee) => !e.demissionne)
    .map(
      (e: Employee) => `
        <div class="salarie">
          <div class="portrait">${e.emoji}</div>
          <div class="coeurs">${coeurs(e.moral)}</div>
          <div class="nom">${e.nom}</div>
          ${badgesTraits(e)}
        </div>`,
    )
    .join("");
  return `<div class="salaries">${cases}</div>`;
}

/** Bandeau du bas (stocks par catégorie + propreté). */
export function bandeauBas(s: GameState): string {
  const stocks = CATEGORIES_STOCK.map(
    (c) => `<span title="${c.nom}">${c.emoji} ${jauge(s.stocks[c.id])}</span>`,
  ).join("");
  return `
    <div class="bas">
      ${stocks}
      <span title="Propreté">🧹 ${jauge(s.proprete)}</span>
    </div>
  `;
}
