// ============================================================
//  TYPES DU JEU — la "forme" de toutes les données de Bar Survival
//  (Ce fichier ne contient aucune logique, juste des définitions.)
// ============================================================

/** Niveaux de difficulté (voir GDD §2). */
export type Difficulty = "facile" | "moyen" | "difficile";

/** Type d'offre choisi en début de partie (voir GDD §3). */
export type OfferType = "populaire" | "premium";

/** Les grandes phases d'écran du jeu. */
export type Phase =
  | "accueil" // choix difficulté + offre
  | "presentation" // découverte du salarié de base (Antho)
  | "embauche" // on embauche jusqu'à 3 candidats aléatoires
  | "semaine" // animation de chargement : les 7 jours défilent
  | "evenement" // événement à choix pendant le service
  | "recapPopup" // pop-up de bilan de fin de semaine
  | "alerte" // pop-up d'avertissement quand la semaine finit dans le rouge
  | "hub" // menu de gestion entre les semaines (Phase 2)
  | "gameover"
  | "victoire";

/** Un salarié du bar (voir GDD §6). Chaque stat va de 0 à 100. */
export interface Employee {
  id: string;
  nom: string;
  emoji: string; // portrait provisoire (le pixel art viendra plus tard)
  salaire: number; // €/semaine
  moral: number; // ❤ tombe avec les mauvais choix
  competence: number; // 💪 monte le ticket moyen des soirs où il travaille (PANIER_COMP)
  fatigue: number; // 😮‍💨 0-100 : monte quand il travaille, descend au repos
  semaineEmbauche: number; // semaine d'arrivée dans l'équipe (ancienneté)
  semaineAugmentation?: number; // semaine de la dernière augmentation accordée
  vacances?: "posees" | "encours"; // posées = accordées (départ semaine prochaine), encours = en vacances
  reposAvantVacances?: boolean[]; // planning de repos à restaurer au retour de vacances
  vacancesRefus?: number; // 0 = jamais refusé, 1 = refusé une fois (revient menacer), 2+ = procès enclenché
  vacancesRefusSemaine?: number; // semaine du dernier refus (évite qu'un refus déclenche la suite la même semaine)
  maladie?: boolean; // trait Fragile : malade cette semaine → 2 jours d'arrêt imposés la suivante
  reposJours: boolean[]; // 7 cases (Lun→Dim) : true = jour de repos planifié
  joursSansRepos: number; // jours travaillés enchaînés sans 2 jours de repos consécutifs
  reposConsecutifs: number; // jours de repos consécutifs en cours (2 → compteur remis à 0)
  forces: string[]; // ids de Trait (tirés à la création)
  faiblesses: string[]; // ids de Trait (dépressif peut s'ajouter en cours de partie)
  irrevocable?: boolean; // Antho : ne peut pas être licencié (mais peut démissionner à bout)
  demissionne?: boolean; // true si le salarié a quitté le bar (démission ou licenciement)
}

/** Un CV reçu (candidat potentiel) dans la case CV du hub. Les traits seront
 *  attribués plus tard ; `faiblessesMasquees` floute les faiblesses d'un CV
 *  pour laisser une part d'inconnu au joueur. */
export interface CV {
  profil: Employee; // le candidat (traits vides pour l'instant)
  faiblessesMasquees: boolean; // true = faiblesses cachées sur ce CV (aléa)
}

// ============================================================
//  FORCES & FAIBLESSES DES SALARIÉS (refonte v0.4)
//  Catalogue + tirage : voir traits.ts. Ici, juste la "forme".
//  Les effets sont chiffrés (paramétrés) pour être branchés au
//  moteur plus tard sans réécrire le catalogue.
// ============================================================

/** Rareté d'un trait : pilote la fréquence de tirage (voir POIDS_RARETE). */
export type Rarete = "commun" | "rare" | "legendaire";

/** Le levier de jeu qu'un trait modifie une fois branché au moteur. */
export type CibleEffet =
  | "ca" // panier / chiffre d'affaires (multiplicateur relatif)
  | "capacite" // efficacité de service = clients servis (multiplicateur relatif)
  | "conso" // consommation de stock (multiplicateur relatif ; négatif = économe)
  | "cogs" // coût matières (multiplicateur relatif ; négatif = moins cher)
  | "usureMachine" // usure hebdo des machines (multiplicateur relatif)
  | "notoriete" // notoriété (points / semaine)
  | "proprete" // propreté (points / semaine)
  | "moralEquipe" // moral des AUTRES salariés (points / semaine)
  | "reparation" // répare une machine abîmée en cours de semaine (valeur = proba)
  | "fatigue" // vitesse d'accumulation de la fatigue (multiplicateur relatif)
  | "vol" // détourne caisse/stock (chance = proba/soir, valeur = part max du CA)
  | "drame" // perte du salarié + frais (dépressif → suicide) : valeur = frais €, chance = proba/sem
  | "bagarre" // évite des bagarres (levier événements, à venir)
  | "mafia" // négocie avec la mafia (levier mafia, à venir)
  | "tirage" // chanceux : bonus passif de proba sur les tirages de la pinte
  | "pourboire" // pourboires aléatoires par soir (valeur = max €, chance = proba/soir)
  | "achat" // remise sur les commandes fournisseur (relatif ; négatif = moins cher)
  | "weekend" // bonus de rendement personnel les vendredis/samedis (relatif)
  | "mentor" // bonus de capacité pour les COLLÈGUES présents le même soir (relatif)
  | "maladie" // fragile : arrêt forcé (valeur = jours, chance = proba/sem)
  | "retard" // retardataire : malus le lendemain d'un repos (relatif, négatif)
  | "peur" // trouillard : refuse d'aider les tirages risqués ☠
  | "rancune" // rancunier : multiplicateur des malus de moral ciblés
  | "pari"; // joueur : ponction visible de la caisse (valeur = max €, chance = proba/sem)

/** Effet chiffré d'un trait. Le sens de `valeur` dépend de `cible` (voir ci-dessus). */
export interface TraitEffet {
  cible: CibleEffet;
  valeur: number; // +0.10 = +10 % (relatif) OU +3 = +3 points (additif)
  chance?: number; // proba d'occurrence 0–1, pour les effets aléatoires (vol…)
}

/** Une force ou une faiblesse qu'un salarié peut posséder. */
export interface Trait {
  id: string;
  nom: string;
  emoji: string;
  type: "force" | "faiblesse";
  rarete: Rarete;
  description: string; // texte lisible (tooltip)
  effet: TraitEffet; // effet chiffré, branché au moteur plus tard
  dormant?: boolean; // défini mais pas encore tiré/branché (levier pas prêt)
  emergent?: boolean; // jamais tiré à l'embauche ; apparaît via un déclencheur de jeu
}

/** Catégories de produits vendus au bar (par volume de vente décroissant). */
export type StockCategorie = "bieres" | "cocktails" | "repas" | "softs" | "chaudes" | "vin";

/** Jauges de stock (0 à 100) pour chaque catégorie. */
export type Stocks = Record<StockCategorie, number>;

/** Une machine du bar (voir GDD §11). */
export interface Machine {
  id: string;
  nom: string;
  emoji: string;
  hp: number; // points de vie 0-100, baissent chaque semaine (pilote le risque de panne)
  etat: "marche" | "panne"; // en marche = compte dans l'efficacité ; en panne = à réparer
  niveau: number; // niveau d'amélioration (0 = de base)
  bonusEfficacite: number; // points d'efficacité apportés par les améliorations
}

/** Un prêt bancaire en cours (voir GDD §4). */
export interface Pret {
  montant: number; // somme empruntée
  restant: number; // reste à rembourser
  parSemaine: number; // déduit chaque semaine
  semainesRestantes: number;
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
  fatigueEquipe?: number; // fatigue appliquée à TOUTE l'équipe (+/-)
  moralCible?: number; // moral du salarié concerné par l'événement
  fatigueCible?: number; // fatigue du salarié concerné (+/-)
  salaireCible?: number; // modifie le salaire du salarié concerné (ex: augmentation)
  augmentationCible?: number; // augmentation €/sem du salarié concerné (mémorise la semaine)
  vacancesCible?: boolean; // accorde une semaine de vacances au salarié concerné (semaine suivante)
  ajusterVacancesRefus?: number; // modifie le compteur de refus de vacances du salarié concerné (escalade vers le procès)
  demissionCible?: boolean; // fait démissionner immédiatement le salarié concerné (procès perdu ou gagné)
  moralEquipePourcent?: number; // moral de TOUTE l'équipe modifié en % de sa valeur actuelle (ex: -0.20 = -20 %)
  budgetPourcentage?: number; // budget modifié en % de sa valeur actuelle (ex: -0.5 = perd la moitié de la caisse)
  grosseSoiree?: boolean; // marque un choix "grosse soirée" acceptée : déclenche la venue de la police la semaine suivante
  resoudPoliceAvertissement?: boolean; // referme l'avertissement policier en cours (remet le compteur à zéro)
  declencherAmendePolice?: { pourcentage: number; fermeture: boolean }; // amende (% du CA de la semaine) + fermeture éventuelle la semaine suivante, résolue en fin de semaine
  stock?: Partial<Record<StockCategorie, number>>; // ajustements de stock par catégorie
  poseDrapeau?: { cle: string; valeur: number | boolean }; // mémorise un choix (cohérence)
  casseMachineAleatoire?: boolean; // casse une machine encore en état
  partenariatAmblam?: boolean; // signe le partenariat Amblam (CA réduit N semaines, cumul rendu ×2 ensuite)
  note?: string; // ligne ajoutée au journal (visible au récap)
  /** Pari : `proba` de déclencher `succes`, sinon `echec`. Permet les choix risqués.
   *  `risque: true` = la branche `succes` est une MAUVAISE nouvelle (racket, amende…) :
   *  l'animation de tirage affiche alors la zone en rouge (menace) au lieu de doré (gain).
   *  `aide` = id d'une FORCE (traits.ts) : un salarié présent qui la possède peut être
   *  glissé sur le choix pour booster la proba (+20 pts, ou menace ☠ -20 pts). */
  tirage?: { proba: number; succes: Effect; echec: Effect; risque?: boolean; aide?: string };
}

/** Un bouton de choix dans un événement (voir GDD §14). */
export interface Choice {
  label: string; // texte du bouton
  effet: Effect; // conséquences immédiates
  cibleId?: string; // salarié visé par CE choix (prioritaire sur GameEvent.cibleId)
  differe?: Effect; // conséquences différées (appliquées la semaine suivante)
  /** Peut déclencher un AUTRE événement le même soir (ex : vomi après la soirée
   *  étudiante). Tiré dans appliquerChoix, ouvert à la fermeture du pop-up courant.
   *  `texte` remplace celui de l'événement enchaîné (contexte narratif). */
  enchaine?: { id: string; proba: number; texte?: string };
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
  cooldown?: number; // semaines mini avant de pouvoir revenir (défaut : COOLDOWN_EVENEMENT)
  priorite?: boolean; // true = passe devant les autres événements éligibles (ex : demande de vacances)
  /** Condition d'apparition : reçoit l'état, renvoie true si l'événement est éligible. */
  condition?: (s: GameState) => boolean;
  /** Cible choisie au tirage (portrait + effets *Cible). Si elle renvoie undefined, l'événement est sauté. */
  choisirCible?: (s: GameState) => string | undefined;
  /** Choix construits au moment du tirage (ex : un bouton par salarié). Prioritaire sur `choix`. */
  genererChoix?: (s: GameState, cibleId?: string) => Choice[];
}

/** Le CA d'un soir : modèle clients servis × panier moyen. */
export interface JourCA {
  jour: string; // "Lun", "Mar"...
  ca: number; // clients servis × panier
  clients: number; // clients réellement servis ce soir
  demande: number; // clients qui voulaient venir
  refuses: number; // demande non servie (capacité insuffisante)
  efficacite: number; // efficacité ce soir-là (0-100) = capacité de service
  panier: number; // ticket moyen ce soir (€)
  pannes: string[]; // noms des machines tombées en panne CE soir
  ferme?: boolean; // true = bar fermé ce jour (repos) : aucun client, aucun malus
}

/** Une ligne de salaire individuelle dans le récap. */
export interface SalaireLigne {
  nom: string;
  montant: number;
}

/** Le détail chiffré d'une fin de semaine (écran de bilan, GDD §15). */
export interface WeeklyRecap {
  semaine: number;
  jours: JourCA[]; // détail soir par soir
  chiffreAffaires: number; // somme des 7 soirs (clients × panier)
  clientsTotal: number; // clients servis sur la semaine
  refusesTotal: number; // clients refusés faute de capacité
  matieres: number; // coût des matières (boissons vendues), déduit du CA
  ruptures: string[]; // catégories à sec au début de la semaine (noms)
  notorDelta: number; // variation de réputation cette semaine (+/-)
  notes: string[]; // événements humains de la semaine (repos, fatigue, démissions…)
  salairesDetail: SalaireLigne[]; // salaire par salarié
  salaires: number; // total
  heuresSup: number; // surcoût des heures supplémentaires (jours enchaînés sans repos)
  loyer: number;
  charges: number; // charges & taxes fixes
  detteRemboursement: number; // emprunt initial remboursé cette semaine
  remboursement: number; // prêt bancaire remboursé cette semaine (0 si aucun)
  inflation: number; // charges croissantes du mode infini (0 tant qu'on rembourse)
  evenements: number; // impact € des événements & imprévus (déjà payé au fil de la semaine)
  resultat: number; // CA - matières - dépenses + événements
  budgetApres: number;
}

/** L'état complet du jeu à un instant T. */
export interface GameState {
  difficulte: Difficulty;
  offre: OfferType;
  phase: Phase;

  semaine: number;
  budget: number;
  nomBar: string; // choisi à l'onboarding, affiché en titre du hub
  detteInitiale: number; // emprunt choisi au départ (curseur de l'onboarding)
  presentationEtape: number; // carte courante de l'onboarding (1-4)
  notoriete: number; // 0-100
  proprete: number; // 0-100
  stocks: Stocks;
  employes: Employee[];
  loyer: number; // loyer hebdomadaire courant

  // Déroulé des événements de la semaine en cours
  evenementsJoues: number;
  evenementCourant?: GameEvent;

  uniquesUtilises: string[]; // ids des événements "unique" déjà vus
  effetsDifferes: Effect[]; // effets à appliquer au début de la prochaine semaine
  evenementsBudget: number; // € gagnés/perdus via événements & imprévus depuis le dernier bilan
  evenementsVus: Record<string, number>; // id → semaine de dernière apparition (anti-répétition)
  /** Événement à ouvrir juste après la fermeture du pop-up courant (Choice.enchaine gagné). */
  evenementEnchaine?: { id: string; texte?: string };
  /** Partenariat Amblam en cours : CA amputé chaque semaine, cumul rendu ×2 à l'échéance. */
  partenariatAmblam?: { semainesRestantes: number; cumule: number };
  /** Tirage de chance en cours (animation de la pinte) : résultat déjà tiré, appliqué au « Continuer ».
   *  `proba` est la proba EFFECTIVE (déjà boostée si un salarié aide, affiché via `aide`). */
  tirageEnCours?: {
    index: number;
    gagne: boolean;
    proba: number;
    risque: boolean;
    aide?: { nom: string; emoji: string };
  };
  /** Salarié glissé sur un choix de l'événement courant pour booster son tirage. */
  aideEvenement?: { employeId: string; choixIndex: number };
  /** Notoriété au lancement de la semaine : sert à afficher au bilan la variation
   *  TOTALE (les événements modifient la notoriété en direct pendant l'animation). */
  notorieteDebutSemaine?: number;

  candidats: Employee[]; // candidats proposés à l'embauche (onboarding)
  cvRecus: CV[]; // CV reçus au fil des semaines (case CV du hub)
  jourAnim: number; // jour courant (1-7) pendant l'animation de la semaine

  machines: Machine[];
  niveauLocal: number; // taille du bar (0-3) : plafonne les clients/soir (case Travaux)
  joursEvenements: number[]; // jours (1-7) où un événement se déclenche cette semaine
  pret?: Pret;
  detteRestant: number; // emprunt initial restant à rembourser
  detteJusteSoldee?: boolean; // vrai la semaine où la dette vient d'être soldée
  semaineVictoire?: number; // semaine où la dette a été remboursée (déclenche la victoire)
  modeInfini: boolean; // après victoire : la partie continue, la pression monte
  reparTentees: string[]; // ids de machines déjà tentées par l'ingénieur cette semaine
  drapeaux: Record<string, number | boolean>; // mémoire des choix (cohérence)

  /** Police (tapage suite à une grosse soirée) : "avertissement" = 1er passage sans frais,
   *  "proces" = 2e passage, tirage 50/50 (amende, éventuellement fermeture). */
  policeEnAttente?: "avertissement" | "proces";
  policeEnAttenteSemaine?: number; // semaine où la grosse soirée a eu lieu (la police ne passe qu'à partir de la semaine suivante)
  policeAvertissementFait?: boolean; // true = le 1er avertissement a déjà eu lieu (prochaine grosse soirée = procès direct)
  amendePoliceEnAttente?: { pourcentage: number; fermeture: boolean }; // amende à appliquer en fin de semaine (résolue une fois le CA connu)
  barFerme?: boolean; // fermeture en cours (police OU travaux) : aucun client, aucune gestion possible, salaires/charges dus quand même
  barFermeRaison?: "police" | "travaux"; // pourquoi le bar est fermé cette semaine (affichage du hub)
  barFermeProchaine?: boolean; // fermeture décidée (procès policier perdu), prend effet la semaine suivante

  menuOuvert?: string; // dans le hub : id du menu ouvert (ou rien = grille)

  dernierBilan?: WeeklyRecap;
  historique: WeeklyRecap[]; // tous les bilans passés (menu Historique)
  journal: string[]; // ce qu'il s'est passé dans la semaine (liste du récap)
  raisonFin?: string; // texte affiché à l'écran de game over / victoire
}

/** Niveau d'alerte d'une tuile du hub (`gris` = rien à faire ici). */
export type Statut = "rouge" | "orange" | "vert" | "gris";
