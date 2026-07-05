// ============================================================
//  MOTEUR DU JEU — toute la logique de Bar Survival (v0.3).
//  Les fonctions exportées sont appelées par l'interface (main.ts).
//  Elles MODIFIENT l'état `state` reçu en argument.
//  Aucune animation/timer ici : c'est le rôle de main.ts.
// ============================================================

import type {
  Choice,
  Difficulty,
  Effect,
  Employee,
  GameState,
  JourCA,
  OfferType,
  Statut,
  StockCategorie,
  Stocks,
  WeeklyRecap,
} from "./types";
import {
  CATEGORIES_STOCK,
  EVENEMENTS,
  equipeDeDepart,
  genererCV,
  genererCandidats,
  salarieVacancesMenace,
  salarieVacancesProces,
  stocksPleins,
} from "./content";
import {
  NIVEAU_MAX,
  appliquerAmelioration,
  facteurMachines,
  rendementMachine,
  coutAmelioration,
  coutReparation,
  machinesDeDepart,
  probaPanne,
  reparerMachine,
  userMachines,
} from "./machines";
import { aTrait, bonusPassif, trait } from "./traits";

// ---- Réglages (faciles à ajuster pour équilibrer) ----

const BUDGET_INITIAL: Record<Difficulty, number> = {
  facile: 5_000,
  moyen: 4_000,
  difficile: 3_000,
};

// Fréquence des événements : 0-2 par semaine, tirés au hasard dans
// planifierEvenements (plus de dépendance à la difficulté ni d'escalade).
const COOLDOWN_EVENEMENT = 10; // un même événement ne revient pas avant N semaines
const PRIX_AMI_PANIER = 0.98; // drapeau "prix_ami" : panier moyen -2 % (événement Habitué)
// Aide au tirage : glisser un salarié dont la FORCE correspond au besoin du
// choix (`tirage.aide`) booste la proba de +20 pts (ou réduit la menace ☠ de
// 20 pts), bornée 5-95 %. Le coup de main fatigue le salarié.
const AIDE_BOOST = 0.2;
const AIDE_FATIGUE = 5;

const LOYER_INITIAL = 1_300;
const LOYER_HAUSSE = 100; // +100 € toutes les 5 semaines (linéaire — PAS exponentiel)
const CHARGES = 900; // charges & taxes fixes chaque semaine
const DETTE_INITIALE = 100_000; // emprunt maxi (et défaut) à rembourser au départ
// Curseur d'emprunt de l'onboarding : de 0 à DETTE_INITIALE par crans de 10 k€.
// Petit emprunt = partie courte, gros emprunt = long à rembourser (plus dur).
export const EMPRUNT_MAX = DETTE_INITIALE;
export const EMPRUNT_PAS = 10_000;
const NB_CANDIDATS = 3;
const CV_MAX = 4; // nombre max de CV en attente dans la case CV
const CV_SEMAINE_DEBUT = 4; // les CV commencent à arriver à partir de cette semaine

// ---- Fatigue, repos & fermeture (chantier A) ----
const FATIGUE_JOUR_TRAVAIL = 4.5; // fatigue gagnée par jour travaillé (5j+2j repos ≈ +6/sem net, contre +9 avant)
const FATIGUE_JOUR_REPOS = 8; // fatigue récupérée par jour de repos
// Équilibre voulu : 5j travail + 2j repos = +9 de fatigue/sem (elle monte, lentement).
// Seule une vraie coupure (vacances : 7j de repos = -56) remet un salarié à neuf.
const MORAL_JOUR_REPOS = 3; // moral gagné par jour de repos
const MORAL_MALUS_HEURES_SUP = 4; // moral perdu PAR jour au-delà de 5 jours travaillés
const MORAL_MALUS_EPUISE = 5; // moral perdu en fin de semaine si fatigue ≥ 80
const FERMETURE_TOLEREE = 2; // jours de fermeture/semaine sans impact notoriété
const NOTOR_MALUS_FERMETURE = 2; // notoriété perdue PAR jour fermé au-delà du toléré
const SEUIL_DEMISSION_FATIGUE = 90; // à partir de là (et moral bas), risque de démission
const SEUIL_DEMISSION_MORAL = 25;
const PROBA_DEMISSION = 0.4; // proba/semaine de démission d'un salarié à bout
const LICENCIEMENT_SEMAINES = 10; // indemnité de licenciement = 10 semaines de salaire

// Heures supplémentaires : au-delà de JOURS_STANDARD jours enchaînés SANS
// 2 jours de repos consécutifs, chaque jour travaillé coûte un surcoût qui
// grimpe de niveau en niveau (6e jour = niv 1, 7e = niv 2, puis 3, 4, 5…).
// Surcoût d'un jour = niveau × HEURES_SUP_RATIO × salaire journalier.
const JOURS_STANDARD = 5; // jours enchaînés "gratuits" avant heures sup
const REPOS_RESET = 2; // jours de repos CONSÉCUTIFS pour remettre le compteur à zéro
const HEURES_SUP_RATIO = 0.25; // part du salaire journalier facturée PAR niveau

// ---- Travaux : taille du local ----
// Le local plafonne les clients/soir, quelle que soit l'efficacité de service.
// Agrandir coûte un « gros coup » : c'est le puits à argent du mid-game.
const CAPACITE_LOCAL = [150, 200, 260, 330]; // clients/soir max par niveau (0-3)
const COUT_TRAVAUX = [8_000, 18_000, 40_000]; // prix du passage au niveau suivant

// ---- Traits (chantier B) ----
// Les valeurs/probas des traits vivent dans traits.ts (effet chiffré).
// Ici : seulement les réglages du trait ÉMERGENT « dépressif ».
const SEUIL_DEPRESSION_MORAL = 25; // moral sous lequel la dépression peut s'installer
const PROBA_DEPRESSION = 0.3; // proba/semaine de devenir dépressif si moral trop bas
const JOURS_LONGS = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

// ---- Modèle économique « bottom-up » : CA = clients servis × panier ----
// (tout est regroupé ici pour équilibrer facilement)
const CLIENTELE_BASE = 100; // clients de référence un soir neutre (quartier)
// Départ doux : à 40 de notoriété la demande vaut 80 % du normal → le bar n'est
// jamais plein en semaine 1 avec le seul Antho (capacité ≈ 126 clients/soir).
// La réputation grimpe de +2/sem quand on sert tout le monde → retour à 50
// vers la semaine 6, pile quand l'échéance de dette passe de 500 à 1 500 €.
const NOTORIETE_INITIALE = 40;
const CLIENTS_PAR_POINT = 3.0; // clients qu'1 point d'efficacité permet de servir
const PANIER_BASE = 15.3; // ticket moyen € AVANT bonus de compétence (voir PANIER_COMP)
// 💪 Une équipe compétente VEND mieux (suggestion cocktail, dessert, fidélisation) :
// chaque salarié présent le soir monte le ticket moyen de PANIER_COMP × compétence/100,
// pondéré par sa fatigue. Antho seul ≈ ×1.05 (≈ l'ancien panier de 16 €) — neutre en
// début de partie ; une équipe de 3 ≈ +9 % : embaucher rapporte aussi hors saturation.
export const PANIER_COMP = 0.06;
// Plafond de la Σ compétence/100 des présents (v0.9) : au-delà de l'équipe qui
// sature le LOCAL ACTUEL, un salarié de plus n'apporte plus RIEN au panier (juste
// de la fiabilité de planning). Sans ce plafond, empiler des salariés restait
// rentable à l'infini via le panier seul. Le plafond grandit PROPORTIONNELLEMENT
// au local : 2.4 (~3-4 salariés) au local de départ (150), jusqu'à ~5.3 (~9-10
// salariés) au local maxé (330) — les Travaux justifient une équipe plus grosse,
// le cap ne doit pas figer la partie à "jamais plus de 3 salariés".
const COMP_PRESENTE_MAX_BASE = 2.4;
function compPresenteMax(state: GameState): number {
  return COMP_PRESENTE_MAX_BASE * (capaciteLocale(state) / CAPACITE_LOCAL[0]);
}
// Un bar réputé fait payer un peu plus cher (et vend plus de cocktails) :
// chaque point de notoriété AU-DESSUS de 50 monte le panier, jusqu'à ×1.2 à 100.
// C'est LE moteur de bénéfices du late game — la réputation doit payer.
const PANIER_NOTOR = 0.4;
const PANIER_VARIA = 0.1; // ±10 % d'aléa sur le panier, chaque soir
const ALEA_SOIR = 0.15; // ±15 % d'aléa sur la demande, chaque soir
const SAISON_MIN = 0.85; // "humeur de la semaine" (météo, saison, paie) — tirée 1×/sem
const SAISON_MAX = 1.25;
const TAUX_MATIERES = 0.2; // coût matières = 20 % du CA (le réassort du stock coûte EN PLUS ~12 %)
const CONSO_VARIA = 0.25; // ±25 % d'aléa hebdo sur la conso de CHAQUE catégorie
const PENALITE_RUPTURE = 3.5; // pénalité de notoriété par point de "poids" d'une catégorie à sec
// Rupture partielle (v1.1) : sous ce seuil, une catégorie commence à faire perdre du service
// (des clients la voulaient, elle est trop basse) — proportionnel au manque ET au poids de la
// catégorie (mêmes poids que la rupture totale). Pas besoin de tomber à 0 pour que ça compte.
const SEUIL_STOCK_BAS = 30; // % en dessous duquel une catégorie commence à coûter du service
const SENSIBILITE_STOCK_BAS = 0.35; // pire cas (toutes les catégories à sec) : -35 % de capacité
// Un bar PLEIN ne plombe pas sa réputation : on tolère un vrai débordement
// (12 % de refus) avant que le bouche-à-oreille ne tourne au vinaigre. Sinon la
// notoriété se verrouille à ~50 dès que les week-ends remplissent le local, et
// les moteurs de récompense (panier, affluence) ne s'allument jamais.
const SEUIL_REFUS_NOTOR = 0.12; // sous ce taux de refus, la réputation monte
const NOTOR_SENS_REFUS = 14; // sensibilité de la réputation au taux de clients refusés
const NOTOR_BONUS_SERVICE = 3; // gain de réputation d'une semaine (presque) tout servie

// ---- Propreté dynamique ----
// Les clients salissent (1 pt / SALISSURE_CLIENTS servis ≈ -7/sem à 550 clients).
// On nettoie via la tuile Ménage : équipe (gratuit mais fatigue) ou société
// (payant, nickel). Le trait Nettoyeur entretient passivement (+2/sem).
const SALISSURE_CLIENTS = 80;
export const MENAGE = {
  equipeProprete: 25, // points rendus par un ménage d'équipe
  equipeFatigue: 6, // fatigue prise par CHAQUE salarié actif
  // Société de nettoyage : facture selon l'état (déplacement + tarif par point
  // de propreté à remonter). Un bar à 60/100 coûte ~950 €, une ruine à 10/100
  // ~1 825 € : laisser pourrir se paie, le ménage d'équipe reste le réflexe éco.
  proBase: 250,
  proParPoint: 17.5,
};
const INFLATION_PAR_SEMAINE = 500; // mode infini : charges +500 €/sem cumulées après la victoire

// 🤝 Partenariat Amblam (événement don_asso) : la carte de réduction des
// adhérents ampute le CA chaque semaine pendant `duree` semaines, puis le
// représentant rend `multiplicateur` × le manque à gagner cumulé — un
// placement déguisé qui met la trésorerie sous pression un mois.
export const AMBLAM = { taux: 0.15, duree: 4, multiplicateur: 2 };

// Affluence par jour (Lun→Dim) : week-end fort, début de semaine calme.
const AFFLUENCE_JOUR = [0.45, 0.55, 0.75, 0.95, 1.5, 1.7, 0.6];

// Modulation par type d'offre : premium = moins de monde, plus gros panier.
const OFFRE_CLIENTELE: Record<OfferType, number> = { populaire: 1.0, premium: 0.8 };
const OFFRE_PANIER: Record<OfferType, number> = { populaire: 1.0, premium: 1.3 };
// Le patron porte le début de partie ; chaque salarié ajoute PEU de capacité
// (30 clients/soir) : il en faut 3 pour saturer le local de départ (150), un 4e
// ne sert qu'après les Travaux (local 200). Contrepartie : salaires du roster bas.
const EFF_PATRON = 32; // le joueur tient le comptoir : points d'indice de base, chaque soir ouvert
const EFF_SALARIE = 10; // points d'indice apportés par un salarié lambda en pleine forme
const ALEA_SERVICE = 0.08; // ±8 % d'aléa sur l'indice d'efficacité, chaque service
const SEMAINE_AMELIORATIONS = 5; // améliorations débloquées à partir de cette semaine
const COUT_AUTO_STOCK = 8_000; // prix de la machine "auto-stock" (case Fournisseur)
// 💰 Aimant aux grosses sommes : une fois par semaine, ramène une grosse enveloppe —
// rare au-delà de 15 % du CA (table de proba cumulative, du plus fréquent au plus rare).
const GROSSES_SOMMES_TABLE: { proba: number; pct: number }[] = [
  { proba: 0.4, pct: 0.05 },
  { proba: 0.3, pct: 0.15 },
  { proba: 0.2, pct: 0.2 },
  { proba: 0.1, pct: 0.25 },
];
const BUDGET_HAUT_SEUIL = 20_000; // Mr Breton : seuil de budget "haut" (condition : 4 semaines d'affilée, voir content.ts)

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

// ---- Petits utilitaires ----

function borne(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function actifs(s: GameState): Employee[] {
  return s.employes.filter((e) => !e.demissionne);
}

// ---- Création d'une partie ----

export function creerPartie(difficulte: Difficulty, offre: OfferType): GameState {
  return {
    difficulte,
    offre,
    phase: "presentation",
    semaine: 1,
    budget: BUDGET_INITIAL[difficulte],
    nomBar: "",
    detteInitiale: DETTE_INITIALE,
    presentationEtape: 1,
    notoriete: NOTORIETE_INITIALE,
    proprete: 70,
    stocks: stocksPleins(),
    employes: equipeDeDepart(),
    loyer: LOYER_INITIAL,
    evenementsJoues: 0,
    uniquesUtilises: [],
    effetsDifferes: [],
    evenementsBudget: 0,
    evenementsVus: {},
    candidats: genererCandidats(NB_CANDIDATS),
    cvRecus: [],
    jourAnim: 0,
    machines: machinesDeDepart(),
    niveauLocal: 0,
    joursEvenements: [],
    boostsJour: {},
    doubleFatigueFin: [],
    demissionsForceesFin: [],
    semainesBudgetHaut: 0,
    autoStockAchete: false,
    autoStockActif: false,
    detteRestant: DETTE_INITIALE,
    modeInfini: false,
    reparTentees: [],
    drapeaux: {},
    historique: [],
    journal: [],
  };
}

// ---- Onboarding : nom du bar & emprunt ----

/** Fixe le nom du bar (carte 1 de l'onboarding). Vide → « Chez Antho ». */
export function definirNomBar(state: GameState, nom: string): void {
  state.nomBar = nom.trim().slice(0, 24) || "Chez Antho";
}

/** Fixe l'emprunt de départ (carte 2) : borné 0-EMPRUNT_MAX, arrondi au cran.
 *  L'emprunt choisi EST la dette à rembourser — 0 € = pas de dette, la partie
 *  bascule en mode infini dès la première victoire (fin de semaine 1). */
export function definirEmprunt(state: GameState, montant: number): void {
  const m = Math.round(Math.max(0, Math.min(EMPRUNT_MAX, montant)) / EMPRUNT_PAS) * EMPRUNT_PAS;
  state.detteInitiale = m;
  state.detteRestant = m;
}

// ---- Embauche (onboarding) ----

export function embaucher(state: GameState, id: string): void {
  const i = state.candidats.findIndex((c) => c.id === id);
  if (i === -1) return;
  const [candidat] = state.candidats.splice(i, 1);
  candidat.semaineEmbauche = state.semaine;
  state.employes.push(candidat);
}

export function refuserCandidat(state: GameState, id: string): void {
  state.candidats = state.candidats.filter((c) => c.id !== id);
}

// ---- Case CV du hub ----

/** Embauche depuis un CV : le profil rejoint l'équipe, le CV quitte la boîte. */
export function embaucherCV(state: GameState, id: string): void {
  const i = state.cvRecus.findIndex((cv) => cv.profil.id === id);
  if (i === -1) return;
  const [cv] = state.cvRecus.splice(i, 1);
  cv.profil.semaineEmbauche = state.semaine;
  state.employes.push(cv.profil);
}

/** Refuse un CV : il quitte la boîte et laisse la place à un futur CV. */
export function refuserCV(state: GameState, id: string): void {
  state.cvRecus = state.cvRecus.filter((cv) => cv.profil.id !== id);
}

// ---- Planning repos & fermeture du bar ----

/** Bascule le repos d'un salarié sur un jour (0 = Lun … 6 = Dim). */
export function toggleRepos(state: GameState, id: string, jour: number): void {
  const e = state.employes.find((x) => x.id === id);
  if (!e || e.demissionne || jour < 0 || jour > 6) return;
  e.reposJours[jour] = !e.reposJours[jour];
}

/** Les 7 jours de la semaine à venir : true = bar OUVERT (au moins un salarié bosse).
 *  Fermeture administrative (police) : bar fermé tous les jours, quoi qu'il arrive. */
export function joursOuverture(state: GameState): boolean[] {
  if (state.barFerme) return Array(7).fill(false);
  return Array.from({ length: 7 }, (_, j) =>
    actifs(state).some((e) => !e.reposJours[j]),
  );
}

/** Rendement d'un salarié selon sa fatigue : plein en forme, s'effondre épuisé. */
function facteurFatigue(f: number): number {
  if (f >= 100) return 0.5;
  if (f >= 75) return 0.7;
  if (f >= 50) return 0.85;
  return 1;
}

// ---- Licenciement ----

/** Indemnité de licenciement : chère et punitive (10 semaines de salaire). */
export function coutLicenciement(e: Employee): number {
  return e.salaire * LICENCIEMENT_SEMAINES;
}

/** Licencie un salarié (pas Antho). Paie l'indemnité, il quitte le bar. */
export function licencier(state: GameState, id: string): boolean {
  const e = state.employes.find((x) => x.id === id);
  if (!e || e.demissionne || e.irrevocable) return false;
  const cout = coutLicenciement(e);
  if (state.budget < cout) return false;
  state.budget -= cout;
  e.demissionne = true;
  state.journal.push(`📤 ${e.nom} a été licencié (indemnité ${cout} €).`);
  return true;
}

// ---- Indice d'efficacité (jauge 0-100) ----
// Points apportés par l'équipe (fatigue déduite), MULTIPLIÉS par l'état du
// parc de machines : une machine HS retire sa part de l'indice entier
// (tireuse = -35 %). Le soir venu, un aléa de service s'ajoute (voir simulerSemaine).

/** Points de service bruts de l'équipe (patron + salariés, fatigue déduite). */
function pointsEquipe(state: GameState): number {
  return actifs(state).reduce(
    (s, e) => s + EFF_SALARIE * facteurFatigue(e.fatigue),
    EFF_PATRON,
  );
}

/** Indice « instantané » (tous les salariés au poste, sans aléa). Pour l'affichage. */
export function efficaciteActuelle(state: GameState): number {
  return Math.round(Math.min(100, pointsEquipe(state)) * facteurMachines(state.machines));
}

/** Plafond de clients/soir imposé par la taille du local (case Travaux). */
export function capaciteLocale(state: GameState): number {
  return CAPACITE_LOCAL[Math.min(state.niveauLocal, CAPACITE_LOCAL.length - 1)];
}

/** Capacité du bar : clients servables par soir. Le service de l'équipe est
 *  plafonné par les places du local, PUIS ralenti par l'état des machines :
 *  un parc HS pénalise le service même quand le local déborde de monde. */
export function capaciteBar(state: GameState): number {
  return Math.round(
    Math.min(pointsEquipe(state) * CLIENTS_PAR_POINT, capaciteLocale(state)) *
      facteurMachines(state.machines),
  );
}

/** Coût de l'agrandissement suivant (undefined = taille max atteinte). */
export function coutTravaux(state: GameState): number | undefined {
  return COUT_TRAVAUX[state.niveauLocal];
}

/** Lance les travaux d'agrandissement si le budget le permet. */
/** Lance les Travaux : payés cash, mais le chantier ferme le bar la semaine qui
 *  vient (0 CA, salaires/charges/loyer/dette quand même dus) — comme une
 *  fermeture administrative. Le nouveau local est actif dès la réouverture. */
export function agrandirBar(state: GameState): boolean {
  const cout = coutTravaux(state);
  if (cout === undefined || state.budget < cout) return false;
  state.budget -= cout;
  state.niveauLocal += 1;
  state.barFerme = true;
  state.barFermeRaison = "travaux";
  state.journal.push(
    `🏗 Travaux lancés : chantier cette semaine, le bar ferme le temps des travaux. Réouverture avec ${capaciteLocale(state)} clients par soir !`,
  );
  return true;
}

// ---- Facteurs de DEMANDE d'un soir (multiplient la clientèle de base) ----

/** La notoriété pilote fortement l'affluence : 0 → aucun client, 50 → normal, 100 → +50 %. */
function facteurNotoriete(n: number): number {
  if (n <= 50) return n / 50; // 0 → 0, 25 → 0.5, 50 → 1.0
  return 1 + ((n - 50) / 50) * 0.5; // 50 → 1.0, 100 → 1.5 : le succès attire du monde
}

/** Propreté 0→100 : un bar sale fait fuir (0.8×), un bar nickel fidélise (1.05×). */
function facteurProprete(p: number): number {
  return 0.8 + (p / 100) * 0.25;
}

/** Rupture partielle : chaque catégorie sous SEUIL_STOCK_BAS retire du service, au prorata
 *  du manque ET de son poids (bière = plus lourd). 1 = tout va bien, descend vers
 *  1 - SENSIBILITE_STOCK_BAS si tout le parc de catégories est à sec. */
function facteurStock(stocks: Stocks): number {
  let manque = 0;
  let poidsTotal = 0;
  for (const c of CATEGORIES_STOCK) {
    poidsTotal += c.poids;
    const s = stocks[c.id];
    if (s < SEUIL_STOCK_BAS) manque += c.poids * ((SEUIL_STOCK_BAS - s) / SEUIL_STOCK_BAS);
  }
  return 1 - Math.min(1, manque / poidsTotal) * SENSIBILITE_STOCK_BAS;
}

// ---- Emprunt initial (dette de départ) ----
// Le montant est choisi à l'onboarding (state.detteInitiale) — plus de constante d'affichage.

/** Échéance hebdomadaire de l'emprunt initial, selon la semaine. */
// Remboursement PROPORTIONNEL (v0.7) : chaque semaine, on rembourse un
// pourcentage du CA réalisé (avant charges/salaires). Auto-équilibrant : une
// grosse semaine accélère le remboursement, une semaine creuse ne t'étrangle
// pas (CA nul = échéance nulle). PROGRESSIF (v0.9) : le taux grimpe avec
// l'ancienneté de la dette pour éviter qu'elle traîne indéfiniment.
export const PALIERS_DETTE_CA: { semaineMax: number; taux: number }[] = [
  { semaineMax: 10, taux: 0.15 },
  { semaineMax: 20, taux: 0.2 },
  { semaineMax: Infinity, taux: 0.35 },
];

export function tauxDette(semaine: number): number {
  return PALIERS_DETTE_CA.find((p) => semaine <= p.semaineMax)!.taux;
}

// ---- Événements ----

// Courbe de difficulté (v0.9) : les BONS choix rapportent pareil à toutes les
// semaines, mais les MAUVAIS choix (budget perdu, moral qui chute, notoriété/
// propreté qui baisse, fatigue qui grimpe, pari perdu…) s'aggravent avec le
// temps — semaines 1-10 inchangées ("facile"), 11-20 ×1.3, 21+ ×1.6.
function severiteEvenement(semaine: number): number {
  if (semaine <= 10) return 1;
  if (semaine <= 20) return 1.3;
  return 1.6;
}

/** N'amplifie QUE la part négative d'un effet — les bons choix restent aussi
 *  généreux qu'en début de partie ; seuls les mauvais s'aggravent avec la semaine. */
function intensifierEffetNegatif(effet: Effect, semaine: number): Effect {
  const s = severiteEvenement(semaine);
  if (s === 1) return effet;
  // Points/€ additifs : arrondis ici (sinon la sévérité produit des jauges à
  // virgule affichées ensuite, ex. notoriété "40,000001 %").
  const pire = (v: number | undefined, mauvaisSiNegatif: boolean): number | undefined => {
    if (v === undefined) return v;
    const estMauvais = mauvaisSiNegatif ? v < 0 : v > 0;
    return estMauvais ? Math.round(v * s) : v;
  };
  // Ratios (%) : jamais arrondis ici, leurs consommateurs arrondissent déjà
  // le résultat final (ex. Math.round(budget * budgetPourcentage)).
  const pireRatio = (v: number | undefined, mauvaisSiNegatif: boolean): number | undefined => {
    if (v === undefined) return v;
    const estMauvais = mauvaisSiNegatif ? v < 0 : v > 0;
    return estMauvais ? v * s : v;
  };
  const stock = effet.stock
    ? (Object.fromEntries(
        Object.entries(effet.stock).map(([k, v]) => [k, pire(v as number, true)]),
      ) as Effect["stock"])
    : effet.stock;
  return {
    ...effet,
    budget: pire(effet.budget, true),
    budgetPourcentage: pireRatio(effet.budgetPourcentage, true),
    notoriete: pire(effet.notoriete, true),
    proprete: pire(effet.proprete, true),
    moralEquipe: pire(effet.moralEquipe, true),
    moralEquipePourcent: pireRatio(effet.moralEquipePourcent, true),
    moralCible: pire(effet.moralCible, true),
    fatigueEquipe: pire(effet.fatigueEquipe, false),
    fatigueCible: pire(effet.fatigueCible, false),
    fatiguePresentsJour: pire(effet.fatiguePresentsJour, false),
    stock,
  };
}

/** Proba effective d'un pari : boostée par l'aide glissée et/ou les Chanceux
 *  présents ce soir-là (`bonusChance`). Toujours bornée 5-95 %. */
export function probaAvecAide(
  tirage: NonNullable<Effect["tirage"]>,
  avecAide: boolean,
  bonusChance = 0,
): number {
  const boost = (avecAide ? AIDE_BOOST : 0) + bonusChance;
  if (boost === 0) return tirage.proba;
  const p = tirage.risque ? tirage.proba - boost : tirage.proba + boost;
  return Math.min(0.95, Math.max(0.05, p));
}

/** 🍀 Somme des bonus des Chanceux qui travaillent ce soir (améliore tout tirage). */
export function bonusChanceux(state: GameState): number {
  if (state.jourAnim < 1 || state.jourAnim > 7) return 0;
  return actifs(state)
    .filter((e) => aTrait(e, "chanceux") && !e.reposJours[state.jourAnim - 1])
    .reduce((t) => t + trait("chanceux")!.effet.valeur, 0);
}

/** Salariés capables d'aider CE choix : force requise (`tirage.aide`) + présents
 *  ce soir-là (pas en repos ni en vacances le jour de l'événement).
 *  Le 😱 Trouillard refuse d'aider les tirages risqués ☠. */
export function aidesPourChoix(state: GameState, choix: Choice): Employee[] {
  const tirage = choix.effet.tirage;
  const traitId = tirage?.aide;
  if (!traitId) return [];
  return actifs(state).filter(
    (e) =>
      aTrait(e, traitId) &&
      !(tirage?.risque && aTrait(e, "trouillard")) &&
      (state.jourAnim < 1 || state.jourAnim > 7 || !e.reposJours[state.jourAnim - 1]),
  );
}

export function tirerEvenement(state: GameState): void {
  const candidats = EVENEMENTS.filter((e) => {
    if (e.unique && state.uniquesUtilises.includes(e.id)) return false;
    // Anti-répétition : un événement déjà vu ne revient pas avant son cooldown.
    // Le pool peut se vider → certains soirs (ou semaines) passent sans pop-up, c'est voulu.
    const vu = state.evenementsVus[e.id];
    if (vu !== undefined && state.semaine - vu < (e.cooldown ?? COOLDOWN_EVENEMENT)) return false;
    if (e.condition && !e.condition(state)) return false;
    return true;
  });
  if (candidats.length === 0) return;
  // Les événements prioritaires (ex : demande de vacances) passent devant le tirage normal.
  const prioritaires = candidats.filter((e) => e.priorite);
  const pool = prioritaires.length > 0 ? prioritaires : candidats;
  const ev = pool[Math.floor(Math.random() * pool.length)];
  // Cible dynamique (portrait + effets *Cible). Pas de cible trouvée → soir sans événement.
  const cibleId = ev.choisirCible ? ev.choisirCible(state) : ev.cibleId;
  if (ev.choisirCible && cibleId === undefined) return;
  state.evenementsVus[ev.id] = state.semaine;
  // Choix dynamiques (ex : un bouton par salarié) construits au tirage.
  state.evenementCourant = {
    ...ev,
    cibleId,
    choix: ev.genererChoix ? ev.genererChoix(state, cibleId) : ev.choix,
  };
  state.phase = "evenement";
}

/** Déclenche un événement PRÉCIS, hors tirage aléatoire (enchaînement : ex.
 *  vomi après la soirée étudiante). Ignore cooldown et unique — l'histoire
 *  l'impose. `texte` remplace celui de l'événement (contexte narratif). */
export function declencherEvenement(state: GameState, id: string, texte?: string): void {
  const ev = EVENEMENTS.find((e) => e.id === id);
  if (!ev) return;
  const cibleId = ev.choisirCible ? ev.choisirCible(state) : ev.cibleId;
  if (ev.choisirCible && cibleId === undefined) return;
  state.evenementsVus[ev.id] = state.semaine;
  state.evenementCourant = {
    ...ev,
    cibleId,
    texte: texte ?? ev.texte,
    choix: ev.genererChoix ? ev.genererChoix(state, cibleId) : ev.choix,
  };
  state.phase = "evenement";
}

export function appliquerEffet(
  state: GameState,
  effet: Effect,
  cibleId?: string,
  tirageForce?: boolean,
): void {
  effet = intensifierEffetNegatif(effet, state.semaine);
  if (effet.budget) state.budget += effet.budget;
  if (effet.budgetPourcentage) state.budget += Math.round(state.budget * effet.budgetPourcentage);
  if (effet.notoriete) state.notoriete = borne(state.notoriete + effet.notoriete);
  if (effet.proprete) state.proprete = borne(state.proprete + effet.proprete);

  if (effet.moralEquipe) {
    for (const e of actifs(state)) e.moral = borne(e.moral + effet.moralEquipe);
  }
  if (effet.moralEquipePourcent) {
    for (const e of actifs(state)) e.moral = borne(Math.round(e.moral * (1 + effet.moralEquipePourcent)));
  }
  if (effet.grosseSoiree) {
    state.policeEnAttente = state.policeAvertissementFait ? "proces" : "avertissement";
    state.policeEnAttenteSemaine = state.semaine;
  }
  if (effet.resoudPoliceAvertissement) {
    state.policeEnAttente = undefined;
    state.policeAvertissementFait = true;
  }
  if (effet.declencherAmendePolice) {
    state.amendePoliceEnAttente = effet.declencherAmendePolice;
    state.policeEnAttente = undefined;
    state.policeAvertissementFait = false; // le cycle se relance : prochaine grosse soirée = nouvel avertissement
  }
  if (effet.fatigueEquipe) {
    for (const e of actifs(state)) e.fatigue = borne(e.fatigue + effet.fatigueEquipe);
  }
  if (effet.fatiguePresentsJour && state.jourAnim >= 1 && state.jourAnim <= 7) {
    const jourIdx = state.jourAnim - 1;
    for (const e of actifs(state)) {
      if (!e.reposJours[jourIdx]) e.fatigue = borne(e.fatigue + effet.fatiguePresentsJour);
    }
  }
  if (effet.capaciteSoir || effet.caSoirPourcent) {
    if (state.jourAnim >= 1 && state.jourAnim <= 7) {
      const actuel = state.boostsJour[state.jourAnim] ?? { capaciteMult: 1, caMult: 0 };
      state.boostsJour[state.jourAnim] = {
        capaciteMult: actuel.capaciteMult * (effet.capaciteSoir ?? 1),
        caMult: actuel.caMult + (effet.caSoirPourcent ?? 0),
      };
    }
  }
  // 🌿 Ayms : les présents du soir carburent, mais paieront ça en fatigue doublée
  // en fin de semaine (voir simulerSemaine).
  if (effet.fumetteAyms && state.jourAnim >= 1 && state.jourAnim <= 7) {
    const jourIdx = state.jourAnim - 1;
    for (const e of actifs(state)) {
      if (!e.reposJours[jourIdx] && !state.doubleFatigueFin.includes(e.id)) {
        state.doubleFatigueFin.push(e.id);
      }
    }
  }
  // 😬 Lanela : les présents du soir (sauf l'irrévocable) démissionneront en fin
  // de semaine ; l'irrévocable (Antho) encaisse un coup de moral immédiat.
  if (effet.soireeLanela && state.jourAnim >= 1 && state.jourAnim <= 7) {
    const jourIdx = state.jourAnim - 1;
    for (const e of actifs(state)) {
      if (e.reposJours[jourIdx]) continue;
      if (e.irrevocable) {
        e.moral = borne(e.moral - 12);
      } else if (!state.demissionsForceesFin.includes(e.id)) {
        state.demissionsForceesFin.push(e.id);
      }
    }
  }
  const cible = cibleId
    ? state.employes.find((e) => e.id === cibleId && !e.demissionne)
    : undefined;
  if (cible) {
    if (effet.moralCible) {
      // 🧨 Rancunier : les coups au moral qui LE visent font deux fois plus mal.
      const facteur =
        effet.moralCible < 0 && aTrait(cible, "rancunier") ? trait("rancunier")!.effet.valeur : 1;
      cible.moral = borne(cible.moral + effet.moralCible * facteur);
    }
    if (effet.fatigueCible) cible.fatigue = borne(cible.fatigue + effet.fatigueCible);
    if (effet.salaireCible) cible.salaire += effet.salaireCible;
    if (effet.augmentationCible) {
      cible.salaire += effet.augmentationCible;
      cible.semaineAugmentation = state.semaine;
    }
    if (effet.vacancesCible) {
      cible.vacances = "posees"; // départ à la semaine prochaine
      cible.vacancesRefus = 0; // la menace est désamorcée
    }
    if (effet.ajusterVacancesRefus) {
      cible.vacancesRefus = (cible.vacancesRefus ?? 0) + effet.ajusterVacancesRefus;
      cible.vacancesRefusSemaine = state.semaine;
    }
    if (effet.demissionCible) cible.demissionne = true;
  }
  if (effet.stock) {
    for (const [cat, val] of Object.entries(effet.stock) as [StockCategorie, number][]) {
      state.stocks[cat] = borne(state.stocks[cat] + val);
    }
  }
  if (effet.poseDrapeau) state.drapeaux[effet.poseDrapeau.cle] = effet.poseDrapeau.valeur;
  if (effet.partenariatAmblam) {
    state.partenariatAmblam = { semainesRestantes: AMBLAM.duree, cumule: 0 };
  }
  if (effet.casseMachineAleatoire) {
    const enMarche = state.machines.filter((m) => m.etat === "marche");
    if (enMarche.length > 0) {
      const m = enMarche[Math.floor(Math.random() * enMarche.length)];
      m.etat = "panne";
      state.journal.push(`🔧 ${m.nom} est tombée en panne !`);
    }
  }
  // Les notes peuvent contenir {nom} : remplacé par le salarié ciblé.
  if (effet.note) state.journal.push(effet.note.replace(/\{nom\}/g, cible?.nom ?? "quelqu'un"));
  // Pari : on tire au sort (sauf résultat déjà tiré par l'animation de la pinte),
  // puis on applique récursivement le résultat.
  if (effet.tirage) {
    const gagne = tirageForce ?? Math.random() < effet.tirage.proba;
    const resultat = gagne ? effet.tirage.succes : effet.tirage.echec;
    appliquerEffet(state, resultat, cibleId); // un éventuel tirage imbriqué reste aléatoire
  }
}

/** Planifie les événements de la semaine : des jours (1-7) tirés parmi les
 *  jours d'OUVERTURE. Rien en semaine 1 (le joueur apprend les bases). */
export function planifierEvenements(state: GameState): void {
  state.joursEvenements = [];
  state.boostsJour = {};
  state.doubleFatigueFin = [];
  state.demissionsForceesFin = [];
  // 🏍️ Mr Breton : série de semaines consécutives avec un budget confortable.
  state.semainesBudgetHaut = state.budget > BUDGET_HAUT_SEUIL ? state.semainesBudgetHaut + 1 : 0;
  // 🚨 Blanchiment en cours : 20 % de chance CHAQUE semaine que ça se fasse griller.
  if (state.drapeaux["blanchiment_actif"] && Math.random() < 0.2) {
    state.drapeaux["sem_blanchiment_police"] = true;
  }
  // Instantané pour le bilan : la variation de réputation affichée couvre TOUTE
  // la semaine, y compris les événements appliqués en direct pendant l'animation.
  state.notorieteDebutSemaine = state.notoriete;
  if (state.semaine < 2 || EVENEMENTS.length === 0) return;
  const ouverts = joursOuverture(state);
  const joursDispo: number[] = [];
  for (let d = 1; d <= 7; d++) if (ouverts[d - 1]) joursDispo.push(d);
  // Rythme (v1.0) : au moins 1 pop-up par semaine, 50 % de chance d'un 2e,
  // et si un 2e tombe, 20 % de chance d'un 3e.
  let nb = 1;
  if (Math.random() < 0.5) {
    nb = 2;
    if (Math.random() < 0.2) nb = 3;
  }
  nb = Math.min(nb, joursDispo.length);
  // Un événement FORCÉ en attente (police, procès vacances) garantit au moins
  // un jour de pop-up cette semaine — il n'attend pas le tirage aléatoire.
  const forcePret =
    (state.policeEnAttente && state.semaine > (state.policeEnAttenteSemaine ?? 0)) ||
    salarieVacancesMenace(state) !== undefined ||
    salarieVacancesProces(state) !== undefined;
  if (forcePret) nb = Math.max(nb, Math.min(1, joursDispo.length));
  for (let i = 0; i < nb; i++) {
    const idx = Math.floor(Math.random() * joursDispo.length);
    state.joursEvenements.push(joursDispo.splice(idx, 1)[0]);
  }
  state.joursEvenements.sort((a, b) => a - b);
}

function gererDemissions(state: GameState): void {
  for (const e of state.employes) {
    // Antho aussi : « irrévocable » protège du licenciement, pas de l'épuisement.
    if (!e.demissionne && e.moral <= 0) {
      e.demissionne = true;
      state.journal.push(`💔 ${e.nom} a démissionné (moral à 0).`);
    }
  }
}

export function appliquerChoix(
  state: GameState,
  indexChoix: number,
  tirageForce?: boolean, // résultat pré-tiré par l'animation de la pinte (voir main.ts)
): void {
  const ev = state.evenementCourant;
  if (!ev) return;
  const choix: Choice | undefined = ev.choix[indexChoix];
  if (!choix) return;
  // Coup de main : le salarié glissé sur CE choix se fatigue (la proba a déjà
  // été boostée par main.ts au moment du tirage de la pinte).
  const aide = state.aideEvenement;
  if (aide && aide.choixIndex === indexChoix && choix.effet.tirage?.aide) {
    const e = state.employes.find((x) => x.id === aide.employeId && !x.demissionne);
    if (e) {
      e.fatigue = borne(e.fatigue + AIDE_FATIGUE);
      state.journal.push(`🤝 ${e.nom} a donné un coup de main (fatigue +${AIDE_FATIGUE}).`);
    }
  }
  state.aideEvenement = undefined;
  // On mémorise l'impact € pour l'afficher au bilan (le budget est déjà débité en direct).
  const budgetAvant = state.budget;
  appliquerEffet(state, choix.effet, choix.cibleId ?? ev.cibleId, tirageForce);
  state.evenementsBudget += state.budget - budgetAvant;
  if (choix.differe) state.effetsDifferes.push(choix.differe);
  // Enchaînement : ce choix peut déclencher un AUTRE événement le même soir
  // (ex : le BDE Médecine a trop bu → vomi). Consommé par main.ts à la fermeture.
  if (choix.enchaine && Math.random() < choix.enchaine.proba) {
    state.evenementEnchaine = { id: choix.enchaine.id, texte: choix.enchaine.texte };
  }
  if (ev.unique) state.uniquesUtilises.push(ev.id);
  if (choix.note) state.journal.push(choix.note);
  gererDemissions(state);
  state.evenementsJoues += 1;
}

// ---- Simulation d'une semaine : CA soir par soir ----

export function simulerSemaine(state: GameState): void {
  const notes: string[] = []; // événements humains de la semaine (récap)

  // ---- Traits : au LANCEMENT de la semaine ----

  // 😔 Dépressif : risque de drame (suicide) → on perd le salarié + frais.
  const drame = trait("depressif")!.effet;
  for (const e of actifs(state)) {
    if (!aTrait(e, "depressif")) continue;
    if (Math.random() < (drame.chance ?? 0)) {
      e.demissionne = true;
      state.budget -= drame.valeur;
      state.evenementsBudget -= drame.valeur;
      notes.push(
        `🕯 Drame : ${e.nom} a mis fin à ses jours. Le bar prend en charge ${drame.valeur} € de frais. L'équipe est sous le choc.`,
      );
      if (e.irrevocable) state.drapeaux["drame_antho"] = true;
    }
  }

  // 😤 Casse-couille : plombe aléatoirement le moral de TOUS les collègues.
  const cc = trait("casse_couille")!.effet;
  for (const e of actifs(state)) {
    if (!aTrait(e, "casse_couille")) continue;
    let perteMax = 0;
    for (const autre of actifs(state)) {
      if (autre.id === e.id) continue;
      const perte = 1 + Math.floor(Math.random() * (2 * Math.abs(cc.valeur) - 1)); // 1..5 (~3)
      autre.moral = borne(autre.moral - perte);
      perteMax = Math.max(perteMax, perte);
    }
    if (perteMax > 0) {
      notes.push(`😤 ${e.nom} tape sur les nerfs de l'équipe : le moral des collègues en prend un coup.`);
    }
  }

  // 🧘 Zen : apaise les collègues chaque semaine (miroir du Casse-couille).
  const zen = trait("zen")!.effet;
  for (const e of actifs(state)) {
    if (!aTrait(e, "zen")) continue;
    for (const autre of actifs(state)) {
      if (autre.id !== e.id) autre.moral = borne(autre.moral + zen.valeur);
    }
  }

  // 🎰 Joueur : peut « emprunter » la caisse pour un pari. Visible au bilan,
  // contrairement au Voleur — le joueur sait qui plombe les comptes.
  const pari = trait("joueur")!.effet;
  for (const e of actifs(state)) {
    if (!aTrait(e, "joueur")) continue;
    if (Math.random() < (pari.chance ?? 0)) {
      const somme = Math.round((100 + Math.random() * (pari.valeur - 100)) / 10) * 10;
      state.budget -= somme;
      state.evenementsBudget -= somme;
      notes.push(`🎰 ${e.nom} a « emprunté » ${somme} € dans la caisse pour un pari. Perdu, évidemment.`);
    }
  }

  // 🔧 Ingénieur : une fois par semaine, tente de retaper UNE machine abîmée
  // (< 50 % de vie, encore en marche) avant qu'elle ne casse.
  const rep = trait("ingenieur")!.effet;
  for (const e of actifs(state)) {
    if (!aTrait(e, "ingenieur")) continue;
    const abimees = state.machines.filter((m) => m.etat === "marche" && m.hp < 50);
    if (abimees.length === 0) break; // une seule réparation possible par semaine
    const m = abimees[Math.floor(Math.random() * abimees.length)];
    const jour = JOURS_LONGS[Math.floor(Math.random() * 7)];
    if (Math.random() < rep.valeur) {
      reparerMachine(m);
      notes.push(`🔧 ${e.nom} a réussi à réparer ${m.nom.toLowerCase()} ${jour} soir !`);
    }
    break; // un seul essai par semaine, même avec plusieurs ingénieurs
  }

  // Catégories à sec DÈS le début de semaine : clients mécontents → notoriété plombée.
  const ruptures = CATEGORIES_STOCK.filter((c) => state.stocks[c.id] <= 0);
  // Snapshot AVANT consommation de la semaine : la conso plus bas peut vider une
  // catégorie qui n'était que basse en tout début de semaine (sinon la note finale
  // se trompe de coupables, cf. facteurStock qui lit lui aussi le stock de DÉBUT de semaine).
  const stocksBasDebutSemaine = CATEGORIES_STOCK.filter(
    (c) => state.stocks[c.id] > 0 && state.stocks[c.id] < SEUIL_STOCK_BAS,
  );

  // Planning : jours d'ouverture (au moins un salarié au travail).
  const ouverts = joursOuverture(state);
  const joursOuvertsNb = ouverts.filter(Boolean).length;
  const joursFermesNb = 7 - joursOuvertsNb;

  // Tirage des pannes de la semaine (1 chance/machine, selon HP de début de semaine).
  // Une machine ne peut lâcher qu'un soir où le bar est OUVERT (fermé = pas utilisée).
  const joursOuvertsIdx: number[] = [];
  for (let d = 1; d <= 7; d++) if (ouverts[d - 1]) joursOuvertsIdx.push(d);
  const jourPanne = new Map<string, number>(); // machineId -> jour (1-7)
  for (const m of state.machines) {
    if (m.etat !== "marche" || joursOuvertsIdx.length === 0) continue;
    if (Math.random() < probaPanne(m.hp)) {
      jourPanne.set(m.id, joursOuvertsIdx[Math.floor(Math.random() * joursOuvertsIdx.length)]);
    }
  }

  // Facteurs constants sur toute la semaine.
  const notorF = facteurNotoriete(state.notoriete);
  const propreF = facteurProprete(state.proprete);
  const stockF = facteurStock(state.stocks); // rupture PARTIELLE (voir facteurStock)
  const saisonF = SAISON_MIN + Math.random() * (SAISON_MAX - SAISON_MIN); // "humeur" de la semaine
  const clienteleF = OFFRE_CLIENTELE[state.offre];
  const panierOffre = OFFRE_PANIER[state.offre];

  // Cumul Amblam en début de semaine : sert à chiffrer la perte de LA semaine.
  const amblamCumuleAvant = state.partenariatAmblam?.cumule ?? 0;
  let amblamPerteSemaine = 0; // affichée en ligne dédiée au récap (voir bilan)

  const jours: JourCA[] = [];
  let caTotal = 0;
  let clientsTotal = 0;
  let refusesTotal = 0;
  let demandeTotal = 0;

  // Traits à tirage PAR SOIR : ivresse (alcoolique), ambiance (notoriété).
  // Le Mentor booste les collègues présents le même soir.
  const alco = trait("alcoolique")!.effet;
  const ambiance = trait("ambianceur")!.effet;
  const mentorEffet = trait("mentor")!.effet;
  const soirsIvres = new Map<string, number>(); // employeId -> nb de soirs ivres
  let notorAmbiance = 0; // points de notoriété gagnés par les ambianceurs

  for (let d = 1; d <= 7; d++) {
    // Bar fermé ce soir (tout le monde au repos) : aucun client, aucun mécontent.
    if (!ouverts[d - 1]) {
      jours.push({
        jour: JOURS[d - 1],
        ca: 0,
        clients: 0,
        demande: 0,
        refuses: 0,
        efficacite: 0,
        panier: 0,
        pannes: [],
        ferme: true,
      });
      continue;
    }

    // Indice d'efficacité du soir = points des salariés présents (rendement
    // rogné par la fatigue, modulé par les traits : Efficacité +15 %, Lent -10 %,
    // ivresse -20 %…) × état du parc de machines × aléa du service.
    const presents = actifs(state).filter((e) => !e.reposJours[d - 1]);
    const nbMentors = presents.filter((e) => aTrait(e, "mentor")).length;
    let eff = EFF_PATRON; // le patron est toujours derrière le comptoir
    let bonusCA = 0;
    let compPresente = 0; // Σ compétence/100 des présents, pondérée par la fatigue
    for (const e of presents) {
      let facteurTraits = 1 + bonusPassif(e, "capacite");
      // 🍺 Alcoolique : ce soir-là, il sert ivre (efficacité réduite).
      if (aTrait(e, "alcoolique") && Math.random() < (alco.chance ?? 0)) {
        facteurTraits *= 1 + alco.valeur;
        soirsIvres.set(e.id, (soirsIvres.get(e.id) ?? 0) + 1);
      }
      // 🦉 Noctambule : à fond les soirs de rush (vendredi/samedi).
      if (d === 5 || d === 6) facteurTraits *= 1 + bonusPassif(e, "weekend");
      // 🕰 Retardataire : le lendemain d'un jour de repos, il traîne.
      if (d >= 2 && e.reposJours[d - 2]) {
        facteurTraits *= Math.max(0.1, 1 + bonusPassif(e, "retard"));
      }
      // 🎓 Mentor : les collègues présents progressent (pas lui).
      if (nbMentors > 0 && !aTrait(e, "mentor")) {
        facteurTraits *= 1 + nbMentors * mentorEffet.valeur;
      }
      eff += EFF_SALARIE * facteurFatigue(e.fatigue) * facteurTraits;
      // 💪 Compétence : un salarié doué vend mieux → panier du soir plus haut.
      compPresente += (e.competence / 100) * facteurFatigue(e.fatigue);
      // 💼 Commercial : fait grimper le panier du soir.
      bonusCA += bonusPassif(e, "ca");
      // 🎉 Ambianceur : chance de faire parler du bar ce soir.
      if (aTrait(e, "ambianceur") && Math.random() < (ambiance.chance ?? 0)) {
        notorAmbiance += ambiance.valeur;
      }
    }
    const pannesCeSoir: string[] = [];
    const machinesF = facteurMachines(state.machines, (m) => {
      if (m.etat !== "marche") return 0; // déjà en panne avant la semaine
      const jp = jourPanne.get(m.id);
      if (jp !== undefined && d >= jp) {
        if (d === jp) pannesCeSoir.push(m.nom); // signalée le soir de la panne
        return 0; // HS à partir de ce soir
      }
      return rendementMachine(m);
    });
    // Indice du soir (0-100) : équipe × état du parc × aléa du service.
    const aleaService = 1 + (Math.random() * 2 - 1) * ALEA_SERVICE;
    const indiceSoir = Math.round(Math.min(100, eff) * machinesF * aleaService);

    // 1) DEMANDE : combien de clients veulent venir ce soir.
    const aleaSoir = 1 + (Math.random() * 2 - 1) * ALEA_SOIR; // ±15 %
    const demande = Math.round(
      CLIENTELE_BASE * AFFLUENCE_JOUR[d - 1] * notorF * propreF * saisonF * clienteleF * aleaSoir,
    );

    // 2) CAPACITÉ : le service de l'équipe, plafonné par les places du local,
    //    PUIS ralenti par l'état des machines et l'aléa du soir : un parc HS
    //    pénalise le service même quand le local déborde de monde.
    // Un événement peut booster CE soir précis (capaciteMult / caMult) — voir Effect.capaciteSoir.
    const boostSoir = state.boostsJour[d];
    const capacite = Math.round(
      Math.min(eff * CLIENTS_PAR_POINT, capaciteLocale(state)) *
        machinesF *
        aleaService *
        stockF *
        (boostSoir?.capaciteMult ?? 1),
    );
    const clients = Math.min(demande, capacite);
    const refuses = Math.max(0, demande - clients);

    // 3) PANIER : ticket moyen du soir (± aléa, + compétence de l'équipe présente,
    //    + bonus des Commerciaux, - ristourne permanente du prix d'ami).
    const panier =
      PANIER_BASE *
      panierOffre *
      (1 + Math.min(compPresente, compPresenteMax(state)) * PANIER_COMP) *
      (1 + (Math.max(0, state.notoriete - 50) / 100) * PANIER_NOTOR) *
      (1 + (Math.random() * 2 - 1) * PANIER_VARIA) *
      (1 + bonusCA) *
      (state.drapeaux["prix_ami"] ? PRIX_AMI_PANIER : 1);

    // 4) CA du soir = clients servis × panier (+ éventuel boost événement du soir).
    let ca = Math.round(clients * panier * (1 + (boostSoir?.caMult ?? 0)));
    // 🤝 Carte Amblam : les adhérents paient au rabais → CA du soir amputé,
    // le manque à gagner est mémorisé (Amblam le rendra ×2 à l'échéance).
    if (state.partenariatAmblam) {
      const perte = Math.round(ca * AMBLAM.taux);
      ca -= perte;
      state.partenariatAmblam.cumule += perte;
    }

    caTotal += ca;
    clientsTotal += clients;
    refusesTotal += refuses;
    demandeTotal += demande;

    jours.push({
      jour: JOURS[d - 1],
      ca,
      clients,
      demande,
      refuses,
      efficacite: indiceSoir,
      panier: Math.round(panier * 10) / 10,
      pannes: pannesCeSoir,
    });
  }

  // Les machines qui ont lâché passent en panne.
  for (const id of jourPanne.keys()) {
    const m = state.machines.find((x) => x.id === id);
    if (m) m.etat = "panne";
  }

  // 🤝 Partenariat Amblam : décompte hebdo ; à l'échéance, le représentant
  // rend le cumul ×2 la semaine SUIVANTE (via les effets différés).
  if (state.partenariatAmblam) {
    const p = state.partenariatAmblam;
    const perteSemaine = p.cumule - amblamCumuleAvant;
    amblamPerteSemaine = perteSemaine;
    p.semainesRestantes -= 1;
    if (p.semainesRestantes > 0) {
      notes.push(
        `🤝 Carte Amblam : -${perteSemaine} € de CA cette semaine (encore ${p.semainesRestantes} semaine${p.semainesRestantes > 1 ? "s" : ""} de partenariat).`,
      );
    } else {
      const rendu = p.cumule * AMBLAM.multiplicateur;
      state.effetsDifferes.push({
        budget: rendu,
        note: `🤝 Amblam tient parole : le représentant rend le DOUBLE du manque à gagner du partenariat (+${rendu} €) !`,
      });
      notes.push(
        `🤝 Carte Amblam : -${perteSemaine} € de CA cette semaine. Fin du partenariat — Amblam passe la semaine prochaine honorer sa promesse.`,
      );
      state.partenariatAmblam = undefined;
    }
  }
  // Usure des machines restées en marche + consommation des stocks (∝ clients servis).
  // Chaque catégorie se vide à son rythme (bière la plus vite, vin la plus lente) ET
  // avec un aléa hebdo (les goûts des clients bougent) → la commande à passer chez le
  // fournisseur varie d'une semaine à l'autre au lieu d'être toujours identique.
  // Les soirs de fermeture n'usent pas les machines.
  // Traits : Maladroit accélère l'usure, Économe freine la conso de stock.
  const equipeSemaine = actifs(state).filter((e) => e.reposJours.filter(Boolean).length < 7);
  const facteurUsureTraits = Math.max(
    0.5,
    1 + equipeSemaine.reduce((s, e) => s + bonusPassif(e, "usureMachine"), 0),
  );
  const facteurConso = Math.max(
    0.5,
    1 + equipeSemaine.reduce((s, e) => s + bonusPassif(e, "conso"), 0),
  );
  // 🔧 Un bar qui tourne proche de sa capacité max use son parc plus vite qu'un
  // bar peu fréquenté (jusqu'à +30 %) — un levier pour qu'une grosse équipe qui
  // sature le local tous les soirs ait encore intérêt à investir dans les machines.
  const clientsMoyenParSoir = joursOuvertsNb > 0 ? clientsTotal / joursOuvertsNb : 0;
  const chargeService = capaciteLocale(state) > 0 ? clientsMoyenParSoir / capaciteLocale(state) : 0;
  const facteurUsureCharge = Math.min(1.3, Math.max(0.7, 0.7 + 0.6 * chargeService));
  userMachines(state.machines, joursOuvertsNb, facteurUsureTraits * facteurUsureCharge);
  for (const c of CATEGORIES_STOCK) {
    const varia = 1 + (Math.random() * 2 - 1) * CONSO_VARIA; // ±CONSO_VARIA
    state.stocks[c.id] = borne(state.stocks[c.id] - clientsTotal * c.conso * varia * facteurConso);
  }

  // ---- Propreté : les clients salissent, le trait Nettoyeur entretient ----
  // Appliquée AVANT le calcul de réputation : le malus « bar sale » (< 40)
  // reflète l'état dans lequel les clients ont laissé le bar cette semaine.
  const entretien = equipeSemaine.reduce((t, e) => t + bonusPassif(e, "proprete"), 0);
  state.proprete = Math.round(borne(state.proprete - clientsTotal / SALISSURE_CLIENTS + entretien));
  for (const e of equipeSemaine) {
    if (aTrait(e, "nettoyeur")) {
      notes.push(`🧹 ${e.nom} a briqué le bar toute la semaine (+${trait("nettoyeur")!.effet.valeur} propreté).`);
    }
  }
  if (state.proprete < 40) {
    notes.push(`🧹 Le bar est crade (${state.proprete}%) : les clients fuient et la réputation trinque.`);
  } else if (state.proprete < 55) {
    notes.push(`🧹 La crasse s'installe (propreté ${state.proprete}%) — pense au ménage.`);
  }

  // 🍺 Notes d'ivresse (visibles au récap : le joueur doit comprendre la baisse).
  for (const [id, nb] of soirsIvres) {
    const e = state.employes.find((x) => x.id === id);
    if (e) notes.push(`🍺 ${e.nom} a servi ivre ${nb} soir${nb > 1 ? "s" : ""} cette semaine.`);
  }

  // 💰 Aimant aux grosses sommes : une fois par semaine, ramène une grosse
  // enveloppe (5 à 25 % du CA de la semaine, rare au-delà de 15 %).
  for (const e of equipeSemaine) {
    if (!aTrait(e, "grosses_sommes")) continue;
    const r = Math.random();
    let cumul = 0;
    let pct = GROSSES_SOMMES_TABLE[0].pct;
    for (const palier of GROSSES_SOMMES_TABLE) {
      cumul += palier.proba;
      if (r < cumul) {
        pct = palier.pct;
        break;
      }
    }
    const montant = Math.round(caTotal * pct);
    state.budget += montant;
    state.evenementsBudget += montant;
    notes.push(
      `💰 ${e.nom} a ramené une grosse enveloppe : ${montant} € (${Math.round(pct * 100)} % du CA de la semaine).`,
    );
  }

  // Réputation vivante : monte quand on sert (presque) tout le monde dans un bar
  // propre, descend quand on refuse du monde faute de place (ou bar sale).
  // Les soirs FERMÉS ne comptent pas (0 demande = 0 mécontent) : être fermé
  // n'énerve personne… tant qu'on ne ferme pas trop longtemps.
  const tauxRefus = demandeTotal > 0 ? refusesTotal / demandeTotal : 0;
  let deltaNotor =
    tauxRefus > SEUIL_REFUS_NOTOR
      ? -(tauxRefus - SEUIL_REFUS_NOTOR) * NOTOR_SENS_REFUS
      : joursOuvertsNb > 0
        ? NOTOR_BONUS_SERVICE
        : 0; // semaine entièrement fermée : pas de bonus de service
  if (state.proprete < 40) deltaNotor -= 1; // bar sale = mauvaise image
  // Rupture de stock = clients furieux ; d'autant plus fort que la catégorie est vendeuse.
  // (Seulement si le bar a ouvert : fermé, personne ne voit les frigos vides.)
  if (joursOuvertsNb > 0) {
    for (const c of ruptures) deltaNotor -= PENALITE_RUPTURE * c.poids;
  }
  // Stock bas (mais pas à sec) : du service perdu toute la semaine, faute de
  // marchandise — moins brutal qu'une vraie rupture, mais ça compte quand même.
  if (joursOuvertsNb > 0 && stockF < 0.97 && stocksBasDebutSemaine.length > 0) {
    notes.push(
      `📉 Stock bas (${stocksBasDebutSemaine.map((c) => c.nom.toLowerCase()).join(", ")}) : du monde reparti bredouille toute la semaine.`,
    );
  }
  // Fermé plus de FERMETURE_TOLEREE jours : les habitués nous oublient.
  if (joursFermesNb > FERMETURE_TOLEREE) {
    deltaNotor -= (joursFermesNb - FERMETURE_TOLEREE) * NOTOR_MALUS_FERMETURE;
    notes.push(`🚪 Bar fermé ${joursFermesNb} jours : les habitués commencent à t'oublier…`);
  }

  // 🎉 Ambianceurs : les bons soirs font parler du bar.
  deltaNotor += notorAmbiance;

  // 💢 Dangereux : peut péter un câble une fois dans la semaine.
  const danger = trait("dangereux")!.effet;
  for (const e of equipeSemaine) {
    if (!aTrait(e, "dangereux")) continue;
    if (Math.random() < (danger.chance ?? 0)) {
      deltaNotor += danger.valeur; // valeur négative
      notes.push(
        `💢 ${e.nom} s'est battu avec un client : la réputation du bar en souffre (${danger.valeur}).`,
      );
    }
  }
  const notorAvant = state.notoriete;
  state.notoriete = borne(state.notoriete + Math.round(deltaNotor));
  // Variation TOTALE de la semaine (événements joués pendant l'animation inclus),
  // mesurée depuis le lancement — pas seulement le bonus/malus de service.
  const notorDelta = state.notoriete - (state.notorieteDebutSemaine ?? notorAvant);

  // ---- Fatigue & moral des salariés (fin de semaine) ----
  // Travailler fatigue ; au-delà de 5 jours = heures sup (le moral trinque) ;
  // le repos récupère fatigue ET moral. Un salarié épuisé peut claquer la porte.
  // Fermeture administrative : personne ne travaille ni ne se repose vraiment, on gèle les deux jauges.
  for (const e of actifs(state)) {
    if (state.barFerme) continue;
    const repos = e.reposJours.filter(Boolean).length;
    const travailles = 7 - repos;
    // 🔋 Infatigable : accumule la fatigue moins vite (bonus négatif).
    const vitesseFatigue = Math.max(0.25, 1 + bonusPassif(e, "fatigue"));
    e.fatigue = borne(
      e.fatigue + travailles * FATIGUE_JOUR_TRAVAIL * vitesseFatigue - repos * FATIGUE_JOUR_REPOS,
    );
    const heuresSup = travailles > 5 ? (travailles - 5) * MORAL_MALUS_HEURES_SUP : 0;
    const epuise = e.fatigue >= 80 ? MORAL_MALUS_EPUISE : 0;
    e.moral = borne(e.moral + repos * MORAL_JOUR_REPOS - heuresSup - epuise);

    if (e.fatigue >= 75) {
      notes.push(`😮‍💨 ${e.nom} est épuisé (fatigue ${e.fatigue}%). Accorde-lui du repos !`);
    }
  }

  // 🌿 Contrecoup d'Ayms : double la fatigue des salariés qui avaient goûté à
  // sa "récréation" cette semaine.
  if (state.doubleFatigueFin.length > 0) {
    for (const id of state.doubleFatigueFin) {
      const e = state.employes.find((x) => x.id === id && !x.demissionne);
      if (e) e.fatigue = borne(e.fatigue * 2);
    }
    notes.push(`🌿 Contrecoup de la "récréation" d'Ayms : la fatigue de l'équipe concernée double.`);
    state.doubleFatigueFin = [];
  }

  // 🤒 Fragile : peut tomber malade → 2 jours d'arrêt imposés la semaine
  // prochaine (posés sur lundi-mardi dans preparerSemaineSuivante).
  const grippe = trait("fragile")!.effet;
  for (const e of actifs(state)) {
    if (!aTrait(e, "fragile") || e.vacances) continue;
    if (Math.random() < (grippe.chance ?? 0)) {
      e.maladie = true;
      notes.push(`🤒 ${e.nom} a chopé la crève : il sera au lit lundi et mardi prochains.`);
    }
  }

  // 😔 Dépression émergente : un moral effondré peut faire sombrer un salarié.
  // La faiblesse s'AJOUTE à celles qu'il a déjà (et plusieurs salariés peuvent l'avoir).
  for (const e of actifs(state)) {
    if (e.moral > SEUIL_DEPRESSION_MORAL || aTrait(e, "depressif")) continue;
    if (Math.random() < PROBA_DEPRESSION) {
      e.faiblesses.push("depressif");
      notes.push(`😔 ${e.nom} sombre dans la dépression… Remonte-lui le moral, vite.`);
    }
  }

  // Démissions de fin de semaine : moral à zéro = départ certain ; épuisé ET
  // démoralisé = risque chaque semaine. Antho aussi : le pousser à bout, c'est
  // la fin de l'aventure (vérifié dans verifierGameOver).
  for (const e of actifs(state)) {
    const aBout =
      e.fatigue >= SEUIL_DEMISSION_FATIGUE && e.moral <= SEUIL_DEMISSION_MORAL;
    if (e.moral <= 0 || (aBout && Math.random() < PROBA_DEMISSION)) {
      e.demissionne = true;
      notes.push(`💔 ${e.nom} a démissionné, épuisé et démoralisé.`);
    }
  }

  // 😬 Lanela : cette soirée était de trop pour ceux qui l'ont vécue.
  if (state.demissionsForceesFin.length > 0) {
    for (const id of state.demissionsForceesFin) {
      const e = state.employes.find((x) => x.id === id && !x.demissionne);
      if (e) {
        e.demissionne = true;
        notes.push(
          `💔 ${e.nom} : « cette soirée où Lanela est venue était de trop ! Je préfère ne plus jamais revenir travailler ici. »`,
        );
      }
    }
    state.demissionsForceesFin = [];
  }

  // 🏍️ Mr Breton passe récupérer sa part promise.
  if (state.drapeaux["sem_breton_rancon"]) {
    const perte = Math.round(state.budget * 0.5);
    state.budget -= perte;
    state.evenementsBudget -= perte;
    notes.push(`🏍️ Mr Breton passe récupérer sa part promise : -${perte} € (moitié du budget).`);
  }

  // 😠 L'Olmo n'a pas apprécié qu'on se paie sa tête (démission de la négociation
  // ou reniement de l'accord) : une machine trinque en représailles.
  if (state.drapeaux["sem_olmo_casse"]) {
    const enMarche = state.machines.filter((m) => m.etat === "marche");
    if (enMarche.length > 0) {
      const m = enMarche[Math.floor(Math.random() * enMarche.length)];
      m.etat = "panne";
      notes.push(`🔧 L'Olmo n'a pas apprécié : ${m.nom} tombe mystérieusement en panne.`);
    }
  }

  // Coût des matières (boissons vendues) : proportionnel au CA RÉEL (avant vol —
  // un joueur attentif peut remarquer un ratio matières/CA anormalement haut…).
  const matieres = Math.round(caTotal * TAUX_MATIERES);

  // 🕵️ Voleur : détourne une part du CA. JAMAIS annoncé au récap (on n'est pas
  // censé le savoir). Montant biaisé vers le bas : souvent ~2 %, rarement gros.
  // Garde-fou : le CA affiché reste toujours ≥ 50 % du CA réel.
  const volEffet = trait("voleur")!.effet;
  let partVolee = 0;
  for (const e of equipeSemaine) {
    if (!aTrait(e, "voleur")) continue;
    partVolee += 0.02 + (volEffet.valeur - 0.02) * Math.pow(Math.random(), 3);
  }
  partVolee = Math.min(partVolee, 0.5);
  if (partVolee > 0 && caTotal > 0) {
    const vole = Math.round(caTotal * partVolee);
    caTotal -= vole;
    // Le détail par soir est réduit proportionnellement : rien ne dépasse.
    const ratio = caTotal / (caTotal + vole);
    for (const j of jours) j.ca = Math.round(j.ca * ratio);
  }

  // ---- Heures supplémentaires (payées en plus du salaire) ----
  // Compteur PERSISTANT de jours enchaînés, remis à zéro seulement par
  // REPOS_RESET jours de repos consécutifs (même à cheval sur deux semaines).
  // Chaque jour au-delà de JOURS_STANDARD = un niveau de plus, de plus en plus cher.
  let heuresSupTotal = 0;
  for (const e of actifs(state)) {
    let cout = 0;
    let niveauMax = 0;
    for (let j = 0; j < 7; j++) {
      if (e.reposJours[j]) {
        e.reposConsecutifs += 1;
        if (e.reposConsecutifs >= REPOS_RESET) e.joursSansRepos = 0;
      } else {
        e.reposConsecutifs = 0;
        e.joursSansRepos += 1;
        if (e.joursSansRepos > JOURS_STANDARD) {
          const niveau = e.joursSansRepos - JOURS_STANDARD;
          niveauMax = Math.max(niveauMax, niveau);
          cout += niveau * HEURES_SUP_RATIO * (e.salaire / 7);
        }
      }
    }
    cout = Math.round(cout);
    if (cout > 0) {
      heuresSupTotal += cout;
      notes.push(
        `⏰ ${e.nom} enchaîne sans vrai repos : heures sup jusqu'au niveau ${niveauMax} → +${cout} € cette semaine.`,
      );
    }
  }

  // Salaires (détail par salarié) + loyer + remboursement de prêt.
  const salairesDetail = actifs(state).map((e) => ({ nom: e.nom, montant: e.salaire }));
  const salaires = salairesDetail.reduce((s, l) => s + l.montant, 0);
  const loyer = state.loyer;
  const charges = CHARGES;

  // Emprunt initial : on rembourse un pourcentage du CA de la semaine, taux
  // progressif selon l'ancienneté de la dette (s'arrête quand tout est remboursé).
  let detteRemboursement = 0;
  if (state.detteRestant > 0) {
    detteRemboursement = Math.min(Math.round(caTotal * tauxDette(state.semaine)), state.detteRestant);
    state.detteRestant -= detteRemboursement;
  }
  // Dette à zéro (remboursée… ou emprunt de départ à 0 €) → écran de victoire.
  if (state.detteRestant <= 0 && state.semaineVictoire === undefined) {
    state.detteJusteSoldee = true;
    state.semaineVictoire = state.semaine;
  }

  // 🚨 Amende policière (procès pour tapage) : résolue maintenant que le CA de
  // la semaine est connu. La fermeture éventuelle prend effet la semaine prochaine.
  if (state.amendePoliceEnAttente) {
    const amende = Math.round(caTotal * state.amendePoliceEnAttente.pourcentage);
    state.budget -= amende;
    state.evenementsBudget -= amende;
    notes.push(`🚨 Amende de la mairie : ${amende} € (${Math.round(state.amendePoliceEnAttente.pourcentage * 100)} % du CA de la semaine).`);
    if (state.amendePoliceEnAttente.fermeture) {
      state.barFermeProchaine = true;
      state.barFermeRaison = "police";
      notes.push(`🚔 Fermeture administrative : le bar restera porte close la semaine prochaine.`);
    }
    state.amendePoliceEnAttente = undefined;
  }

  // Prêt bancaire optionnel.
  let remboursement = 0;
  if (state.pret) {
    remboursement = state.pret.parSemaine;
    state.pret.restant -= remboursement;
    state.pret.semainesRestantes -= 1;
    if (state.pret.semainesRestantes <= 0) state.pret = undefined;
  }

  // Mode infini : charges qui grimpent semaine après semaine (remplacent la dette soldée).
  let inflation = 0;
  if (state.modeInfini && state.semaineVictoire !== undefined) {
    inflation = INFLATION_PAR_SEMAINE * (state.semaine - state.semaineVictoire);
  }

  // Le résultat inclut l'impact € des événements pour que le bilan soit honnête
  // (budget avant + résultat = budget après). Mais cet argent a DÉJÀ été
  // encaissé/décaissé au fil de la semaine : on ne le rejoue pas sur le budget.
  const evenements = state.evenementsBudget;
  const resultat =
    caTotal -
    matieres -
    salaires -
    heuresSupTotal -
    loyer -
    charges -
    detteRemboursement -
    remboursement -
    inflation +
    evenements;
  state.budget += resultat - evenements;

  // Les retours d'événements de la semaine (state.journal) passent en tête du récap.
  notes.unshift(...state.journal);
  state.journal = [];

  const bilan: WeeklyRecap = {
    semaine: state.semaine,
    jours,
    chiffreAffaires: caTotal,
    clientsTotal,
    refusesTotal,
    matieres,
    ruptures: ruptures.map((c) => c.nom),
    notorDelta,
    amblamPerte: amblamPerteSemaine,
    notes,
    salairesDetail,
    salaires,
    heuresSup: heuresSupTotal,
    loyer,
    charges,
    detteRemboursement,
    remboursement,
    inflation,
    evenements,
    resultat,
    budgetApres: state.budget,
  };
  state.dernierBilan = bilan;
  state.historique.push(bilan);
  state.evenementsBudget = 0; // compteur remis à zéro pour la semaine suivante

  state.phase = "recapPopup";
  verifierGameOver(state);
}

// ---- Commander des stocks chez le fournisseur ----

function totalCommandeBrut(
  state: GameState,
  cibles: Partial<Record<StockCategorie, number>>,
): number {
  let total = 0;
  for (const c of CATEGORIES_STOCK) {
    const cible = cibles[c.id];
    if (cible === undefined) continue;
    total += Math.max(0, cible - state.stocks[c.id]) * c.prix;
  }
  return total;
}

/** Coût AVANT remise Négociant — sert à afficher le prix barré côté UI. */
export function coutCommandeBrut(
  state: GameState,
  cibles: Partial<Record<StockCategorie, number>>,
): number {
  return Math.round(totalCommandeBrut(state, cibles));
}

/** Coût pour remonter chaque catégorie à sa cible (positions des curseurs). */
export function coutCommande(
  state: GameState,
  cibles: Partial<Record<StockCategorie, number>>,
): number {
  // 📦 Négociant : remise sur toutes les commandes tant qu'il est dans l'équipe.
  const remise = 1 + actifs(state).reduce((t, e) => t + bonusPassif(e, "achat"), 0);
  return Math.round(totalCommandeBrut(state, cibles) * Math.max(0.5, remise));
}

/** Passe la commande : applique les cibles atteignables si le budget suffit. */
export function commanderStocks(
  state: GameState,
  cibles: Partial<Record<StockCategorie, number>>,
): boolean {
  const cout = coutCommande(state, cibles);
  if (cout <= 0 || state.budget < cout) return false;
  state.budget -= cout;
  for (const c of CATEGORIES_STOCK) {
    const cible = cibles[c.id];
    if (cible !== undefined && cible > state.stocks[c.id]) {
      state.stocks[c.id] = Math.min(100, cible);
    }
  }
  return true;
}

// ---- Ménage (propreté) ----

/** Ménage fait par l'équipe : gratuit, +propreté, mais toute l'équipe se fatigue. */
export function menageEquipe(state: GameState): boolean {
  if (state.proprete >= 100 || actifs(state).length === 0) return false;
  for (const e of actifs(state)) e.fatigue = borne(e.fatigue + MENAGE.equipeFatigue);
  state.proprete = borne(state.proprete + MENAGE.equipeProprete);
  return true;
}

/** Devis de la société de nettoyage : déplacement + tarif par point à remonter. */
export function coutMenagePro(state: GameState): number {
  return Math.round(MENAGE.proBase + (100 - state.proprete) * MENAGE.proParPoint);
}

/** Société de nettoyage : payant (selon l'état), bar nickel, personne ne se fatigue. */
export function menagePro(state: GameState): boolean {
  const cout = coutMenagePro(state);
  if (state.proprete >= 100 || state.budget < cout) return false;
  state.budget -= cout;
  state.proprete = 100;
  return true;
}

// ---- Préparation de la semaine suivante ----

export function preparerSemaineSuivante(state: GameState): void {
  state.semaine += 1;
  state.reparTentees = [];

  // 🚔 Fermeture administrative décidée la semaine passée (procès policier perdu).
  state.barFerme = state.barFermeProchaine ?? false;
  state.barFermeProchaine = false;

  // Vacances accordées : le salarié pose ses 7 jours cette semaine, puis
  // reprend son planning normal (tout travaillé) la semaine d'après.
  for (const e of state.employes) {
    if (e.demissionne) continue;
    if (e.vacances === "posees") {
      e.reposAvantVacances = [...e.reposJours]; // planning à restaurer au retour
      e.reposJours = [true, true, true, true, true, true, true];
      e.vacances = "encours";
    } else if (e.vacances === "encours") {
      e.reposJours = e.reposAvantVacances ?? [false, false, false, false, false, false, false];
      e.reposAvantVacances = undefined;
      e.vacances = undefined;
    }
    // 🤒 Maladie (trait Fragile) : 2 jours d'arrêt imposés en début de semaine.
    if (e.maladie) {
      e.reposJours[0] = true;
      e.reposJours[1] = true;
      e.maladie = undefined;
    }
  }
  for (const cle of Object.keys(state.drapeaux)) {
    if (cle.startsWith("sem_")) delete state.drapeaux[cle];
  }

  const budgetAvantDifferes = state.budget;
  for (const effet of state.effetsDifferes) appliquerEffet(state, effet);
  state.evenementsBudget += state.budget - budgetAvantDifferes;
  state.effetsDifferes = [];

  // Hausse de loyer LINÉAIRE : la pression monte, mais un bar qui grandit la
  // sème — l'exponentiel (×1.1) condamnait mathématiquement toute partie longue.
  if ((state.semaine - 1) % 5 === 0) {
    state.loyer += LOYER_HAUSSE;
  }

  // 🤖 Auto-stock : remonte toutes les catégories à fond, mais PAIE le plein tarif
  // (remise Négociant incluse) — pratique, mais peut faire fondre le budget si le
  // stock n'était pas vraiment nécessaire cette semaine-là.
  if (state.autoStockActif) {
    const cibles: Partial<Record<StockCategorie, number>> = {};
    for (const c of CATEGORIES_STOCK) cibles[c.id] = 100;
    const cout = coutCommande(state, cibles);
    if (cout > 0) {
      state.budget -= cout;
      for (const c of CATEGORIES_STOCK) state.stocks[c.id] = 100;
      state.journal.push(`🤖 Auto-stock : réapprovisionnement automatique complet (-${cout} €).`);
    }
  }

  arriveeCV(state);
  gererDemissions(state);
  verifierGameOver(state);
}

/** Arrivée irrégulière de CV : 0 à 2 par semaine (40 % / 40 % / 20 %),
 *  plafonnée à CV_MAX. Rien les 3 premières semaines (le bar vient d'ouvrir). */
function arriveeCV(state: GameState): void {
  if (state.semaine < CV_SEMAINE_DEBUT) return; // pas de CV avant la semaine 4
  const r = Math.random();
  const nb = r < 0.4 ? 0 : r < 0.8 ? 1 : 2;
  for (let i = 0; i < nb; i++) {
    if (state.cvRecus.length >= CV_MAX) break; // boîte pleine → on n'en reçoit plus
    const exclus = [
      ...state.cvRecus.map((cv) => cv.profil.id),
      ...state.employes.map((e) => e.id), // pas de CV d'un salarié déjà embauché
    ];
    const cv = genererCV(exclus);
    if (cv) state.cvRecus.push(cv);
  }
}

// ---- Conditions de défaite ----

function verifierGameOver(state: GameState): void {
  if (state.budget <= 0) {
    state.phase = "gameover";
    state.raisonFin = "Faillite : le budget est tombé à 0 €.";
    return;
  }
  // Fin alternative : Antho poussé à bout a claqué la porte (ou pire).
  const antho = state.employes.find((e) => e.irrevocable);
  if (antho?.demissionne) {
    state.phase = "gameover";
    state.raisonFin = state.drapeaux["drame_antho"]
      ? "Antho n'est plus là. Le cœur du bar s'est éteint avec lui — l'aventure s'arrête ici."
      : "Antho, épuisé et à bout, a claqué la porte. Impossible de continuer l'aventure sans ton élément le plus important…";
    return;
  }
  if (actifs(state).length === 0) {
    state.phase = "gameover";
    state.raisonFin = "Plus aucun salarié : le bar ne peut plus tourner.";
  }
}

// ---- Pastilles de notification du hub ----

export const MENUS = [
  "salaries",
  "cv",
  "stock",
  "reparations",
  "menage",
  "travaux",
  "banque",
  "historique",
  "calendrier",
];

export function statutNotif(s: GameState, menu: string): Statut {
  switch (menu) {
    case "salaries": {
      if (
        actifs(s).some(
          (e) => e.fatigue >= SEUIL_DEMISSION_FATIGUE && e.moral <= SEUIL_DEMISSION_MORAL,
        )
      )
        return "rouge"; // démission imminente
      if (actifs(s).some((e) => e.moral < 40 || e.fatigue >= 75)) return "orange";
      return "vert";
    }
    case "cv":
      // Pastille grisée tant qu'il n'y a rien à gérer ; verte quand un CV attend.
      return s.cvRecus.length > 0 ? "vert" : "gris";
    case "stock": {
      if (CATEGORIES_STOCK.some((c) => s.stocks[c.id] <= 0)) return "rouge";
      if (CATEGORIES_STOCK.some((c) => s.stocks[c.id] < 50)) return "orange";
      return "vert";
    }
    case "reparations":
      if (s.machines.some((m) => m.etat === "panne")) return "rouge";
      if (s.machines.some((m) => m.hp < 50)) return "orange";
      return "vert";
    case "menage":
      if (s.proprete < 40) return "rouge";
      if (s.proprete < 60) return "orange";
      return s.proprete >= 90 ? "gris" : "vert"; // ≥ 90 : rien à faire, la case dort
    case "travaux":
      // Le local bride la capacité de service : il est temps d'agrandir.
      if (pointsEquipe(s) * CLIENTS_PAR_POINT > capaciteLocale(s)) return "orange";
      return "vert";
    case "banque":
      return s.budget < 10_000 ? "orange" : "vert";
    default:
      return "vert";
  }
}

// ---- Ingénieur, réparations, améliorations ----

/** Au moins un salarié actif avec la force Ingénieur (répare aussi les pannes à la main). */
export function aIngenieur(s: GameState): boolean {
  return actifs(s).some((e) => aTrait(e, "ingenieur"));
}

/** Tentative de réparation par l'ingénieur : gratuite, 50 %, une fois/semaine/machine. */
export function reparerIngenieur(state: GameState, id: string): boolean {
  const m = state.machines.find((x) => x.id === id);
  if (!m || m.etat !== "panne" || !aIngenieur(state) || state.reparTentees.includes(id)) return false;
  state.reparTentees.push(id);
  if (Math.random() < 0.5) {
    reparerMachine(m);
    return true;
  }
  return false;
}

/** Réparation professionnelle : payante, fiable. */
export function reparerPro(state: GameState, id: string): boolean {
  const m = state.machines.find((x) => x.id === id);
  if (!m || m.etat !== "panne") return false;
  const cout = coutReparation(m);
  if (state.budget < cout) return false;
  state.budget -= cout;
  reparerMachine(m);
  return true;
}

/** Améliorations débloquées à partir de la semaine 5. */
export function ameliorationsDebloquees(state: GameState): boolean {
  return state.semaine >= SEMAINE_AMELIORATIONS;
}

/** Prix de la machine "auto-stock" (case Fournisseur, débloquée sem. 5). */
export function coutAutoStock(): number {
  return COUT_AUTO_STOCK;
}

/** Achète la machine auto-stock (une fois pour toutes) et l'active directement. */
export function acheterAutoStock(state: GameState): boolean {
  if (!ameliorationsDebloquees(state) || state.autoStockAchete) return false;
  if (state.budget < COUT_AUTO_STOCK) return false;
  state.budget -= COUT_AUTO_STOCK;
  state.autoStockAchete = true;
  state.autoStockActif = true;
  return true;
}

/** Active/désactive l'auto-stock (sans effet si pas encore achetée). */
export function toggleAutoStock(state: GameState): void {
  if (!state.autoStockAchete) return;
  state.autoStockActif = !state.autoStockActif;
}

export function ameliorerMachine(state: GameState, id: string): boolean {
  if (!ameliorationsDebloquees(state)) return false;
  const m = state.machines.find((x) => x.id === id);
  if (!m || m.niveau >= NIVEAU_MAX) return false;
  const cout = coutAmelioration(m);
  if (state.budget < cout) return false;
  state.budget -= cout;
  appliquerAmelioration(m);
  return true;
}

// ---- Banque / prêts (GDD §4) ----

export interface OptionPret {
  id: string;
  montant: number;
  semaines: number;
  parSemaine: number;
}

export function pretsDisponibles(): OptionPret[] {
  const offre = (id: string, montant: number, semaines: number): OptionPret => ({
    id,
    montant,
    semaines,
    parSemaine: Math.ceil((montant * 1.15) / semaines),
  });
  return [offre("court", 10_000, 3), offre("moyen", 20_000, 5), offre("long", 30_000, 10)];
}

export function souscrirePret(state: GameState, id: string): boolean {
  if (state.pret) return false;
  const opt = pretsDisponibles().find((o) => o.id === id);
  if (!opt) return false;
  state.budget += opt.montant;
  state.pret = {
    montant: opt.montant,
    restant: opt.parSemaine * opt.semaines,
    parSemaine: opt.parSemaine,
    semainesRestantes: opt.semaines,
  };
  return true;
}
