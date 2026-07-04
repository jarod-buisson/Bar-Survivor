// ============================================================
//  ÉCRANS D'ONBOARDING — présentation d'Antho
//  puis embauche de jusqu'à 3 candidats aléatoires.
// ============================================================

import type { Employee, GameState } from "../game/types";
import { badgesTraits, echap, eur, machineEcrire } from "./components";
import { trait } from "../game/traits";
import { EMPRUNT_MAX, EMPRUNT_PAS } from "../game/engine";

/** Le salarié de base (barman irrévocable). */
export function salarieDeBase(s: GameState): Employee {
  return s.employes.find((e) => e.irrevocable) ?? s.employes[0];
}

/** Points de progression de l'onboarding (4 cartes). */
function pointsEtapes(etape: number): string {
  const pts = [1, 2, 3, 4]
    .map((n) => `<span class="pres-dot ${n === etape ? "actif" : n < etape ? "fait" : ""}"></span>`)
    .join("");
  return `<div class="pres-dots">${pts}</div>`;
}

/** Carte 1 : le nom du bar (texte libre, gardé toute la partie). */
function carteNom(s: GameState): string {
  return `
    <h2 class="etape-titre">${machineEcrire("Quel est le nom de ton bar ?", 1200)}</h2>
    <p class="hint">${machineEcrire("Il s'affichera au-dessus du comptoir toute la partie.", 1600)}</p>
    <input type="text" class="pres-input" id="nom-bar" maxlength="24"
           placeholder="Chez Antho" value="${echap(s.nomBar)}" autocomplete="off" />
    <button class="principal pres-suite" data-action="presSuivant">Continuer →</button>`;
}

/** Émoji de stress selon l'emprunt (0 = serein → EMPRUNT_MAX = au bord du gouffre). */
export function emojiEmprunt(v: number): string {
  const f = v / EMPRUNT_MAX;
  if (f < 0.25) return "😄";
  if (f < 0.5) return "😅";
  if (f < 0.75) return "😰";
  return "🥵";
}

/** Carte 2 : le curseur d'emprunt (0 → 100 000 € par crans de 10 000). */
function carteEmprunt(s: GameState): string {
  const v = s.detteInitiale;
  return `
    <h2 class="etape-titre">${machineEcrire("Combien veux-tu emprunter pour lancer ton bar ?", 1600)}</h2>
    <div class="emprunt-val">
      <span id="emprunt-emoji" class="emprunt-emoji">${emojiEmprunt(v)}</span>
      <span id="emprunt-val">${eur(v)}</span>
    </div>
    <div class="four-slider-wrap emprunt" style="--fill:${(v / EMPRUNT_MAX) * 100}%">
      <div class="four-fill"></div>
      <input type="range" class="four-slider emprunt-slider" id="emprunt-slider"
             min="0" max="${EMPRUNT_MAX}" step="${EMPRUNT_PAS}" value="${v}" />
    </div>
    <p class="hint-small">Plus l'emprunt est gros, plus il sera long à rembourser — la partie n'en sera que plus dure.</p>
    <p class="histoire-but" id="emprunt-obj">${objectifEmprunt(v)}</p>
    <button class="principal pres-suite" data-action="presSuivant">Continuer →</button>`;
}

/** Ligne d'objectif sous le curseur — mise à jour en direct par main.ts. */
export function objectifEmprunt(v: number): string {
  return v <= 0
    ? "🎯 Sans emprunt, pas de dette : le mode infini commence tout de suite."
    : `🎯 Ton objectif : <strong>rembourser les ${eur(v)}</strong>. Dette à zéro = bar sauvé.`;
}

/** Les cartes de traits d'Antho (force + faiblesse). Extrait pour pouvoir
 *  ré-injecter juste ce bloc au « Retenter le sort » sans rejouer les textes. */
export function cartesTraitsAntho(s: GameState): string {
  const antho = salarieDeBase(s);
  const carteTrait = (id: string) => {
    const t = trait(id);
    if (!t) return "";
    return `
      <div class="trait-carte trait-carte-${t.type}">
        <span class="tc-emoji">${t.emoji}</span>
        <span class="tc-nom">${t.nom}</span>
        <span class="tc-desc">${t.description}</span>
      </div>`;
  };
  return antho.forces.map(carteTrait).join("") + antho.faiblesses.map(carteTrait).join("");
}

/** Carte 3 : Antho, le barman fourni avec les murs, et ses traits tirés au sort. */
function carteAntho(s: GameState): string {
  const antho = salarieDeBase(s);
  return `
    <h2 class="etape-titre">Voici ton barman</h2>
    <div class="perso-grand">
      <div class="grand-portrait">${antho.emoji}</div>
      <div class="perso-nom">${antho.nom}</div>
      <div class="perso-role">Contrat irrévocable</div>
    </div>
    <p class="hint">${machineEcrire("Antho était déjà derrière le comptoir — il vient avec le lieu.", 1600)}</p>
    <p class="hint">Ses talents et ses travers — le sort en a décidé :</p>
    <div id="antho-traits">${cartesTraitsAntho(s)}</div>
    <button class="secondaire retirage" data-action="randomAntho">🎲 Retenter le sort</button>
    <button class="principal pres-suite" data-action="presSuivant">Continuer →</button>`;
}

/** Carte 4 : dernier avertissement, puis on ouvre pour de bon. */
function carteDepart(s: GameState): string {
  return `
    <h2 class="etape-titre">${echap(s.nomBar || "Chez Antho")}</h2>
    <p class="histoire">${machineEcrire("L'endroit a un passé, et les ennuis ont l'habitude d'y traîner. Sauras-tu tenir ?", 2200)}</p>
    <button class="principal pres-suite" data-action="versHub">Ouvrir le bar →</button>`;
}

/** Onboarding en 4 cartes : nom du bar → emprunt → Antho → départ. */
export function ecranPresentation(s: GameState): string {
  const cartes = [carteNom, carteEmprunt, carteAntho, carteDepart];
  const carte = cartes[Math.min(cartes.length, Math.max(1, s.presentationEtape)) - 1];
  return `
    <div class="ecran onboarding">
      ${pointsEtapes(s.presentationEtape)}
      ${carte(s)}
    </div>
  `;
}

/** Écran 2 : on embauche jusqu'à 3 candidats, puis on lance la semaine. */
export function ecranEmbauche(s: GameState): string {
  const equipe = s.employes
    .map(
      (e) =>
        `<div class="chip"><span>${e.emoji}</span><span>${e.nom}</span>${badgesTraits(e)}</div>`,
    )
    .join("");

  const candidats =
    s.candidats.length === 0
      ? `<p class="hint-small">Plus de candidats. En route !</p>`
      : s.candidats
          .map(
            (c) => `
        <div class="candidat">
          <div class="portrait">${c.emoji}</div>
          <div class="c-info">
            <div class="nom">${c.nom}</div>
            <div class="salaire">${eur(c.salaire)}/sem</div>
            ${badgesTraits(c)}
          </div>
          <div class="c-actions">
            <button class="mini ok" data-action="embaucher" data-value="${c.id}">Embaucher</button>
            <button class="mini no" data-action="refuser" data-value="${c.id}">Passer</button>
          </div>
        </div>`,
          )
          .join("");

  return `
    <div class="ecran onboarding embauche">
      <h2 class="etape-titre">Complète ton équipe</h2>
      <p class="hint">Embauche qui tu veux. Le salaire est payé chaque semaine.</p>

      <div class="equipe-actuelle">
        <div class="bloc-titre">Ton équipe · budget ${eur(s.budget)}</div>
        <div class="chips">${equipe}</div>
      </div>

      <div class="candidats">${candidats}</div>

      <button class="principal" data-action="lancerSemaine">
        Lancer la première semaine de service →
      </button>
    </div>
  `;
}
