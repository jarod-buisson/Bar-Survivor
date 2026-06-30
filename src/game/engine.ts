// ============================================================
//  MOTEUR DU JEU — toute la logique de Bar Survival
//  Les fonctions exportées sont appelées par l'interface (main.ts).
//  Elles MODIFIENT l'état `state` reçu en argument.
// ============================================================

import type {
  Choice,
  Difficulty,
  Effect,
  Employee,
  GameState,
  OfferType,
} from "./types";
import { EVENEMENTS, equipeDeDepart } from "./content";

// ---- Réglages économiques (faciles à ajuster pour équilibrer le jeu) ----

const BUDGET_INITIAL: Record<Difficulty, number> = {
  facile: 100_000,
  moyen: 75_000,
  difficile: 50_000,
};

const EVENEMENTS_PAR_SEMAINE: Record<Difficulty, number> = {
  facile: 2,
  moyen: 3,
  difficile: 4,
};

const MULT_DIFFICULTE: Record<Difficulty, number> = {
  facile: 1.0,
  moyen: 1.15,
  difficile: 1.3,
};

const MULT_OFFRE: Record<OfferType, number> = {
  populaire: 1.0,
  premium: 1.25,
};

const CA_BASE = 12_000; // chiffre d'affaires "plein" avant application des facteurs
const LOYER_INITIAL = 1_200;
const CONSO_BIERES = 35; // baisse de stock bière par semaine
const CONSO_ALCOOLS = 20; // baisse de stock alcool par semaine

// ---- Petits utilitaires ----

/** Garde une valeur entre 0 et 100. */
function borne(v: number): number {
  return Math.max(0, Math.min(100, v));
}

/** Salariés encore présents (non démissionnés). */
function actifs(s: GameState): Employee[] {
  return s.employes.filter((e) => !e.demissionne);
}

// ---- Création d'une partie ----

export function creerPartie(difficulte: Difficulty, offre: OfferType): GameState {
  const state: GameState = {
    difficulte,
    offre,
    phase: "evenement",
    semaine: 1,
    budget: BUDGET_INITIAL[difficulte],
    notoriete: 50,
    proprete: 70,
    stocks: { bieres: 100, alcools: 100 },
    employes: equipeDeDepart(),
    loyer: LOYER_INITIAL,
    evenementParSemaine: EVENEMENTS_PAR_SEMAINE[difficulte],
    evenementsJoues: 0,
    uniquesUtilises: [],
    effetsDifferes: [],
    journal: [],
  };
  tirerEvenement(state);
  return state;
}

// ---- Sélection d'un événement ----

function tirerEvenement(state: GameState): void {
  const candidats = EVENEMENTS.filter((e) => {
    if (e.unique && state.uniquesUtilises.includes(e.id)) return false;
    if (e.condition && !e.condition(state)) return false;
    return true;
  });
  // Sécurité : s'il n'y a aucun candidat (rare), on reprend toute la liste.
  const pool = candidats.length > 0 ? candidats : EVENEMENTS;
  const ev = pool[Math.floor(Math.random() * pool.length)];
  state.evenementCourant = ev;
  state.phase = "evenement";
}

// ---- Application d'un effet sur l'état ----

function appliquerEffet(state: GameState, effet: Effect, cibleId?: string): void {
  if (effet.budget) state.budget += effet.budget;
  if (effet.notoriete) state.notoriete = borne(state.notoriete + effet.notoriete);
  if (effet.proprete) state.proprete = borne(state.proprete + effet.proprete);

  if (effet.moralEquipe) {
    for (const e of actifs(state)) e.moral = borne(e.moral + effet.moralEquipe);
  }

  if (cibleId) {
    const cible = state.employes.find((e) => e.id === cibleId && !e.demissionne);
    if (cible) {
      if (effet.moralCible) cible.moral = borne(cible.moral + effet.moralCible);
      if (effet.salaireCible) cible.salaire += effet.salaireCible;
    }
  }

  if (effet.stockBieres) state.stocks.bieres = borne(state.stocks.bieres + effet.stockBieres);
  if (effet.stockAlcools) state.stocks.alcools = borne(state.stocks.alcools + effet.stockAlcools);
}

/** Marque les salariés à moral 0 comme démissionnaires (sauf Maurice). */
function gererDemissions(state: GameState): void {
  for (const e of state.employes) {
    if (!e.demissionne && !e.irrevocable && e.moral <= 0) {
      e.demissionne = true;
      state.journal.push(`💔 ${e.nom} a démissionné (moral à 0).`);
    }
  }
}

// ---- Le joueur fait un choix ----

export function choisir(state: GameState, indexChoix: number): void {
  const ev = state.evenementCourant;
  if (!ev) return;
  const choix: Choice | undefined = ev.choix[indexChoix];
  if (!choix) return;

  // Cas spécial : accepter le rachat => victoire immédiate.
  if (ev.id === "rachat_investisseur" && indexChoix === 0) {
    state.phase = "victoire";
    state.raisonFin = "Tu as accepté le rachat. Tu t'en es sorti ! 🎉";
    return;
  }

  // Cas spécial : envoyer Benji à la bagarre alors qu'il est parti.
  let effet = choix.effet;
  let note = choix.note;
  if (ev.id === "bagarre" && indexChoix === 0) {
    const benji = state.employes.find((e) => e.id === "benji" && !e.demissionne);
    if (!benji) {
      effet = { budget: -500, notoriete: -10 };
      note = "Personne pour gérer la bagarre : dégâts et mauvaise presse.";
    }
  }

  appliquerEffet(state, effet, ev.cibleId);
  if (choix.differe) state.effetsDifferes.push(choix.differe);
  if (ev.unique) state.uniquesUtilises.push(ev.id);
  if (note) state.journal.push(note);

  gererDemissions(state);

  state.evenementsJoues += 1;
  if (state.evenementsJoues >= state.evenementParSemaine) {
    terminerSemaine(state);
  } else {
    tirerEvenement(state);
  }
}

// ---- Fin de semaine : calcul du chiffre d'affaires et du bilan ----

function moyenneMoral(state: GameState): number {
  const eq = actifs(state);
  if (eq.length === 0) return 0;
  return eq.reduce((somme, e) => somme + e.moral, 0) / eq.length;
}

function terminerSemaine(state: GameState): void {
  const moralMoyen = moyenneMoral(state);
  const stockMoyen = (state.stocks.bieres + state.stocks.alcools) / 2;

  // Formule du GDD §4 :
  // CA = (moral/100) × (stock/100) × (notoriété/100) × mult. difficulté × mult. offre
  const chiffreAffaires = Math.round(
    CA_BASE *
      (moralMoyen / 100) *
      (stockMoyen / 100) *
      (state.notoriete / 100) *
      MULT_DIFFICULTE[state.difficulte] *
      MULT_OFFRE[state.offre],
  );

  const salaires = actifs(state).reduce((somme, e) => somme + e.salaire, 0);
  const loyer = state.loyer;
  const resultat = chiffreAffaires - salaires - loyer;

  state.budget += resultat;

  state.dernierBilan = {
    semaine: state.semaine,
    chiffreAffaires,
    salaires,
    loyer,
    resultat,
    budgetApres: state.budget,
  };

  // Consommation des stocks pendant la semaine écoulée.
  state.stocks.bieres = borne(state.stocks.bieres - CONSO_BIERES);
  state.stocks.alcools = borne(state.stocks.alcools - CONSO_ALCOOLS);

  state.phase = "bilan";
  verifierGameOver(state);
}

// ---- Commander des stocks chez Armand (depuis l'écran de bilan) ----

/** Coût pour remettre les deux stocks à 100. Renvoie false si budget insuffisant. */
export function coutReassort(state: GameState): number {
  return Math.round((100 - state.stocks.bieres) * 8 + (100 - state.stocks.alcools) * 10);
}

export function commanderStocks(state: GameState): boolean {
  const cout = coutReassort(state);
  if (cout <= 0) return false; // déjà plein
  if (state.budget < cout) {
    state.journal.push("Budget insuffisant pour commander chez Armand.");
    return false;
  }
  state.budget -= cout;
  state.stocks.bieres = 100;
  state.stocks.alcools = 100;
  return true;
}

// ---- Passage à la semaine suivante ----

export function semaineSuivante(state: GameState): void {
  state.semaine += 1;

  // Effets différés (conséquences de la semaine précédente).
  for (const effet of state.effetsDifferes) appliquerEffet(state, effet);
  state.effetsDifferes = [];

  // Rupture de stock : pénalité de moral.
  if (state.stocks.bieres <= 0 || state.stocks.alcools <= 0) {
    appliquerEffet(state, { moralEquipe: -5 });
    state.journal.push("⚠ Rupture de stock : moral de l'équipe en baisse.");
  }

  // Escalade (GDD §10) : loyer +10 % toutes les 5 semaines.
  if ((state.semaine - 1) % 5 === 0) {
    state.loyer = Math.round(state.loyer * 1.1);
  }
  // Escalade : +1 événement toutes les 4 semaines.
  state.evenementParSemaine =
    EVENEMENTS_PAR_SEMAINE[state.difficulte] + Math.floor((state.semaine - 1) / 4);

  gererDemissions(state);
  verifierGameOver(state);
  if (state.phase === "gameover") return;

  // Nouvelle semaine : on repart à zéro côté événements et journal.
  state.evenementsJoues = 0;
  state.journal = [];
  tirerEvenement(state);
}

// ---- Conditions de défaite ----

function verifierGameOver(state: GameState): void {
  if (state.budget <= 0) {
    state.phase = "gameover";
    state.raisonFin = "Faillite : le budget est tombé à 0 €.";
    return;
  }
  if (actifs(state).length === 0) {
    state.phase = "gameover";
    state.raisonFin = "Plus aucun salarié : le bar ne peut plus tourner.";
  }
}
