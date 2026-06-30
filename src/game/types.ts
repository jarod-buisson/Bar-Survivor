// ============================================================
//  TYPES DU JEU — la "forme" de toutes les données de Bar Survival
//  (Ce fichier ne contient aucune logique, juste des définitions.)
// ============================================================

/** Niveaux de difficulté (voir GDD §2). */
export type Difficulty = "facile" | "moyen" | "difficile";

/** Type d'offre choisi en début de partie (voir GDD §3). */
export type OfferType = "populaire" | "premium";

/** Les grandes phases d'écran du jeu. */
export type Phase = "accueil" | "evenement" | "bilan" | "gameover" | "victoire";

/** Un salarié du bar (voir GDD §6). Chaque stat va de 0 à 100. */
export interface Employee {
  id: string;
  nom: string;
  role: string;
  emoji: string; // portrait provisoire (le pixel art viendra plus tard)
  salaire: number; // €/semaine
  moral: number; // ❤ tombe avec les mauvais choix
  competence: number; // 💪 influence le CA
  tolerance: number; // 😤 résistance aux situations difficiles
  loyaute: number; // ⚖ résistance au vol / procès / débauchage
  irrevocable?: boolean; // Maurice : contrat irrévocable, ne démissionne jamais
  demissionne?: boolean; // true si le salarié a quitté le bar
}

/** Jauges de stock (voir GDD §12). De 0 à 100. */
export interface Stocks {
  bieres: number;
  alcools: number;
}

/**
 * Un "effet" = ce qu'un choix modifie dans l'état du jeu.
 * Toutes les propriétés sont optionnelles : un choix ne touche
 * que ce dont il a besoin.
 */
export interface Effect {
  budget?: number; // € ajoutés (ou retirés si négatif)
  notoriete?: number; // points de notoriété (-/+)
  proprete?: number; // points de propreté (-/+)
  moralEquipe?: number; // moral appliqué à TOUTE l'équipe
  moralCible?: number; // moral du salarié concerné par l'événement
  salaireCible?: number; // modifie le salaire du salarié concerné (ex: augmentation)
  stockBieres?: number;
  stockAlcools?: number;
}

/** Un bouton de choix dans un événement (voir GDD §14). */
export interface Choice {
  label: string; // texte du bouton
  effet: Effect; // conséquences immédiates
  differe?: Effect; // conséquences différées (appliquées la semaine suivante)
  note?: string; // petit texte de retour affiché après le choix
}

/** Un événement narratif présenté au joueur. */
export interface GameEvent {
  id: string;
  cibleId?: string; // id du salarié concerné (pour le portrait + moralCible)
  titre: string;
  texte: string;
  choix: Choice[];
  unique?: boolean; // true = ne peut survenir qu'une fois par partie
  /** Condition d'apparition : reçoit l'état, renvoie true si l'événement est éligible. */
  condition?: (s: GameState) => boolean;
}

/** Le détail chiffré d'une fin de semaine (écran de bilan, GDD §15). */
export interface WeeklyRecap {
  semaine: number;
  chiffreAffaires: number;
  salaires: number;
  loyer: number;
  resultat: number; // CA - dépenses
  budgetApres: number;
}

/** L'état complet du jeu à un instant T. */
export interface GameState {
  difficulte: Difficulty;
  offre: OfferType;
  phase: Phase;

  semaine: number;
  budget: number;
  notoriete: number; // 0-100
  proprete: number; // 0-100
  stocks: Stocks;
  employes: Employee[];
  loyer: number; // loyer hebdomadaire courant

  // Déroulé des événements de la semaine en cours
  evenementParSemaine: number;
  evenementsJoues: number;
  evenementCourant?: GameEvent;

  uniquesUtilises: string[]; // ids des événements "unique" déjà vus
  effetsDifferes: Effect[]; // effets à appliquer au début de la prochaine semaine

  dernierBilan?: WeeklyRecap;
  journal: string[]; // petites lignes de retour ("Maurice +5 moral", etc.)
  raisonFin?: string; // texte affiché à l'écran de game over / victoire
}
