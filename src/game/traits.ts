// ============================================================
//  FORCES & FAIBLESSES — CATALOGUE (refonte v0.4).
//  Données pures + tirage aléatoire pondéré par la rareté.
//  Les effets sont DÉFINIS ici mais PAS ENCORE branchés au moteur.
//  Étape suivante : lire `trait.effet` dans engine.ts / content.ts.
// ============================================================

import type { CibleEffet, Rarete, Trait } from "./types";

// Convention de `effet.valeur` :
//   • relatif (ca, capacite, conso, cogs, usureMachine) : +0.10 = +10 %.
//   • additif (notoriete, proprete, moralEquipe)        : +3 = +3 points/sem.
//   • reparation : valeur = proba de réussite (0–1).
//   • vol        : valeur = part MAX du CA détournée ; montant réel biaisé (voir voleur).
//   • drame      : valeur = frais € à payer, chance = proba/semaine.
//   • `chance` (0–1) = proba d'occurrence d'un effet aléatoire (par soir ou par semaine
//     selon le trait, précisé dans son commentaire).

/** 💪 Forces disponibles. */
export const FORCES: Trait[] = [
  {
    id: "efficacite",
    nom: "Efficacité",
    emoji: "⚡",
    type: "force",
    rarete: "commun",
    description: "Bosse vite et bien : +15 % de rendement → un peu plus de CA chaque soir.",
    effet: { cible: "capacite", valeur: 0.15 },
  },
  {
    id: "ingenieur",
    nom: "Ingénieur",
    emoji: "🔧",
    type: "force",
    rarete: "commun",
    // Mécanique spéciale : 1×/semaine, tente de réparer UNE machine abîmée
    // (< 50 % de vie) avant qu'elle ne casse. valeur = proba de réussite.
    // Un popup de fin de semaine annonce la réparation ("… a réparé le lave-verre").
    description: "1×/semaine, ~50 % de chances de réparer une machine abîmée (<50 % de vie).",
    effet: { cible: "reparation", valeur: 0.5 },
  },
  {
    id: "ambianceur",
    nom: "Ambianceur",
    emoji: "🎉",
    type: "force",
    rarete: "commun",
    // Chaque soir : `chance` de gagner `valeur` point(s) de notoriété.
    // ~0.35 × 7 soirs ≈ +2,5 notoriété/semaine en moyenne (ajustable).
    description: "Met l'ambiance : chaque soir, ~35 % de chances de +1 notoriété.",
    effet: { cible: "notoriete", valeur: 1, chance: 0.35 },
  },
  {
    id: "muscle",
    nom: "Musclé",
    emoji: "💪",
    type: "force",
    rarete: "commun",
    description: "Videur né : calme les bagarres avant qu'elles n'éclatent.",
    effet: { cible: "bagarre", valeur: 1 },
  },
  {
    id: "nettoyeur",
    nom: "Nettoyeur",
    emoji: "🧹",
    type: "force",
    rarete: "commun",
    description: "Entretient le bar : propreté +2/semaine.",
    effet: { cible: "proprete", valeur: 2 }, // branché : compense ~1/3 de la salissure
  },
  {
    id: "mafieux",
    nom: "Mafieux",
    emoji: "🤝",
    type: "force",
    rarete: "commun",
    description: "A des contacts : négocie avec le milieu à moindre coût.",
    effet: { cible: "mafia", valeur: 1 },
  },
  {
    id: "infatigable",
    nom: "Infatigable",
    emoji: "🔋",
    type: "force",
    rarete: "commun",
    description: "Récupère vite : accumule la fatigue 2× moins vite.",
    effet: { cible: "fatigue", valeur: -0.5 },
  },
  {
    id: "econome",
    nom: "Économe",
    emoji: "🧮",
    type: "force",
    rarete: "commun",
    description: "Anti-gaspi : -10 % de consommation de stock.",
    effet: { cible: "conso", valeur: -0.1 },
  },
  {
    id: "commercial",
    nom: "Commercial",
    emoji: "💼",
    type: "force",
    rarete: "commun",
    description: "Fait monter le panier : +10 % de CA.",
    effet: { cible: "ca", valeur: 0.1 },
  },
  {
    id: "chanceux",
    nom: "Chanceux",
    emoji: "🍀",
    type: "force",
    rarete: "commun",
    // Présent un soir de tirage : +5 pts de proba automatiques (cumulable avec
    // l'aide glissée sur le choix, et avec plusieurs Chanceux).
    description: "Porte bonheur : +5 % de chances sur les tirages les soirs où il travaille.",
    effet: { cible: "tirage", valeur: 0.05 },
  },
  {
    id: "pourboires",
    nom: "Aimant à pourboires",
    emoji: "🤑",
    type: "force",
    rarete: "commun",
    // Chaque soir travaillé : `chance` de ramasser 40 à `valeur` € (ligne
    // « Événements & imprévus » du bilan + note au récap).
    description: "Chaque soir travaillé, ~25 % de chances de ramasser 40-120 € de pourboires.",
    effet: { cible: "pourboire", valeur: 120, chance: 0.25 },
  },
  {
    id: "zen",
    nom: "Zen",
    emoji: "🧘",
    type: "force",
    rarete: "commun",
    // Miroir du Casse-couille : chaque semaine, les COLLÈGUES gagnent `valeur` de moral.
    description: "Apaise l'équipe : +2 de moral pour les collègues chaque semaine.",
    effet: { cible: "moralEquipe", valeur: 2, chance: 1 }, // chance:1 = exclu de bonusPassif (géré à part)
  },
  {
    id: "negociant",
    nom: "Négociant",
    emoji: "📦",
    type: "force",
    rarete: "commun",
    description: "Connaît les fournisseurs : -20 % sur toutes les commandes.",
    effet: { cible: "achat", valeur: -0.2 },
  },
  {
    id: "noctambule",
    nom: "Noctambule",
    emoji: "🦉",
    type: "force",
    rarete: "commun",
    description: "S'éveille la nuit : +25 % de rendement les vendredis et samedis.",
    effet: { cible: "weekend", valeur: 0.25 },
  },
  {
    id: "bricoleur",
    nom: "Bricoleur",
    emoji: "🛠",
    type: "force",
    rarete: "commun",
    description: "Soigne le matériel : -15 % d'usure des machines.",
    effet: { cible: "usureMachine", valeur: -0.15 },
  },
  {
    id: "mentor",
    nom: "Mentor",
    emoji: "🎓",
    type: "force",
    rarete: "commun",
    // Les COLLÈGUES présents le même soir gagnent `valeur` de capacité (pas lui).
    description: "Fait progresser les autres : +5 % de capacité pour les collègues présents avec lui.",
    effet: { cible: "mentor", valeur: 0.05 },
  },
];

/** ⚠ Faiblesses disponibles. */
export const FAIBLESSES: Trait[] = [
  {
    id: "alcoolique",
    nom: "Alcoolique",
    emoji: "🍺",
    type: "faiblesse",
    rarete: "commun",
    // Chaque soir : `chance` (1/8) d'être ivre → efficacité du soir ×(1+valeur), ici -20 %.
    description: "Chaque soir, 1 chance sur 8 d'être ivre : -20 % d'efficacité ce soir-là.",
    effet: { cible: "capacite", valeur: -0.2, chance: 0.125 },
  },
  {
    id: "depressif",
    nom: "Dépressif",
    emoji: "😔",
    type: "faiblesse",
    rarete: "rare",
    // ÉMERGENT : jamais tiré à l'embauche. Apparaît quand le moral du salarié
    // tombe trop bas (peut se cumuler à une autre faiblesse, sur plusieurs
    // salariés). Au lancement de semaine : `chance` que le salarié se suicide
    // → on le perd, popup, l'entreprise paie `valeur` € de frais. Rare mais possible.
    description: "Si le moral s'effondre : faible risque de drame au lancement (perte du salarié + frais).",
    effet: { cible: "drame", valeur: 3000, chance: 0.06 },
    emergent: true,
  },
  {
    id: "dangereux",
    nom: "Dangereux",
    emoji: "💢",
    type: "faiblesse",
    rarete: "commun",
    // `chance`/semaine de s'énerver → -`valeur` notoriété + popup de fin de semaine
    // ("s'est battu avec un client").
    description: "Peut s'énerver (~15 %/sem) et se battre avec un client : -6 notoriété.",
    effet: { cible: "notoriete", valeur: -6, chance: 0.15 },
  },
  {
    id: "voleur",
    nom: "Voleur",
    emoji: "🕵️",
    type: "faiblesse",
    rarete: "legendaire",
    // Détourne une part du CA, JAMAIS annoncée au récap (on n'est pas censé le
    // savoir). Montant aléatoire biaisé : souvent ~2 %, rarement jusqu'à `valeur`
    // (40 %). Plancher garanti : le CA final reste toujours ≥ 50 % du CA de base.
    description: "Pioche discrètement dans la caisse (jamais indiqué au récap).",
    effet: { cible: "vol", valeur: 0.4, chance: 1 },
  },
  {
    id: "casse_couille",
    nom: "Casse-couille",
    emoji: "😤",
    type: "faiblesse",
    rarete: "commun",
    // Au lancement de semaine : fait baisser le moral de TOUS les collègues d'un
    // montant aléatoire (~`valeur` points en moyenne).
    description: "Insupportable : plombe aléatoirement le moral de toute l'équipe chaque semaine.",
    effet: { cible: "moralEquipe", valeur: -3 },
  },
  {
    id: "lent",
    nom: "Lent",
    emoji: "🐌",
    type: "faiblesse",
    rarete: "commun",
    description: "Traîne des pieds : -10 % de capacité de service.",
    effet: { cible: "capacite", valeur: -0.1 },
  },
  {
    id: "maladroit",
    nom: "Maladroit",
    emoji: "💥",
    type: "faiblesse",
    rarete: "commun",
    description: "Abîme le matériel : +25 % d'usure des machines.",
    effet: { cible: "usureMachine", valeur: 0.25 },
  },
  {
    id: "fragile",
    nom: "Fragile",
    emoji: "🤒",
    type: "faiblesse",
    rarete: "commun",
    // `chance`/semaine de tomber malade → `valeur` jours d'arrêt IMPOSÉS la
    // semaine suivante (lundi-mardi cochés dans le planning).
    description: "Tombe facilement malade (~12 %/sem) : 2 jours d'arrêt forcé la semaine suivante.",
    effet: { cible: "maladie", valeur: 2, chance: 0.12 },
  },
  {
    id: "retardataire",
    nom: "Retardataire",
    emoji: "🕰",
    type: "faiblesse",
    rarete: "commun",
    description: "Traîne au retour de repos : rendement à 60 % le lendemain d'un jour off.",
    effet: { cible: "retard", valeur: -0.4 },
  },
  {
    id: "genereux",
    nom: "Généreux",
    emoji: "💸",
    type: "faiblesse",
    rarete: "commun",
    description: "Offre des tournées aux habitués : +15 % de consommation de stock.",
    effet: { cible: "conso", valeur: 0.15 },
  },
  {
    id: "trouillard",
    nom: "Trouillard",
    emoji: "😱",
    type: "faiblesse",
    rarete: "commun",
    description: "Se défile devant le danger : impossible de le glisser sur un tirage risqué ☠.",
    effet: { cible: "peur", valeur: 1 },
  },
  {
    id: "rancunier",
    nom: "Rancunier",
    emoji: "🧨",
    type: "faiblesse",
    rarete: "commun",
    // Multiplie par `valeur` les malus de moral qui le CIBLENT (refus d'augmentation…).
    description: "Encaisse très mal les refus : moral perdu doublé quand ça le concerne.",
    effet: { cible: "rancune", valeur: 2 },
  },
  {
    id: "joueur",
    nom: "Joueur",
    emoji: "🎰",
    type: "faiblesse",
    rarete: "commun",
    // `chance`/semaine : ponctionne 100 à `valeur` € pour parier. Contrairement
    // au Voleur, c'est VISIBLE (note au récap + ligne événements).
    description: "Parie avec la caisse : certaines semaines, 100-400 € s'envolent (au moins, ça se voit).",
    effet: { cible: "pari", valeur: 400, chance: 0.1 },
  },
];

/** Paires force/faiblesse incohérentes (v0.9) : jamais tirées ensemble sur le
 *  même salarié — soit des miroirs mécaniques opposés (Bricoleur/Maladroit),
 *  soit une contradiction de caractère (Musclé/Trouillard). */
const INCOMPATIBLES: [string, string][] = [
  ["muscle", "trouillard"],
  ["bricoleur", "maladroit"],
  ["zen", "casse_couille"],
  ["econome", "genereux"],
  ["efficacite", "lent"],
  ["ingenieur", "maladroit"],
  ["zen", "dangereux"],
  ["zen", "rancunier"],
  ["infatigable", "fragile"],
];

/** Poids de tirage par rareté. Aplati en v0.6 : toutes les forces sont
 *  équiprobables (les forces utiles aux événements sortaient trop rarement).
 *  Seul le Voleur reste `legendaire` : caché et punitif, il doit rester rare. */
const POIDS_RARETE: Record<Rarete, number> = {
  commun: 60,
  rare: 30,
  legendaire: 10,
};

/** Index id → trait (toutes forces + faiblesses confondues). */
const PAR_ID: Record<string, Trait> = {};
for (const t of [...FORCES, ...FAIBLESSES]) PAR_ID[t.id] = t;

/** Retrouve un trait par son id (ou undefined). */
export function trait(id: string): Trait | undefined {
  return PAR_ID[id];
}

/** Le salarié possède-t-il ce trait (force ou faiblesse) ? */
export function aTrait(e: { forces: string[]; faiblesses: string[] }, id: string): boolean {
  return e.forces.includes(id) || e.faiblesses.includes(id);
}

/** Somme des effets PASSIFS (sans champ `chance`) d'un salarié sur une cible.
 *  Ex. bonusPassif(e, "capacite") → +0.15 (Efficacité) − 0.10 (Lent) = +0.05.
 *  Les traits à `chance` (alcoolique, ambianceur…) sont gérés à part par le moteur. */
export function bonusPassif(
  e: { forces: string[]; faiblesses: string[] },
  cible: CibleEffet,
): number {
  let total = 0;
  for (const id of [...e.forces, ...e.faiblesses]) {
    const t = PAR_ID[id];
    if (t && t.effet.cible === cible && t.effet.chance === undefined) total += t.effet.valeur;
  }
  return total;
}

/** Tire un trait dans une liste, pondéré par la rareté (dormants/émergents exclus). */
function piocherPondere(pool: Trait[]): Trait {
  const dispo = pool.filter((t) => !t.dormant && !t.emergent);
  const total = dispo.reduce((s, t) => s + POIDS_RARETE[t.rarete], 0);
  let r = Math.random() * total;
  for (const t of dispo) {
    r -= POIDS_RARETE[t.rarete];
    if (r <= 0) return t;
  }
  return dispo[dispo.length - 1];
}

/**
 * Tire les traits d'un salarié : 1 force + 1 faiblesse, chacune pondérée par
 * la rareté (les traits communs sortent souvent, les légendaires rarement).
 * Les traits `dormant` (pas encore branchés) ne sont jamais tirés.
 * Renvoie les ids (à stocker sur l'Employee lors du branchement).
 */
export function tirerTraits(): { forces: string[]; faiblesses: string[] } {
  const force = piocherPondere(FORCES);
  // Exclut les faiblesses incohérentes avec la force déjà tirée (voir INCOMPATIBLES).
  const exclues = INCOMPATIBLES.filter(([f]) => f === force.id).map(([, w]) => w);
  const poolFaiblesses = exclues.length
    ? FAIBLESSES.filter((t) => !exclues.includes(t.id))
    : FAIBLESSES;
  return {
    forces: [force.id],
    faiblesses: [piocherPondere(poolFaiblesses).id],
  };
}
