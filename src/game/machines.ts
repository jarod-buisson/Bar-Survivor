// ============================================================
//  MACHINES (voir GDD §11) — données + helpers purs.
//  Efficacité en POINTS. Pannes pilotées par les HP (proba).
//  La mutation de l'état (réparer, améliorer) est dans engine.ts.
// ============================================================

import type { Machine } from "./types";

export const NIVEAU_MAX = 3;

// Coût de la réparation pro PAR machine (panne). Certaines coûtent cher :
// il faut de la trésorerie pour les remettre en marche, sans être punitif.
const COUT_REPARATION: Record<string, number> = {
  caisse: 800,
  laveverre: 1000,
  glacon: 1200,
  cafe: 1500,
  tireuse: 1800,
  frigo: 2500,
};
const COUT_REPARATION_DEFAUT = 1200;

/** Poids de chaque machine dans le service : part de l'indice d'efficacité
 *  perdue quand elle est HS. La tireuse est le cœur du bar (la bière est le
 *  premier produit vendu) : sa panne doit se sentir lourdement. */
const POIDS_MACHINE: Record<string, number> = {
  tireuse: 0.35,
  frigo: 0.2,
  caisse: 0.15,
  laveverre: 0.12,
  glacon: 0.09,
  cafe: 0.06,
};
const POIDS_DEFAUT = 0.1;
const BONUS_RENDEMENT = 40; // points de bonusEfficacite qui valent +100 % de rendement

// Usure hebdo de base PAR machine (points de HP/sem), du + fragile au + robuste.
// Baissée ~30 % (v1.1) : les machines cassaient trop vite en milieu de partie.
const USURE_PAR_MACHINE: Record<string, number> = {
  laveverre: 5,
  glacon: 4,
  tireuse: 4,
  cafe: 3,
  frigo: 2,
  caisse: 2,
};
const USURE_DEFAUT = 4; // usure d'une machine absente de la table
const USURE_VARIA = 0.6; // marge de dommage aléatoire, tirée chaque soir (±60 %)

/** Bonus d'efficacité gagné PAR NIVEAU d'amélioration, selon la machine. */
const BONUS_PAR_NIVEAU: Record<string, number> = {
  laveverre: 2,
  caisse: 3,
  tireuse: 5,
  glacon: 2,
  cafe: 2,
  frigo: 3,
};
/** Prix de la 1re amélioration (×1.25 à chaque niveau suivant). */
const PRIX_AMELIORATION: Record<string, number> = {
  laveverre: 5000,
  caisse: 7500,
  tireuse: 10000,
  glacon: 5000,
  cafe: 6000,
  frigo: 8000,
};

/** Les machines présentes dès le départ. */
export function machinesDeDepart(): Machine[] {
  const neuve = (id: string, nom: string, emoji: string): Machine => ({
    id,
    nom,
    emoji,
    hp: 100,
    etat: "marche",
    niveau: 0,
    bonusEfficacite: 0,
  });
  return [
    neuve("caisse", "Caisse enregistreuse", "🧾"),
    neuve("tireuse", "Tireuse à bière", "🍺"),
    neuve("laveverre", "Lave-verre", "🚰"),
    neuve("glacon", "Machine à glaçon", "🧊"),
    neuve("cafe", "Machine à café", "☕"),
    neuve("frigo", "Frigo", "❄️"),
  ];
}

/** Rendement d'une machine selon son usure : plein tant qu'elle est bien
 *  entretenue (HP haut), puis décline jusqu'à un plancher quand elle s'use. */
function facteurUsure(hp: number): number {
  const SEUIL_PLEIN = 80; // au-dessus : rendement maximal
  const PLANCHER = 0.4; // rendement mini d'une machine très usée mais en marche
  if (hp >= SEUIL_PLEIN) return 1;
  return PLANCHER + (1 - PLANCHER) * (hp / SEUIL_PLEIN);
}

/** Part d'indice que représente une machine (la tireuse pèse le plus lourd). */
export function poidsMachine(id: string): number {
  return POIDS_MACHINE[id] ?? POIDS_DEFAUT;
}

/** Rendement d'une machine : 0 en panne, 1 neuve, un peu plus si améliorée. */
export function rendementMachine(m: Machine): number {
  if (m.etat !== "marche") return 0;
  return facteurUsure(m.hp) + m.bonusEfficacite / BONUS_RENDEMENT;
}

/** Bonus de rendement (en %) apporté par les améliorations, pour l'affichage. */
export function bonusRendementPct(m: Machine): number {
  return Math.round((m.bonusEfficacite / BONUS_RENDEMENT) * 100);
}

/** Multiplicateur appliqué à l'indice d'efficacité par l'état du parc.
 *  Chaque machine retire sa part : poids × (1 - rendement). Une tireuse HS
 *  multiplie l'indice par 0.65 ; tout le parc HS l'écrase vers ~0.3.
 *  `rendement` est injectable pour simuler un soir donné (panne en cours de semaine). */
export function facteurMachines(
  machines: Machine[],
  rendement: (m: Machine) => number = rendementMachine,
): number {
  return machines.reduce((f, m) => f * (1 - poidsMachine(m.id) * (1 - rendement(m))), 1);
}

/** Probabilité de tomber en panne sur la semaine, selon les HP.
 *  HP ≥ 50 : jamais de panne — aligné sur le seuil visuel (barre orange à 50 %),
 *  pour qu'une machine encore "verte" à l'écran ne casse jamais par surprise.
 *  Proba ~halvée (v1.1) : moins de pannes-surprises même une fois la machine usée. */
export function probaPanne(hp: number): number {
  if (hp < 25) return 1 / 8;
  if (hp < 50) return 1 / 20;
  return 0; // HP >= 50 : pas de panne
}

/** Usure hebdomadaire : chaque machine en marche perd des HP à SON rythme, avec
 *  une marge de dommage aléatoire tirée chaque soir (jamais trop d'un coup).
 *  `soirs` = nombre de soirs où le bar était OUVERT (fermé = pas d'usure).
 *  `facteur` = modulation par les traits (Maladroit = +25 % d'usure). */
export function userMachines(machines: Machine[], soirs = 7, facteur = 1): void {
  for (const m of machines) {
    if (m.etat !== "marche") continue;
    const base = USURE_PAR_MACHINE[m.id] ?? USURE_DEFAUT;
    let usure = 0;
    for (let soir = 0; soir < soirs; soir++) {
      usure += (base / 7) * (1 - USURE_VARIA + Math.random() * USURE_VARIA * 2);
    }
    m.hp = Math.max(0, Math.round(m.hp - usure * facteur));
  }
}

/** Coût de la réparation professionnelle (selon la machine). */
export function coutReparation(m: Machine): number {
  return COUT_REPARATION[m.id] ?? COUT_REPARATION_DEFAUT;
}

/** Coût de l'amélioration suivante (×1.25 par niveau déjà acquis). */
export function coutAmelioration(m: Machine): number {
  const base = PRIX_AMELIORATION[m.id] ?? 5000;
  return Math.round(base * Math.pow(1.25, m.niveau));
}

/** Applique une amélioration (à appeler après paiement). */
export function appliquerAmelioration(m: Machine): void {
  m.niveau += 1;
  m.bonusEfficacite = m.niveau * (BONUS_PAR_NIVEAU[m.id] ?? 0);
}

/** Remet une machine en marche (réparation réussie). */
export function reparerMachine(m: Machine): void {
  m.hp = 100;
  m.etat = "marche";
}
