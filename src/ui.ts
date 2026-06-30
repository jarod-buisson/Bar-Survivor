// ============================================================
//  INTERFACE — construit le HTML affiché selon la phase du jeu.
//  Ces fonctions ne font QUE produire du texte HTML.
//  Le câblage des boutons est géré dans main.ts.
// ============================================================

import type { Employee, GameState } from "./game/types";
import { coutReassort } from "./game/engine";

const eur = (n: number) => `${Math.round(n).toLocaleString("fr-FR")} €`;

/** Moral affiché en 3 cœurs (comme dans le GDD §15). */
function coeurs(moral: number): string {
  const pleins = Math.round((moral / 100) * 3);
  return "❤".repeat(pleins) + "🖤".repeat(3 - pleins);
}

/** Petite jauge en blocs : ex. ███░░ */
function jauge(valeur: number): string {
  const pleins = Math.round((valeur / 100) * 5);
  return "█".repeat(pleins) + "░".repeat(5 - pleins);
}

// ---- Écran d'accueil (choix difficulté + offre) ----

export function ecranAccueil(diff: string | null, offre: string | null): string {
  const btn = (action: string, value: string, label: string, sel: string | null) =>
    `<button class="opt ${sel === value ? "actif" : ""}" data-action="${action}" data-value="${value}">${label}</button>`;

  const pret = diff && offre;

  return `
    <div class="ecran accueil">
      <h1 class="logo">🍺 Bar Survival</h1>
      <p class="sous-titre">Gère un bar qui part à la dérive. Chaque décision compte.</p>

      <h2>Difficulté</h2>
      <div class="options">
        ${btn("diff", "facile", "🟢 Facile<br><small>Midi · clientèle calme</small>", diff)}
        ${btn("diff", "moyen", "🟠 Moyen<br><small>Soir · alcool, bagarres</small>", diff)}
        ${btn("diff", "difficile", "🔴 Difficile<br><small>Midi + Soir</small>", diff)}
      </div>

      <h2>Type d'offre</h2>
      <div class="options">
        ${btn("offre", "populaire", "💰 Petits prix<br><small>Volume, chaos</small>", offre)}
        ${btn("offre", "premium", "🥂 Prix élevés<br><small>Marges, stratégie</small>", offre)}
      </div>

      <button class="principal" data-action="commencer" ${pret ? "" : "disabled"}>
        Ouvrir le bar
      </button>
    </div>
  `;
}

// ---- Barre de stats du haut ----

function barreStats(s: GameState): string {
  return `
    <div class="stats">
      <div><span class="lbl">BUDGET</span><span class="val">${eur(s.budget)}</span></div>
      <div><span class="lbl">NOTORIÉTÉ</span><span class="val">${s.notoriete}/100</span></div>
      <div><span class="lbl">SEMAINE</span><span class="val">${s.semaine}</span></div>
    </div>
  `;
}

// ---- Bandeau des salariés ----

function bandeauSalaries(s: GameState): string {
  const cases = s.employes
    .map((e: Employee) => {
      const etat = e.demissionne ? `<span class="parti">parti</span>` : coeurs(e.moral);
      return `
        <div class="salarie ${e.demissionne ? "off" : ""}">
          <div class="portrait">${e.emoji}</div>
          <div class="coeurs">${etat}</div>
          <div class="nom">${e.nom}</div>
          <div class="role">${e.role}</div>
        </div>`;
    })
    .join("");
  return `<div class="salaries">${cases}</div>`;
}

// ---- Bandeau du bas (stocks + propreté) ----

function bandeauBas(s: GameState): string {
  return `
    <div class="bas">
      <span title="Bières">🍺 ${jauge(s.stocks.bieres)}</span>
      <span title="Alcools">🍷 ${jauge(s.stocks.alcools)}</span>
      <span title="Propreté">🧹 ${jauge(s.proprete)}</span>
    </div>
  `;
}

// ---- Écran d'événement ----

export function ecranEvenement(s: GameState): string {
  const ev = s.evenementCourant;
  if (!ev) return "";
  const cible = ev.cibleId ? s.employes.find((e) => e.id === ev.cibleId) : undefined;
  const portrait = cible ? cible.emoji : "🍺";
  const dernierRetour = s.journal.length > 0 ? s.journal[s.journal.length - 1] : "";

  const boutons = ev.choix
    .map(
      (c, i) =>
        `<button class="choix" data-action="choix" data-index="${i}">${c.label}</button>`,
    )
    .join("");

  return `
    <div class="ecran jeu">
      ${barreStats(s)}
      <div class="evenement">
        ${dernierRetour ? `<div class="retour">${dernierRetour}</div>` : ""}
        <div class="grand-portrait">${portrait}</div>
        <h2 class="titre-ev">${ev.titre}</h2>
        <p class="texte-ev">${ev.texte}</p>
        <div class="choix-zone">${boutons}</div>
      </div>
      ${bandeauSalaries(s)}
      ${bandeauBas(s)}
    </div>
  `;
}

// ---- Écran de bilan hebdomadaire ----

export function ecranBilan(s: GameState): string {
  const b = s.dernierBilan!;
  const ligne = (label: string, montant: number) =>
    `<div class="bilan-ligne"><span>${label}</span><span class="${montant < 0 ? "neg" : "pos"}">${montant >= 0 ? "+" : ""}${eur(montant)}</span></div>`;

  const cout = coutReassort(s);
  const reassortBtn =
    cout > 0
      ? `<button class="secondaire" data-action="reassort">🚚 Commander chez Armand (${eur(cout)})</button>`
      : `<div class="info">Stocks au maximum ✅</div>`;

  return `
    <div class="ecran jeu">
      ${barreStats(s)}
      <div class="bilan">
        <h2>📋 Bilan — Semaine ${b.semaine}</h2>
        ${ligne("Chiffre d'affaires", b.chiffreAffaires)}
        ${ligne("Salaires", -b.salaires)}
        ${ligne("Loyer", -b.loyer)}
        <div class="bilan-sep"></div>
        ${ligne("Résultat de la semaine", b.resultat)}
        <div class="bilan-ligne total"><span>Budget restant</span><span>${eur(b.budgetApres)}</span></div>

        ${bandeauSalaries(s)}
        ${bandeauBas(s)}

        ${reassortBtn}
        <button class="principal" data-action="suivante">Semaine suivante →</button>
      </div>
    </div>
  `;
}

// ---- Écran de fin (défaite ou victoire) ----

export function ecranFin(s: GameState): string {
  const victoire = s.phase === "victoire";
  return `
    <div class="ecran fin ${victoire ? "win" : "lose"}">
      <div class="grand-portrait">${victoire ? "🎉" : "💀"}</div>
      <h1>${victoire ? "Victoire !" : "Game Over"}</h1>
      <p class="raison">${s.raisonFin ?? ""}</p>
      <p class="score">Tu as tenu <strong>${s.semaine}</strong> semaine${s.semaine > 1 ? "s" : ""}.</p>
      <button class="principal" data-action="rejouer">Rejouer</button>
    </div>
  `;
}
