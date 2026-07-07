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
  | "lancement" // transition 2 s : les tuiles du hub s'aplatissent avant le service
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
  fonction?: Fonction; // salarié SPÉCIAL (Psy/Mécano) : ne fait pas le service, effet passif fort
}

/** Salariés « fonction » : hors service, à effet passif (voir engine). */
export type Fonction = "psychologue" | "mecano";

/** Niveau de prix appliqué à une ressource (menu Fournisseur et prix). */
export type NiveauPrix = "petit" | "moyen" | "gros";

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
  | "pourboire" // grosse enveloppe hebdo (valeur = plafond %, table de proba dans engine.ts)
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
  bonusEfficacite: number; // points de % de panier apportés par les améliorations (permanent, tous les soirs)
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
  causeSoiree?: string; // rappelée dans le texte de police via {cause} (ex. "votre soirée étudiante")
  resoudPoliceAvertissement?: boolean; // referme l'avertissement policier en cours (remet le compteur à zéro)
  declencherAmendePolice?: { pourcentage: number; fermeture: boolean }; // amende (% du CA de la semaine) + fermeture éventuelle la semaine suivante, résolue en fin de semaine
  stock?: Partial<Record<StockCategorie, number>>; // ajustements de stock par catégorie
  poseDrapeau?: { cle: string; valeur: number | boolean }; // mémorise un choix (cohérence)
  casseMachineAleatoire?: boolean; // casse une machine encore en état
  partenariatAmblam?: boolean; // signe le partenariat Amblam (CA réduit N semaines, cumul rendu ×2 ensuite)
  capaciteSoir?: number; // multiplicateur de capacité pour LE SOIR de l'événement uniquement (2 = double)
  caSoirPourcent?: number; // CA du soir de l'événement modifié en % (0.5 = +50 %), en plus de capaciteSoir
  capaciteLendemain?: number; // multiplicateur de capacité pour LE LENDEMAIN de l'événement (0.8 = -20 %, équipe qui traîne)
  fatiguePresentsJour?: number; // fatigue appliquée aux salariés PRÉSENTS (pas en repos) le soir de l'événement
  fumetteAyms?: boolean; // marque les présents ce soir-là : fatigue DOUBLÉE en fin de semaine (voir state.doubleFatigueFin)
  soireeLanela?: boolean; // marque les présents ce soir-là (sauf irrévocable) pour une démission forcée en fin de
  // semaine ; l'irrévocable (Antho) encaisse juste un coup de moral immédiat (voir state.demissionsForceesFin)
  ouvrirNegociationOlmo?: boolean; // marqueur intercepté par main.ts AVANT appliquerEffet : ouvre l'écran de
  // négociation à curseur (jamais résolu par le moteur directement, voir state.negociationOlmo)
  ouvrirConfigTacos?: boolean; // marqueur intercepté par main.ts AVANT appliquerEffet : ouvre l'écran de
  // configuration du tacos de Brisco (voir state.configTacos, engine.resoudreTacos)
  promoLoyer?: { semaines: number; taux: number }; // loyer × taux pendant N semaines (0 = gratuit, 0.5 = -50 %)
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
  /** Texte construit au moment du tirage (ex : montant annoncé cohérent avec `genererChoix`). Prioritaire sur `texte`. */
  genererTexte?: (s: GameState) => string;
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
  amblamPerte: number; // manque à gagner Amblam cette semaine (0 si pas de partenariat), DÉJÀ déduit du CA
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
  interetsLivret: number; // intérêts versés par le livret cette semaine (+7 % du placé)
  facteurMois: number; // multiplicateur CA de l'adéquation prix↔mois (1 = neutre), déjà inclus dans le CA
  moisNom: string; // nom du mois en cours (pour la ligne de bilan "prix bien vus / à côté")
  resultat: number; // CA - matières - dépenses + événements + intérêts livret
  budgetApres: number;
}

/** L'état complet du jeu à un instant T. */
export interface GameState {
  difficulte: Difficulty;
  offre: OfferType;
  phase: Phase;

  semaine: number;
  moisDepart?: number; // mois tiré au hasard au lancement (0 = Septembre) — décale MOIS_INFOS ; optionnel = compat sauvegardes
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
  /** Négociation en cours avec l'Olmo (curseur de contre-offre, voir "olmo_cut").
   *  plafondAccepte = 32 (40 avec un Mafieux dans l'équipe) ; au-delà, casse. */
  negociationOlmo?: { plafondAccepte: number; valeur: number };
  /** Commande du tacos de Brisco en cours de configuration (voir "brisco_tacos").
   *  Chaque valeur = index dans le tableau d'options correspondant (content.ts). */
  configTacos?: { viande: number; sauceFromagere: number; sauce: number; crudites: number };
  promoLoyerSemaines?: number; // semaines restantes de promo loyer (Brisco) ; 0/absent = pas de promo
  promoLoyerTaux?: number; // multiplicateur appliqué au loyer pendant la promo (0 = gratuit, 0.5 = -50 %)
  semainesBudgetHaut: number; // semaines CONSÉCUTIVES avec budget > 20 000 € (déclenche Mr Breton à 4)
  /** Notoriété au lancement de la semaine : sert à afficher au bilan la variation
   *  TOTALE (les événements modifient la notoriété en direct pendant l'animation). */
  notorieteDebutSemaine?: number;

  candidats: Employee[]; // candidats proposés à l'embauche (onboarding)
  cvRecus: CV[]; // CV reçus au fil des semaines (case CV du hub)
  jourAnim: number; // jour courant (1-7) pendant l'animation de la semaine

  machines: Machine[];
  niveauLocal: number; // taille du bar (0-3) : plafonne les clients/soir (case Travaux)
  joursEvenements: number[]; // jours (1-7) où un événement se déclenche cette semaine
  /** Boosts ponctuels posés par un événement sur UN jour précis (1-7) de la semaine
   *  en cours : capaciteMult multiplie la capacité du soir, caMult est ajouté (en %)
   *  au CA du soir. Remis à zéro à chaque planification de semaine. */
  boostsJour: Partial<Record<number, { capaciteMult: number; caMult: number }>>;
  doubleFatigueFin: string[]; // ids marqués par Ayms : fatigue ×2 en fin de semaine, puis vidé
  demissionsForceesFin: string[]; // ids marqués par Lanela : démission forcée en fin de semaine, puis vidé
  autoStockAchete: boolean; // machine "auto-stock" achetée (case Fournisseur, débloquée sem. 5)
  autoStockActif: boolean; // (hérité) ancien ON/OFF global — remplacé par les seuils par catégorie ci-dessous
  /** Seuil auto par catégorie (curseur gris) : en fin de semaine, si le stock est
   *  retombé sous ce seuil, l'auto-stock recomplète JUSQU'À ce seuil (plein tarif).
   *  0 / absent = auto-stock désarmé pour cette catégorie. Optionnel = compat vieilles sauvegardes. */
  autoStockSeuils?: Partial<Record<StockCategorie, number>>;
  /** 💰 Livret : argent placé à la banque (bloqué à vie), rapporte +7 %/sem au budget.
   *  Optionnel = compat vieilles sauvegardes. */
  livret?: number;
  /** Prix choisi par ressource (menu Fournisseur et prix). Absent = "moyen".
   *  Combiné à l'attente du mois (calendrier) pour piloter le CA. Optionnel = compat sauvegardes. */
  prix?: Partial<Record<StockCategorie, NiveauPrix>>;
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
  policeEnAttenteCause?: string; // rappelle au joueur quelle soirée a causé la venue de la police ({cause})
  semaineEquipe3?: number; // semaine où l'équipe a atteint 3 salariés pour la première fois (déclenche vieux_manoir)
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
