// ============================================================
//  ÉCRAN D'ÉVÉNEMENT — un événement narratif à choix pendant le service.
//  Aide au tirage : les choix à pari affichent leur proba ; un salarié
//  présent dont la force correspond (`tirage.aide`) apparaît en jeton à
//  GLISSER sur le choix pour booster les chances (drag pointer, main.ts).
// ============================================================

import type { Choice, Effect, GameState } from "../game/types";
import { aidesPourChoix, bonusChanceux, probaAvecAide } from "../game/engine";
import {
  CATEGORIES_STOCK,
  TACOS_CRUDITES,
  TACOS_SAUCES,
  TACOS_SAUCE_FROMAGERE,
  TACOS_VIANDES,
} from "../game/content";
import { trait } from "../game/traits";
import { barreStats } from "./components";

const JOURS_LONGS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

export function ecranEvenement(s: GameState): string {
  const ev = s.evenementCourant;
  if (!ev) return "";
  const cible = ev.cibleId ? s.employes.find((e) => e.id === ev.cibleId) : undefined;
  const portrait = cible ? cible.emoji : "🍺";
  const dernierRetour = s.journal.length > 0 ? s.journal[s.journal.length - 1] : "";
  // {nom} dans le titre/texte = le salarié ciblé par l'événement.
  // {cause} = la grosse soirée qui a déclenché la venue de la police.
  const nom = cible?.nom ?? "quelqu'un";
  const cause = s.policeEnAttenteCause ?? "votre dernière grosse soirée";
  const titre = ev.titre.replace(/\{nom\}/g, nom).replace(/\{cause\}/g, cause);
  const texte = ev.texte.replace(/\{nom\}/g, nom).replace(/\{cause\}/g, cause);

  const boutons = ev.choix.map((c, i) => boutonChoix(s, c, i)).join("");

  // Tirage en cours : la pinte remplace les boutons de choix. Négociation Olmo :
  // le curseur remplace les boutons (voir main.ts, action "ouvrirNegociationOlmo").
  const corps = s.tirageEnCours
    ? zonePinte(s.tirageEnCours)
    : s.negociationOlmo
      ? zoneNegociationOlmo(s.negociationOlmo)
      : s.configTacos
        ? zoneConfigTacos(s.configTacos)
        : `<div class="choix-zone">${boutons}</div>${zoneAide(s)}`;

  return `
    <div class="ecran jeu">
      ${barreStats(s)}
      <div class="evenement">
        ${dernierRetour ? `<div class="retour">${dernierRetour}</div>` : ""}
        <div class="grand-portrait">${portrait}</div>
        <h2 class="titre-ev">${titre}</h2>
        <p class="texte-ev">${texte}</p>
        ${corps}
      </div>
      ${
        s.jourAnim >= 1 && s.jourAnim <= 7
          ? `<p class="jour-ev">📅 ${JOURS_LONGS[s.jourAnim - 1]} — jour ${s.jourAnim}/7 de la semaine</p>`
          : ""
      }
    </div>
  `;
}

/** Résumé lisible d'un effet : ce que le joueur gagne/perd concrètement. */
function resumeEffet(e: Effect): string {
  const parts: string[] = [];
  const signe = (n: number) => (n > 0 ? `+${n}` : `${n}`);
  if (e.budget) parts.push(`💰 ${signe(e.budget)} €`);
  if (e.notoriete) parts.push(`📣 ${signe(e.notoriete)} réputation`);
  if (e.proprete) parts.push(`🧹 ${signe(e.proprete)}`);
  if (e.moralEquipe) parts.push(`❤ équipe ${signe(e.moralEquipe)}`);
  if (e.moralEquipePourcent) parts.push(`❤ équipe ${signe(Math.round(e.moralEquipePourcent * 100))} %`);
  if (e.fatigueEquipe) parts.push(`😮‍💨 équipe +${e.fatigueEquipe}`);
  if (e.fatiguePresentsJour) parts.push(`😮‍💨 présents ce soir +${e.fatiguePresentsJour}`);
  if (e.moralCible) parts.push(`❤ ${signe(e.moralCible)}`);
  if (e.fatigueCible) parts.push(`😮‍💨 +${e.fatigueCible}`);
  if (e.budgetPourcentage) parts.push(`💰 ${signe(Math.round(e.budgetPourcentage * 100))} % du budget`);
  if (e.caSoirPourcent) parts.push(`💰 CA du soir ${signe(Math.round(e.caSoirPourcent * 100))} %`);
  if (e.demissionCible) parts.push("🚪 démission");
  if (e.declencherAmendePolice) {
    parts.push(
      `🚨 amende ${Math.round(e.declencherAmendePolice.pourcentage * 100)} % du CA${e.declencherAmendePolice.fermeture ? " + fermeture" : ""}`,
    );
  }
  if (e.stock) {
    for (const [cat, v] of Object.entries(e.stock)) {
      const c = CATEGORIES_STOCK.find((x) => x.id === cat);
      parts.push(`${c?.emoji ?? cat} ${signe(v as number)}`);
    }
  }
  if (e.casseMachineAleatoire) parts.push("🔧 une machine sabotée");
  return parts.length > 0 ? parts.join(" · ") : "rien";
}

/** Un bouton de choix. Les paris détaillent leurs ENJEUX : proba effective
 *  (aide glissée + Chanceux présents inclus) et ce que chaque issue rapporte
 *  ou coûte. Le coût immédiat (payé quoi qu'il arrive) s'affiche à part. */
function boutonChoix(s: GameState, c: Choice, i: number): string {
  const t = c.effet.tirage;
  if (!t) return `<button class="choix" data-action="choix" data-index="${i}">${c.label}</button>`;
  const assigne =
    s.aideEvenement?.choixIndex === i
      ? s.employes.find((e) => e.id === s.aideEvenement!.employeId)
      : undefined;
  const pBase = Math.round(t.proba * 100);
  const pEff = Math.round(probaAvecAide(t, assigne !== undefined, bonusChanceux(s)) * 100);
  const pct = pEff !== pBase ? `<s>${pBase} %</s> ${pEff} %` : `${pBase} %`;
  const cout = resumeEffet({ ...c.effet, tirage: undefined });
  const droppable = t.aide !== undefined && aidesPourChoix(s, c).length > 0;
  return `
    <button class="choix pari ${assigne ? "avec-aide" : ""}" data-action="choix" data-index="${i}"${
      droppable ? ` data-drop-choix="${i}"` : ""
    }>
      <span class="choix-label">${c.label}${assigne ? ` ${assigne.emoji}` : ""}</span>
      ${cout !== "rien" ? `<span class="enjeu cout">d'entrée : ${cout}</span>` : ""}
      <span class="enjeu ${t.risque ? "mauvais" : "bon"}">${t.risque ? "☠" : "⭐"} ${pct} : ${resumeEffet(t.succes)}</span>
      <span class="enjeu ${t.risque ? "bon" : "mauvais"}">${t.risque ? "😮‍💨" : "🫗"} sinon : ${resumeEffet(t.echec)}</span>
    </button>`;
}

/** Les jetons d'aide : salariés présents ce soir dont une force correspond à
 *  un des choix. Glissés sur le choix (main.ts), ils boostent son tirage. */
function zoneAide(s: GameState): string {
  const ev = s.evenementCourant;
  if (!ev) return "";
  const parId = new Map<string, { emoji: string; nom: string; traits: string[] }>();
  for (const c of ev.choix) {
    const traitId = c.effet.tirage?.aide;
    if (!traitId) continue;
    const emojiTrait = trait(traitId)?.emoji ?? "💪";
    for (const e of aidesPourChoix(s, c)) {
      const entree = parId.get(e.id) ?? { emoji: e.emoji, nom: e.nom, traits: [] };
      if (!entree.traits.includes(emojiTrait)) entree.traits.push(emojiTrait);
      parId.set(e.id, entree);
    }
  }
  if (parId.size === 0) {
    // Personne d'éligible : on révèle quand même quelle force AURAIT pu aider,
    // pour que le joueur découvre la mécanique et valorise ces traits.
    const besoins = [...new Set(ev.choix.map((c) => c.effet.tirage?.aide).filter(Boolean))] as string[];
    if (besoins.length === 0) return "";
    const noms = besoins
      .map((id) => {
        const t = trait(id);
        return t ? `${t.emoji} ${t.nom}` : id;
      })
      .join(" ou ");
    return `<div class="aide-zone"><p class="hint-small">💡 Un salarié ${noms} présent ce soir pourrait influencer ce tirage en le glissant sur le choix.</p></div>`;
  }
  const jetons = [...parId.entries()]
    .map(
      ([id, a]) =>
        `<div class="aide-chip ${s.aideEvenement?.employeId === id ? "assignee" : ""}" data-aide-id="${id}">${a.emoji} ${a.nom} <span class="aide-trait">${a.traits.join("")}</span></div>`,
    )
    .join("");
  return `
    <div class="aide-zone">
      <p class="hint-small">🖐 Glisse un salarié sur un choix : sa force améliore les chances (fatigue +5).</p>
      <div class="aide-jetons">${jetons}</div>
    </div>`;
}

/** L'animation de la pinte : le verre se remplit en vagues puis se stabilise
 *  pile dans (ou hors de) la zone cible — le résultat est déjà tiré selon la
 *  vraie probabilité (boostée si un salarié aide), l'animation ne fait que le
 *  mettre en scène. */
function zonePinte(t: NonNullable<GameState["tirageEnCours"]>): string {
  const probaPct = Math.round(t.proba * 100);
  // Niveau final déterministe : au milieu de la zone touchée (stable si l'écran se re-rend).
  const niveauFinal = t.gagne
    ? 100 - probaPct * 0.5 // au cœur de la zone cible (en haut du verre)
    : Math.max(10, (100 - probaPct) * 0.55); // frustrant : en dessous de la zone
  // `risque` = la zone cible est une MENACE (racket, amende…) : y atterrir est une mauvaise nouvelle.
  const bon = t.risque ? !t.gagne : t.gagne;
  const verdict = t.risque
    ? t.gagne
      ? "😬 Ça tourne mal…"
      : "😮‍💨 Ça passe !"
    : t.gagne
      ? "🍺 Pinte parfaite !"
      : "🫗 Raté…";
  return `
    <div class="pinte-zone">
      <p class="hint-small">Le destin se verse…</p>
      ${t.aide ? `<p class="pinte-aide">🤝 ${t.aide.emoji} ${t.aide.nom} met toutes les chances de ton côté</p>` : ""}
      <div class="verre">
        <div class="verre-cible ${t.risque ? "risque" : ""}" style="height:${probaPct}%">
          <span>${t.risque ? "☠" : "⭐"} ${probaPct} %</span>
        </div>
        <div class="verre-biere" style="--niveau-final:${niveauFinal}%"></div>
      </div>
      <div class="tirage-verdict ${bon ? "bon" : "mauvais"}">${verdict}</div>
      <button class="principal tirage-continuer" data-action="finTirage">Continuer →</button>
    </div>
  `;
}

/** Négociation avec l'Olmo : curseur de contre-offre (20 % → 50 %, ne peut que
 *  monter). Le remplissage/texte est mis à jour en direct par main.ts. */
function zoneNegociationOlmo(n: NonNullable<GameState["negociationOlmo"]>): string {
  const pct = ((n.valeur - 20) / (50 - 20)) * 100;
  return `
    <div class="negociation-olmo">
      <div class="four-tete">
        <span class="four-nom">Ta contre-offre</span>
        <span class="four-val" id="negociation-val">${n.valeur} %</span>
      </div>
      <div class="four-slider-wrap" style="--fill:${pct}%">
        <div class="four-fill"></div>
        <input type="range" class="four-slider negociation-slider" id="negociation-slider"
               min="20" max="50" step="1" value="${n.valeur}" />
      </div>
      <p class="hint-small">Il acceptera jusqu'à ${n.plafondAccepte} % — au-delà, il pensera que tu te fous de lui.</p>
      <button class="principal" id="negociation-confirmer" data-action="confirmerNegociationOlmo">Proposer ${n.valeur} %</button>
    </div>
  `;
}

/** Configuration du tacos de Brisco : 4 cases empilées, flèches gauche/droite
 *  pour faire défiler chaque option. Seules viande & sauce comptent (le joueur
 *  ne le sait pas) — sauce fromagère/crudités sont là pour la forme. */
function zoneConfigTacos(c: NonNullable<GameState["configTacos"]>): string {
  const cases: { cat: string; emoji: string; nom: string; options: string[] }[] = [
    { cat: "viande", emoji: "🥩", nom: "Viande", options: TACOS_VIANDES },
    { cat: "sauceFromagere", emoji: "🧀", nom: "Sauce fromagère", options: TACOS_SAUCE_FROMAGERE },
    { cat: "sauce", emoji: "🌶️", nom: "Sauce", options: TACOS_SAUCES },
    { cat: "crudites", emoji: "🥗", nom: "Crudités", options: TACOS_CRUDITES },
  ];
  const lignes = cases
    .map((x) => {
      const valeur = (c as unknown as Record<string, number>)[x.cat];
      return `
      <div class="tacos-case">
        <span class="tacos-nom">${x.emoji} ${x.nom}</span>
        <div class="tacos-select">
          <button class="mini tacos-fleche" data-action="tacosCycle" data-value="${x.cat}:-1">◀</button>
          <span class="tacos-val">${x.options[valeur]}</span>
          <button class="mini tacos-fleche" data-action="tacosCycle" data-value="${x.cat}:1">▶</button>
        </div>
      </div>`;
    })
    .join("");
  return `
    <div class="config-tacos">
      ${lignes}
      <button class="principal" data-action="validerTacos">🌯 Valider la commande</button>
    </div>
  `;
}
