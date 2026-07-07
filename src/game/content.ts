// ============================================================
//  CONTENU DU JEU — salariés + candidats + événements.
// ============================================================

import type { Choice, CV, Employee, Fonction, GameEvent, GameState, NiveauPrix, StockCategorie } from "./types";
import { aTrait, tirerTraits } from "./traits";

function rand(min: number, max: number): number {
  return Math.floor(min + Math.random() * (max - min + 1));
}

/** Planning de repos vierge : travaille les 7 jours (Lun→Dim). */
function aucunRepos(): boolean[] {
  return [false, false, false, false, false, false, false];
}

// ---- Catégories de stock (GDD §12) ----
// Une seule source de vérité : ordre = volume de vente décroissant.
//   conso  = points de stock consommés PAR client servi (bière = le plus vendu)
//   prix   = coût € pour réassortir 1 point de cette catégorie
//   poids  = importance : plus il est élevé, plus une rupture plombe la notoriété
export interface CategorieStock {
  id: StockCategorie;
  nom: string;
  emoji: string;
  conso: number;
  prix: number;
  poids: number;
}

export const CATEGORIES_STOCK: CategorieStock[] = [
  { id: "bieres", nom: "Bières", emoji: "🍺", conso: 0.06, prix: 8, poids: 5 },
  { id: "cocktails", nom: "Cocktails", emoji: "🍸", conso: 0.045, prix: 12, poids: 4 },
  { id: "repas", nom: "Repas", emoji: "🍽️", conso: 0.035, prix: 15, poids: 3 },
  { id: "softs", nom: "Softs", emoji: "🥤", conso: 0.022, prix: 6, poids: 2 },
  { id: "chaudes", nom: "Boissons chaudes", emoji: "☕", conso: 0.015, prix: 5, poids: 1 },
  { id: "vin", nom: "Vin", emoji: "🍷", conso: 0.012, prix: 10, poids: 1 },
];

/** Toutes les jauges de stock au maximum (état de départ). */
export function stocksPleins(): Record<StockCategorie, number> {
  return Object.fromEntries(CATEGORIES_STOCK.map((c) => [c.id, 100])) as Record<
    StockCategorie,
    number
  >;
}

// ---- Calendrier : 12 mois d'année SCOLAIRE (septembre → août) ----
// 1 mois = 4 semaines ; on boucle tous les 48 semaines (mode infini inclus).
// `indice` = texte affiché au joueur. `attente` = config de prix SECRÈTE que le
// mois récompense (voir facteurMois dans engine) : jamais montrée telle quelle.
export interface MoisInfo {
  nom: string;
  indice: string;
  attente: Record<StockCategorie, NiveauPrix>;
}

// Raccourci pour écrire une attente dans l'ordre des CATEGORIES_STOCK.
const att = (
  bieres: NiveauPrix,
  cocktails: NiveauPrix,
  repas: NiveauPrix,
  softs: NiveauPrix,
  chaudes: NiveauPrix,
  vin: NiveauPrix,
): Record<StockCategorie, NiveauPrix> => ({ bieres, cocktails, repas, softs, chaudes, vin });

// Attentes calibrées en spreads (≈ 2 petit / 2 moyen / 2 gros par mois) pour que
// « moyen partout » reste ≈ neutre (×1.0) et que coller au mois soit un VRAI bonus.
// Ordre des colonnes : bières, cocktails, repas, softs, boissons chaudes, vin.
export const MOIS_INFOS: MoisInfo[] = [
  { nom: "Septembre", indice: "C'est la rentrée, les étudiants arrivent en force !", attente: att("petit", "petit", "gros", "moyen", "gros", "moyen") },
  { nom: "Octobre", indice: "L'Oktoberfest bat son plein, on picole sérieusement !", attente: att("gros", "moyen", "gros", "petit", "petit", "moyen") },
  { nom: "Novembre", indice: "Les anciens commencent à avoir froid…", attente: att("petit", "moyen", "gros", "petit", "gros", "moyen") },
  { nom: "Décembre", indice: "Bientôt Noël, plus personne n'a d'argent…", attente: att("petit", "petit", "moyen", "moyen", "gros", "gros") },
  { nom: "Janvier", indice: "Tout le monde fait le Dry January ?!", attente: att("gros", "gros", "moyen", "petit", "petit", "moyen") },
  { nom: "Février", indice: "C'est la Saint-Valentin tout le mois, il faut croire…", attente: att("petit", "gros", "moyen", "petit", "moyen", "gros") },
  { nom: "Mars", indice: "Le soleil revient, les terrasses se remplissent !", attente: att("petit", "moyen", "gros", "petit", "moyen", "gros") },
  { nom: "Avril", indice: "Rien de spécial ce mois-ci… un mois tranquille.", attente: att("moyen", "moyen", "moyen", "moyen", "moyen", "moyen") },
  { nom: "Mai", indice: "Il fait bon, c'est le moment de venir manger, non ?", attente: att("moyen", "petit", "gros", "moyen", "petit", "gros") },
  { nom: "Juin", indice: "Fête de la musique tout le mois ! Qu'est-ce qu'on boit ?!", attente: att("petit", "petit", "gros", "moyen", "gros", "moyen") },
  { nom: "Juillet", indice: "FOOOOOOTBAAAALL ! Qu'est-ce qu'on boit ?", attente: att("petit", "moyen", "gros", "petit", "gros", "moyen") },
  { nom: "Août", indice: "La ville se vide… ça se voit que c'est les vacances…", attente: att("gros", "gros", "petit", "petit", "moyen", "moyen") },
];

/** Index du mois (0 = Septembre) pour une semaine donnée : 1 mois = 4 semaines.
 *  moisDepart décale le point de départ (mois aléatoire tiré à la création de la partie). */
export function moisIndex(semaine: number, moisDepart = 0): number {
  return (Math.floor((Math.max(1, semaine) - 1) / 4) + moisDepart) % 12;
}

/** Infos du mois en cours (nom, indice, attente de prix). */
export function moisDeSemaine(semaine: number, moisDepart = 0): MoisInfo {
  return MOIS_INFOS[moisIndex(semaine, moisDepart)];
}

const MOIS_ABBR: Record<string, string> = {
  Septembre: "SEP",
  Octobre: "OCT",
  Novembre: "NOV",
  Décembre: "DEC",
  Janvier: "JAN",
  Février: "FEV",
  Mars: "MAR",
  Avril: "AVR",
  Mai: "MAI",
  Juin: "JUN",
  Juillet: "JUL",
  Août: "AOU",
};

/** Abréviation 3 lettres d'un nom de mois (pour la barre de stats). */
export function moisAbrege(nom: string): string {
  return MOIS_ABBR[nom] ?? nom.slice(0, 3).toUpperCase();
}

// ---- Le salarié de base : Antho ----

/** L'équipe de départ : Antho seul (barman obligatoire, contrat irrévocable). */
export function equipeDeDepart(): Employee[] {
  const traits = tirerTraits();
  return [
    {
      id: "antho",
      nom: "Antho",
      emoji: "🧔",
      salaire: 900,
      moral: 60,
      competence: 80,
      fatigue: 0,
      semaineEmbauche: 1,
      reposJours: aucunRepos(),
      joursSansRepos: 0,
      reposConsecutifs: 0,
      forces: traits.forces,
      faiblesses: traits.faiblesses,
      irrevocable: true,
    },
  ];
}

// ---- Le vivier de candidats à l'embauche (roster du GDD §6) ----

interface ModeleCandidat {
  id: string;
  nom: string;
  emoji: string;
}

const ROSTER: ModeleCandidat[] = [
  { id: "camille", nom: "Camille", emoji: "👩" },
  { id: "benji", nom: "Benji", emoji: "💂" },
  { id: "driss", nom: "Driss", emoji: "👨‍🍳" },
  { id: "nadia", nom: "Nadia", emoji: "💁" },
  { id: "paulo", nom: "Paulo", emoji: "📦" },
  { id: "sophie", nom: "Sophie", emoji: "🧮" },
  { id: "rayan", nom: "Rayan", emoji: "🧑" },
  { id: "marco", nom: "Marco", emoji: "🕴" },
  { id: "lea", nom: "Léa", emoji: "👧" },
];

// Le salaire demandé suit la compétence tirée au sort (± marge de négociation),
// arrondi à la dizaine. Comp 45 ≈ 315 €, comp 60 ≈ 420 €, comp 80 ≈ 560 € —
// fourchette volontairement basse (un salarié apporte peu de capacité, EFF_SALARIE).
const SALAIRE_PAR_COMP = 7; // €/semaine par point de compétence
const SALAIRE_NEGO = 0.12; // ±12 % d'aléa de négociation
function salairePourCompetence(competence: number): number {
  const brut = competence * SALAIRE_PAR_COMP * (1 + (Math.random() * 2 - 1) * SALAIRE_NEGO);
  return Math.max(300, Math.round(brut / 10) * 10);
}

/** Génère `n` candidats aléatoires distincts. */
export function genererCandidats(n: number, dejaPresents: string[] = []): Employee[] {
  const dispo = ROSTER.filter((m) => !dejaPresents.includes(m.id));
  const melange = [...dispo].sort(() => Math.random() - 0.5).slice(0, n);
  return melange.map((m) => {
    const traits = tirerTraits();
    const competence = rand(45, 80);
    return {
      id: m.id,
      nom: m.nom,
      emoji: m.emoji,
      salaire: salairePourCompetence(competence),
      moral: rand(60, 75),
      competence,
      fatigue: 0,
      semaineEmbauche: 1, // écrasée à l'embauche réelle (engine)
      reposJours: aucunRepos(),
      joursSansRepos: 0,
      reposConsecutifs: 0,
      forces: traits.forces,
      faiblesses: traits.faiblesses,
    };
  });
}

// ---- Profils de CV (case CV du hub) ----
// Candidats qui peuvent arriver sous forme de CV au fil des semaines.
// Traits PAS encore attribués (étape suivante) : ici, juste les profils.

interface ProfilCV {
  id: string;
  nom: string;
  emoji: string;
  semaineMin?: number; // n'apparaît dans les CV qu'à partir de cette semaine
  fonction?: Fonction; // salarié SPÉCIAL : hors service, à effet passif fort
  salaireFixe?: number; // salaire imposé (sinon dérivé de la compétence tirée)
}

const CV_PROFILS: ProfilCV[] = [
  { id: "nate", nom: "Nate", emoji: "🧑" },
  { id: "robs", nom: "Rob's", emoji: "💂" },
  { id: "maxou", nom: "Maxou", emoji: "🧔" },
  { id: "coco", nom: "Coco", emoji: "👩" },
  { id: "marco", nom: "Marc'O", emoji: "👨‍🍳" },
  { id: "jaja", nom: "JaJa", emoji: "🧑‍🔧" },
  { id: "loulou", nom: "LouLou", emoji: "👱‍♀️" },
  { id: "ananis", nom: "Ananis", emoji: "👩‍🍳" },
  { id: "coco_h", nom: "Coco", emoji: "🧑‍🦱" },
  { id: "harmo", nom: "Harmo", emoji: "🧑‍🎤" },
  { id: "vix", nom: "Vix", emoji: "👩‍🎤" },
  { id: "pasco", nom: "Pasco", emoji: "🕴" },
  // Salariés SPÉCIAUX (hors service) : arrivent tard, salaire fixe élevé.
  { id: "mecano", nom: "le Mécano", emoji: "🔧", fonction: "mecano", semaineMin: 15, salaireFixe: 1100 },
  { id: "psy", nom: "la Psy", emoji: "🧠", fonction: "psychologue", semaineMin: 20, salaireFixe: 1200 },
];

/** Transforme un profil de CV en salarié : compétence tirée au sort à la
 *  génération du CV, salaire demandé dérivé de cette compétence. */
function profilVersEmploye(p: ProfilCV): Employee {
  // Salarié SPÉCIAL (fonction) : salaire fixe, pas de compétence ni de traits — il
  // ne fait pas le service, son intérêt est son effet passif (voir engine).
  if (p.fonction) {
    return {
      id: p.id,
      nom: p.nom,
      emoji: p.emoji,
      salaire: p.salaireFixe ?? 1000,
      moral: 80,
      competence: 0,
      fatigue: 0,
      semaineEmbauche: 1,
      reposJours: aucunRepos(),
      joursSansRepos: 0,
      reposConsecutifs: 0,
      forces: [],
      faiblesses: [],
      fonction: p.fonction,
    };
  }
  const traits = tirerTraits();
  const competence = rand(45, 80);
  return {
    id: p.id,
    nom: p.nom,
    emoji: p.emoji,
    salaire: salairePourCompetence(competence),
    moral: 70,
    competence,
    fatigue: 0,
    semaineEmbauche: 1, // écrasée à l'embauche réelle (engine)
    reposJours: aucunRepos(),
    joursSansRepos: 0,
    reposConsecutifs: 0,
    forces: traits.forces,
    faiblesses: traits.faiblesses,
  };
}

/** Génère un CV pour un profil pas déjà présent dans la boîte, ÉLIGIBLE cette
 *  semaine (les spéciaux ont un `semaineMin`) — ou null si le pool est épuisé. */
export function genererCV(dejaPresents: string[] = [], semaine = 999): CV | null {
  const dispo = CV_PROFILS.filter(
    (p) => !dejaPresents.includes(p.id) && (p.semaineMin ?? 0) <= semaine,
  );
  if (dispo.length === 0) return null;
  const p = dispo[Math.floor(Math.random() * dispo.length)];
  return {
    profil: profilVersEmploye(p),
    faiblessesMasquees: p.fonction ? false : Math.random() < 0.4, // spéciaux : rien à cacher
  };
}

// ---- Banque d'événements (chantier C) ----
// Pop-ups « Aujourd'hui… » pendant la semaine. Certains sont de simples
// constats (1 bouton), d'autres des choix risqués (Effect.tirage), et
// certains dépendent des traits de l'équipe (Musclé, Mafieux, Ingénieur).

/** Un salarié actif possède ce trait ? (condition d'événement) */
function equipeA(s: GameState, id: string): boolean {
  return s.employes.some((e) => !e.demissionne && aTrait(e, id));
}

/** Ancienneté minimale (en semaines) avant qu'un salarié ose demander une augmentation. */
const ANCIENNETE_AUGMENTATION = 8;

/** Le salarié le plus ancien qui mérite une augmentation (jamais eue, ou pas récente). */
function salarieEligibleAugmentation(s: GameState): Employee | undefined {
  return s.employes
    .filter(
      (e) =>
        !e.demissionne &&
        s.semaine - e.semaineEmbauche >= ANCIENNETE_AUGMENTATION &&
        (e.semaineAugmentation === undefined ||
          s.semaine - e.semaineAugmentation >= ANCIENNETE_AUGMENTATION),
    )
    .sort((a, b) => a.semaineEmbauche - b.semaineEmbauche)[0];
}

/** Un salarié actif au hasard (pour les événements qui visent n'importe qui). */
function salarieAuHasard(s: GameState): Employee | undefined {
  const a = s.employes.filter((e) => !e.demissionne);
  return a[Math.floor(Math.random() * a.length)];
}

/** Coût qui suit le budget courant (% du budget, borné plancher/plafond) — évite
 *  qu'un tarif fixe devienne dérisoire une fois le budget bien monté. */
function coutAdaptatif(s: GameState, pourcentage: number, plancher: number, plafond: number): number {
  const brut = s.budget * pourcentage;
  return Math.round(Math.min(plafond, Math.max(plancher, brut)) / 50) * 50;
}

/** Fatigue au-delà de laquelle un salarié réclame des vacances. */
const SEUIL_VACANCES = 62;

/** Le salarié le plus fatigué qui réclame des vacances (fatigue > 50, pas déjà en congés,
 *  pas déjà engagé dans une escalade de refus — voir salarieVacancesMenace/Proces). */
function salarieEpuise(s: GameState): Employee | undefined {
  return s.employes
    .filter(
      (e) =>
        !e.demissionne &&
        e.vacances === undefined &&
        e.fatigue > SEUIL_VACANCES &&
        (e.vacancesRefus ?? 0) === 0,
    )
    .sort((a, b) => b.fatigue - a.fatigue)[0];
}

/** Refusé une fois : revient la semaine suivante menacer d'un procès. */
export function salarieVacancesMenace(s: GameState): Employee | undefined {
  return s.employes.find(
    (e) =>
      !e.demissionne &&
      e.vacances === undefined &&
      (e.vacancesRefus ?? 0) === 1 &&
      s.semaine > (e.vacancesRefusSemaine ?? 0),
  );
}

/** Refusé une seconde fois : le procès est enclenché la semaine suivante. */
export function salarieVacancesProces(s: GameState): Employee | undefined {
  return s.employes.find(
    (e) =>
      !e.demissionne &&
      e.vacances === undefined &&
      (e.vacancesRefus ?? 0) >= 2 &&
      s.semaine > (e.vacancesRefusSemaine ?? 0),
  );
}

// ---- Le tacos de Brisco (config à 4 cases, voir "brisco_tacos") ----
// Seules la viande et la sauce comptent pour la récompense ; sauce fromagère
// et crudités sont purement cosmétiques (aucun effet sur le résultat).
export const TACOS_VIANDES = ["Steak", "Kebab", "Cordon bleu", "Merguez"];
export const TACOS_SAUCE_FROMAGERE = ["Avec", "Sans"];
export const TACOS_SAUCES = ["Blanche", "Barbecue", "Algérienne", "Samouraï"];
export const TACOS_CRUDITES = ["Tomate", "Salade", "Oignons", "Poivrons"];
export const TACOS_VIANDE_CORRECTE = 2; // Cordon bleu
export const TACOS_SAUCE_CORRECTE = 1; // Barbecue

export const EVENEMENTS: GameEvent[] = [
  // ---- Bagarres (activent la force Musclé) ----
  {
    id: "bagarre",
    titre: "Ça chauffe au comptoir !",
    texte:
      "Aujourd'hui, Lowen et Polo, deux habitués, en viennent aux mains pour une histoire de tournée. Les autres clients reculent, un tabouret vole…",
    condition: (s) => !equipeA(s, "muscle") && s.semaine > (Number(s.drapeaux.protection_bagarre_fin) || 0),
    choix: [
      {
        label: "T'interposer toi-même",
        effet: {
          tirage: {
            proba: 0.5,
            succes: { notoriete: 2, note: "🥊 Tu as calmé la bagarre avec autorité. Les clients applaudissent !" },
            echec: { budget: -350, notoriete: -3, note: "🥊 Tu as pris un coup et deux tables sont cassées (-350 €)." },
          },
        },
      },
      {
        label: "Appeler la police",
        effet: { notoriete: -2, note: "🚔 La police a embarqué tout le monde. Ambiance plombée pour la soirée." },
      },
      {
        label: "Laisser faire",
        effet: { budget: -500, notoriete: -5, note: "💥 La bagarre a dégénéré : verre brisé, clients enfuis (-500 €)." },
      },
    ],
  },
  {
    id: "bagarre_evitee",
    titre: "Ça allait chauffer…",
    texte:
      "Lowen et Polo montent le ton, les poings se serrent — mais ton videur musclé pose une main sur chaque épaule. Tout le monde se rassoit.",
    condition: (s) => equipeA(s, "muscle") && s.semaine > (Number(s.drapeaux.protection_bagarre_fin) || 0),
    choix: [
      {
        label: "Offrir une tournée pour détendre",
        effet: { notoriete: 3, stock: { bieres: -5 }, note: "💪 Bagarre évitée avec classe. Le quartier en parle." },
      },
      {
        label: "En rester là",
        effet: { notoriete: 1, note: "💪 Bagarre étouffée dans l'œuf. Soirée sauvée." },
      },
    ],
  },

  // ---- Le « milieu » (active la force Mafieux) ----
  {
    id: "racket",
    titre: "Ruelle d'Olmo",
    texte:
      "Aujourd'hui, Momo, un homme bien costaud entre dans le bar, propose une « assurance tranquillité » pour ton établissement. Son sourire ne rassure pas.",
    condition: (s) => !equipeA(s, "mafieux"),
    genererChoix: (s) => [
      {
        label: "Payer 600 € pour être tranquille",
        effet: {
          budget: -600,
          poseDrapeau: { cle: "protection_bagarre_fin", valeur: s.semaine + 4 },
          note: "🤝 Tu as payé. Le quartier restera calme un moment (plus de bagarre pendant 4 semaines).",
        },
      },
      {
        label: "Refuser poliment",
        effet: {
          tirage: {
            proba: 0.3,
            risque: true, // la zone = la menace de représailles
            succes: { casseMachineAleatoire: true, note: "💢 Représailles nocturnes : une machine a été sabotée." },
            echec: { note: "😮‍💨 Aucune représaille… cette fois." },
          },
        },
      },
    ],
    choix: [], // remplacés au tirage par genererChoix
  },
  {
    id: "racket_mafieux",
    titre: "Ruelle d'Olmo",
    texte:
      "Momo entre dans le bar et reconnaît un salarié : « T'es de la famille toi ? Ça va mon frère ?! »",
    condition: (s) => equipeA(s, "mafieux"),
    genererChoix: (s) => [
      {
        label: "Payer le « tarif ami » (200 €)",
        effet: {
          budget: -200,
          notoriete: 2,
          poseDrapeau: { cle: "protection_bagarre_fin", valeur: s.semaine + 4 },
          note: "🤝 Protection au rabais. Le quartier sait que ton bar est intouchable (plus de bagarre pendant 4 semaines).",
        },
      },
      {
        label: "Décliner, entre gens de confiance",
        effet: { note: "🤝 Poignée de main, sourires. Personne ne touchera à ton bar." },
      },
    ],
    choix: [], // remplacés au tirage par genererChoix
  },

  // ---- Farfelus & vie de quartier ----
  {
    id: "influenceur",
    titre: "Un influenceur en tournée",
    texte:
      "Aujourd'hui, Mister G, (5 millions d'abonnés, dégaine ridicule), s'installe et filme tout. Il « adorerait goûter un peu tout »",
    unique: true,
    choix: [
      {
        label: "Tournée générale offerte (pour la caméra)",
        effet: {
          stock: { bieres: -8, cocktails: -8 },
          tirage: {
            proba: 0.75,
            aide: "ambianceur",
            succes: { notoriete: 9, note: "📱 Sa story cartonne : le bar est plein à craquer de curieux !" },
            echec: { notoriete: -2, note: "📱 Il a trouvé la bière « tiède » en story. Aïe." },
          },
        },
      },
      {
        label: "Le traiter comme tout le monde",
        effet: {
          tirage: {
            proba: 0.3,
            aide: "ambianceur",
            succes: { notoriete: 4, note: "📱 Il a adoré l'authenticité ! Bonne pub gratuite." },
            echec: { note: "📱 Il est reparti sans poster. Tant pis." },
          },
        },
      },
    ],
  },
  {
    id: "hygiene_ok",
    titre: "Contrôle d'hygiène surprise",
    texte:
      "Aujourd'hui, une inspectrice de l'hygiène débarque sans prévenir, gants blancs et regard d'acier. Elle inspecte chaque recoin…",
    condition: (s) => s.semaine >= 7 && s.proprete >= 50,
    choix: [
      {
        label: "La laisser faire, tout est en ordre",
        effet: { notoriete: 3, note: "🧾 Rapport impeccable ! De quoi rassurer la clientèle." },
      },
    ],
  },
  {
    id: "hygiene_ko",
    titre: "Contrôle d'hygiène surprise",
    texte:
      "Aujourd'hui, une inspectrice de l'hygiène débarque sans prévenir… et ton bar n'est PAS présentable. Elle fronce déjà les sourcils.",
    condition: (s) => s.semaine >= 7 && s.proprete < 50,
    choix: [
      {
        label: "Assumer et payer l'amende",
        effet: { budget: -800, note: "🧾 Amende salée (-800 €), mais l'affaire s'arrête là." },
      },
      {
        label: "Glisser discrètement un billet",
        effet: {
          budget: -400,
          tirage: {
            proba: 0.6,
            aide: "mafieux",
            succes: { note: "🤫 Elle a « oublié » son rapport dans le taxi." },
            echec: { budget: -1200, notoriete: -4, note: "🚨 Tentative de corruption ! Amende doublée et réputation entachée." },
          },
        },
      },
    ],
  },
  {
    id: "rat",
    titre: "Un invité indésirable",
    texte:
      "Aujourd'hui, un rat obèse traverse tranquillement la salle en plein service, sous les yeux d'une tablée entière.",
    condition: (s) => s.proprete < 60, // un bar bien tenu n'a pas de rats
    genererChoix: (s) => {
      const coutDeratiseur = coutAdaptatif(s, 0.03, 150, 1500);
      return [
        {
          label: `Appeler le dératiseur (${coutDeratiseur} €)`,
          effet: { budget: -coutDeratiseur, proprete: 5, note: "🐀 Dératisation express. On n'en parle plus." },
        },
        {
          label: "« C'est Rémy, notre mascotte ! »",
          effet: {
            tirage: {
              proba: 0.4,
              aide: "ambianceur",
              succes: { notoriete: 3, note: "🐀 Les clients ont ri. Rémy a son hashtag." },
              echec: { notoriete: -5, note: "🐀 Photo du rat sur les réseaux. Catastrophe d'image." },
            },
          },
        },
      ];
    },
    choix: [], // remplacés au tirage par genererChoix
  },
  {
    id: "loterie",
    titre: "Le ticket de Gégé",
    texte:
      "Aujourd'hui, Gégé, pilier de comptoir, te propose son ticket à gratter « porte-bonheur » contre 50 €. « J'te jure patron, j'le sens bien çui-là. »",
    genererChoix: (s) => {
      const mise = Math.max(1, Math.round(s.budget * 0.05));
      const gain = Math.max(1, Math.round(s.budget * 0.25));
      return [
        {
          label: `Acheter le ticket (${mise.toLocaleString("fr-FR")} €)`,
          effet: {
            budget: -mise,
            tirage: {
              proba: 0.2,
              succes: {
                budget: gain,
                note: `🎫 INCROYABLE. Le ticket de Gégé était gagnant : +${gain.toLocaleString("fr-FR")} € !`,
              },
              echec: { note: "🎫 Perdu, évidemment. Gégé est déjà reparti commander." },
            },
          },
        },
        {
          label: "Décliner en souriant",
          effet: { note: "🎫 Gégé a gratté son ticket au comptoir. Perdu. Comme toujours." },
        },
      ];
    },
    choix: [], // remplacés au tirage par genererChoix
  },
  {
    id: "coupure_courant",
    titre: "Le quartier dans le noir",
    texte:
      "Aujourd'hui, coupure de courant générale en pleine soirée. Frigos à l'arrêt, tireuse muette, clients dans le noir…",
    choix: [
      {
        label: "Service à l'ancienne",
        effet: {
          tirage: {
            proba: 0.5,
            aide: "ambianceur",
            succes: { notoriete: 4, caSoirPourcent: -0.05, note: "🕯 Soirée aux bougies mémorable ! Les clients ont adoré (-5 % de CA ce soir quand même)." },
            echec: { caSoirPourcent: -0.12, note: "🕯 Sans musique ni pression, la salle s'est vidée (-12 % de CA ce soir)." },
          },
        },
      },
      {
        label: "Fermer pour la soirée",
        effet: { caSoirPourcent: -0.12, note: "🔌 Soirée perdue (-12 % de CA ce soir), mais au moins personne n'est reparti fâché." },
      },
    ],
  },
  {
    id: "don_asso",
    titre: "Le partenariat Amblam",
    texte:
      "Aujourd'hui, le représentant d'Amblam, l'asso du quartier, te propose un marché : une carte de réduction pour ses adhérents pendant un mois. « Tu y perds un peu chaque semaine… mais Amblam rend toujours le double à la fin. »",
    // Répercussion sur 4 semaines : CA amputé (AMBLAM.taux), puis le cumul
    // du manque à gagner est rendu ×2 la 5e semaine (voir engine.ts).
    condition: (s) => !s.partenariatAmblam,
    choix: [
      {
        label: "Signer le partenariat (4 semaines)",
        effet: {
          partenariatAmblam: true,
          notoriete: 2,
          note: "🤝 Cartes Amblam distribuées : ton CA va souffrir un mois… puis Amblam rendra le double du manque à gagner.",
        },
      },
      {
        label: "Décliner poliment",
        effet: { notoriete: -1, note: "🤝 Le représentant Amblam repart déçu. Le quartier en entend parler." },
      },
    ],
  },
  {
    id: "karaoke",
    titre: "Karaoké sauvage",
    texte:
      "Aujourd'hui, une bande d'anciens du quartier improvise un karaoké avec une enceinte portable. Le volume monte, les clients hésitent entre rire et fuir.",
    choix: [
      {
        label: "Brancher la sono et assumer",
        effet: { notoriete: 4, stock: { bieres: -6, softs: -4 }, fatigueEquipe: 5, note: "🎤 Soirée d'anthologie ! Épuisante, mais le quartier en parle encore." },
      },
      {
        label: "Couper court poliment",
        effet: { notoriete: -2, note: "🎤 Les chanteurs sont partis vexés finir la soirée ailleurs." },
      },
    ],
  },
  {
    id: "anniversaire",
    titre: "Privatisation surprise",
    texte:
      "Aujourd'hui, un client veut privatiser le bar dimanche soir pour les 40 ans de sa femme. Il paie bien, mais ton équipe devra mettre les bouchées doubles.",
    choix: [
      {
        label: "Accepter (+20 % de CA ce soir)",
        effet: { caSoirPourcent: 0.2, fatigueEquipe: 8, note: "🎂 Fête réussie, gros pourboire… et équipe sur les rotules." },
      },
      {
        label: "Refuser, le dimanche c'est sacré",
        effet: { note: "🎂 Il ira au bar d'en face. Tant pis pour les 20 %." },
      },
    ],
  },
  {
    id: "playlist_yeda",
    titre: "Yeda veut mixer",
    texte:
      "Yeda, l'ambianceur du quartier et habitué de longue date, te demande les codes de la playlist pour gérer la musique lui-même ce soir.",
    choix: [
      {
        label: "Lui laisser la main",
        effet: {
          capaciteSoir: 3,
          caSoirPourcent: 0.8,
          fatiguePresentsJour: 6,
          note: "🎧 Yeda aux platines : le bar est bondé toute la soirée, mais l'équipe n'a pas chômé.",
        },
      },
      {
        label: "Refuser, la musique c'est pour la maison",
        effet: {
          tirage: {
            proba: 0.2,
            risque: true,
            succes: {
              fatiguePresentsJour: 6,
              note: "😤 Vexé, Yeda passe la soirée à râler au comptoir. L'équipe encaisse, épuisée.",
            },
            echec: { note: "🙅 Refusé sans drame : Yeda hausse les épaules et boit sa bière tranquille." },
          },
        },
      },
    ],
  },
  {
    id: "soiree_tajine",
    titre: "Youbi organise une soirée Tajine",
    texte:
      "Youbi, fidèle client, veut organiser une soirée Tajine ce soir pour tous les habitués du quartier !",
    choix: [
      {
        label: "Accepter",
        effet: {
          caSoirPourcent: 0.3,
          note: "🍲 Soirée Tajine réussie : le bouche-à-oreille fait grimper le CA du soir.",
          tirage: {
            proba: 0.7,
            risque: true,
            succes: {
              notoriete: -4,
              note: "👃 L'odeur a dérangé pas mal de clients, qui ont préféré partir plus tôt.",
            },
            echec: { note: "😌 L'odeur est passée inaperçue, personne ne s'est plaint." },
          },
        },
      },
      {
        label: "Refuser",
        effet: { note: "🍲 Youbi ira cuisiner son tajine chez lui, tant pis pour l'ambiance." },
      },
    ],
  },
  {
    id: "corentin_verre",
    titre: "Corentin remet ça",
    texte:
      "Coco sosie de mbappe, un habitué, réclame un verre — et une nouvelle « sortie improvisée » avec un inconnu du quartier.",
    condition: (s) => s.semaine >= 6,
    choix: [
      {
        label: "Accepter",
        effet: {
          budget: 500,
          tirage: {
            proba: 0.5,
            risque: true,
            succes: {
              notoriete: -5,
              note: "🌃 Coco sosie de mbappe a embarqué un client au hasard dans la ruelle pour une « expérience » entre habitués — ça jase dans le quartier.",
            },
            echec: { note: "🌃 Coco sosie de mbappe s'est tenu tranquille cette fois, juste un verre entre habitués." },
          },
        },
      },
      { label: "Refuser", effet: { note: "🌃 Coco sosie de mbappe hausse les épaules et retourne à sa place." } },
    ],
  },
  {
    id: "groupie_antho",
    titre: "Une groupie pour Antho",
    texte: "Une femme entre dans le bar, cherche des yeux derrière le comptoir. « Il est là ce soir, Antho ? »",
    cibleId: "antho",
    genererChoix: (s) => {
      const jourIdx = s.jourAnim - 1;
      const autresPresents = s.employes.filter(
        (e) => !e.demissionne && !e.irrevocable && !e.reposJours[jourIdx],
      );
      const choixOui: Choice = {
        label: "Oui, il est là",
        effet: {
          caSoirPourcent: 0.1,
          moralCible: -10,
          note: "💃 Sa groupie s'installe au comptoir toute la soirée. Le CA en profite, Antho beaucoup moins.",
        },
      };
      if (autresPresents.length === 0) return [choixOui];
      return [
        choixOui,
        {
          label: "Non, il n'est pas là",
          effet: { notoriete: -3, note: "💃 Déçue, elle repart aussitôt sans un mot." },
        },
      ];
    },
    choix: [],
  },
  {
    id: "ayms_fumette",
    titre: "La récréation d'Ayms",
    texte: "Ayms, un habitué, propose à toute l'équipe de goûter à son « petit remède » derrière le local à poubelles.",
    choix: [
      {
        label: "Accepter",
        effet: {
          capaciteSoir: 1.5,
          fumetteAyms: true,
          note: "🌿 Toute l'équipe présente carbure à fond ce soir — la fatigue de la semaine s'en ressentira.",
        },
      },
      { label: "Refuser", effet: { note: "🌿 Ayms hausse les épaules et retourne à sa bière, seul." } },
    ],
  },
  {
    id: "lanela",
    titre: "Lanela",
    texte: "Une cliente entre dans le bar. Personne dans l'équipe ne peut la voir en peinture. Elle sourit : « Bonjour ! »",
    unique: true,
    condition: (s) => s.semaine >= 10,
    choix: [
      {
        label: "Lui répondre bonjour",
        effet: {
          soireeLanela: true,
          note: "😬 Lanela s'installe et lance la conversation. La soirée est longue, très longue…",
        },
      },
      { label: "L'ignorer", effet: { note: "😮‍💨 Elle hausse les épaules et repart aussitôt." } },
    ],
  },
  {
    id: "la_torche",
    titre: "La Torche fait sa tournée",
    texte: "La Torche est passé derrière le comptoir et s'est servi quelques bouteilles pour sa consommation perso. Tu l'as vu faire.",
    condition: (s) => !s.drapeaux["torche_viree"],
    choix: [
      {
        label: "Le virer du bar",
        effet: {
          stock: { bieres: -8, vin: -6 },
          notoriete: -10,
          poseDrapeau: { cle: "torche_viree", valeur: true },
          note: "🔥 La Torche jure qu'on ne le reverra plus — et le fait savoir haut et fort dans le quartier.",
        },
      },
      {
        label: "Ne rien dire",
        effet: {
          stock: { bieres: -8, vin: -6 },
          notoriete: 10,
          note: "🔥 Tu laisses filer. La Torche, ravi, vante ta clémence à qui veut l'entendre — il reviendra sûrement.",
        },
      },
    ],
  },
  {
    id: "mr_breton",
    titre: "Mr Breton passe à la caisse",
    texte:
      "Un homme en chemise à fleurs entre dans le bar — tu ne l'as jamais vu. « Je vois que l'affaire fonctionne bien ! J'ai besoin de m'acheter une nouvelle moto, je me permets de te prendre la moitié de ton budget. »",
    unique: true,
    condition: (s) => s.semainesBudgetHaut >= 4,
    choix: [
      {
        label: "D'accord Mr Breton ! Pas de soucis",
        effet: {
          poseDrapeau: { cle: "sem_breton_rancon", valeur: true },
          note: "🏍️ Mr Breton empoche la promesse et repart, tout sourire.",
        },
      },
    ],
  },
  {
    id: "olmo_arrangement",
    titre: "Un grand de l'Olmo",
    texte:
      "Un grand de l'Olmo entre dans le bar. Un air familier — difficile de savoir si tu peux lui faire confiance. Il te propose un arrangement : il te confie de grosses sommes à faire blanchir par le bar.",
    condition: (s) => s.semaine >= 15 && !s.drapeaux["blanchiment_actif"],
    genererChoix: (s) => {
      const budgetRef = s.historique[s.historique.length - 1]?.budgetApres ?? s.budget;
      const recu = Math.round(budgetRef * 0.5);
      const commission = Math.round(recu * 0.2);
      return [
        {
          // L'argent blanchi n'est PAS à toi : tu ne touches que ta commission,
          // versée à la fin de l'opération (olmo_cut). Aucun cash immédiat — donc
          // rien à "garder" en trichant, et la commission (positive) échappe à la
          // sévérité de fin de partie qui n'amplifie que les pertes.
          label: `Accepter (commission ~${commission.toLocaleString("fr-FR")} €)`,
          effet: {
            poseDrapeau: { cle: "blanchiment_actif", valeur: true },
            note: `🕴️ L'Olmo te confie ${recu.toLocaleString("fr-FR")} € à faire passer par les comptes du bar. Ta commission tombera une fois l'opération bouclée.`,
          },
          enchaine: { id: "olmo_cut", proba: 1 },
        },
        { label: "Refuser", effet: { note: "🕴️ Il hausse les épaules et repart sans insister." } },
      ];
    },
    choix: [],
  },
  {
    id: "olmo_cut",
    titre: "L'Olmo revient encaisser",
    texte: "Une fois la somme blanchie, l'Olmo repasse. « Je te laisse 20 % de ce que je t'ai confié. Ça te va ? »",
    condition: () => false, // jamais tiré au hasard : uniquement enchaîné depuis olmo_arrangement
    genererChoix: (s) => {
      const budgetRef = s.historique[s.historique.length - 1]?.budgetApres ?? s.budget;
      const recu = Math.round(budgetRef * 0.5);
      const garde20 = Math.round(recu * 0.2);
      return [
        {
          // Ta commission = ce que TU touches (positif). L'argent blanchi repart chez
          // l'Olmo, il n'a jamais transité par ton budget.
          label: `Confirmer (toucher ${garde20.toLocaleString("fr-FR")} €)`,
          effet: {
            budget: garde20,
            note: `🤝 Opération bouclée : tu touches ta commission de ${garde20.toLocaleString("fr-FR")} €, propre.`,
          },
        },
        {
          // Vouloir tout garder = essayer de doubler l'Olmo. Il reprend TOUT son
          // argent (tu ne touches rien) et casse du matériel pour l'affront.
          label: "Essayer de tout garder",
          effet: {
            poseDrapeau: { cle: "sem_olmo_casse", valeur: true },
            note: "😠 Tu crois pouvoir doubler l'Olmo ? Il repart avec la totalité de son argent — et laisse un avertissement : il y aura de la casse.",
          },
        },
        {
          label: "Négocier un autre pourcentage",
          effet: { ouvrirNegociationOlmo: true },
        },
      ];
    },
    choix: [],
  },
  {
    id: "olmo_police",
    titre: "Tout s'écroule",
    texte:
      "Un contrôle tombe sur des mouvements suspects dans les comptes. La police remonte vite jusqu'à toi : ton arrangement avec l'Olmo est grillé.",
    priorite: true,
    condition: (s) => s.drapeaux["sem_blanchiment_police"] === true,
    choix: [
      {
        label: "Encaisser",
        effet: {
          declencherAmendePolice: { pourcentage: 0.35, fermeture: true },
          notoriete: -15,
          poseDrapeau: { cle: "blanchiment_actif", valeur: false },
          note: "🚨 Ton arrangement avec l'Olmo est grillé : amende salée, fermeture administrative, et ta réputation en prend un sacré coup.",
        },
      },
    ],
  },
  {
    id: "critique",
    titre: "Le critique incognito",
    texte:
      "Aujourd'hui, un homme seul prend des notes derrière son demi. Ce carnet en cuir… c'est le critique du journal local, aucun doute.",
    unique: true,
    choix: [
      {
        label: "Le bichonner discrètement",
        effet: {
          stock: { repas: -5, vin: -5 },
          tirage: {
            proba: 0.7,
            aide: "commercial",
            succes: { notoriete: 7, note: "📰 Article élogieux : « une pépite de quartier » !" },
            echec: { notoriete: -2, note: "📰 Il a trouvé le service « trop insistant ». Raté." },
          },
        },
      },
      {
        label: "Le servir comme tout le monde",
        effet: {
          tirage: {
            proba: 0.45,
            aide: "commercial",
            succes: { notoriete: 5, note: "📰 Il a salué « l'authenticité sans chichi ». Belle pub !" },
            echec: { notoriete: -3, note: "📰 Article tiède : « un bar comme un autre ». Dommage." },
          },
        },
      },
    ],
  },
  {
    id: "fuite_eau",
    titre: "Fuite dans la cave !",
    texte:
      "Aujourd'hui, une canalisation lâche dans la cave. L'eau monte doucement vers les stocks…",
    condition: (s) => !equipeA(s, "ingenieur"),
    genererChoix: (s) => {
      const coutPlombier = coutAdaptatif(s, 0.08, 400, 3000);
      return [
        {
          label: `Appeler un plombier (${coutPlombier} €)`,
          effet: { budget: -coutPlombier, note: "🔧 Fuite colmatée proprement. La cave est sauvée." },
        },
        {
          label: "Bricoler ça toi-même",
          effet: {
            tirage: {
              proba: 0.5,
              succes: { note: "🔧 Du chatterton et de la volonté : ça tient ! Zéro euro dépensé." },
              echec: { budget: -300, stock: { bieres: -12, repas: -8 }, note: "💦 Ta rustine a lâché dans la nuit : stocks noyés (-300 € de dégâts)." },
            },
          },
        },
      ];
    },
    choix: [], // remplacés au tirage par genererChoix
  },
  {
    id: "fuite_eau_ing",
    titre: "Fuite dans la cave !",
    texte:
      "Aujourd'hui, une canalisation lâche dans la cave… mais ton ingénieur est déjà dessus, clé à molette en main, avant même que tu finisses ta phrase.",
    condition: (s) => equipeA(s, "ingenieur"),
    choix: [
      {
        label: "Le laisser opérer",
        effet: { notoriete: 1, note: "🔧 Fuite réparée en vingt minutes, gratuitement. Ce salarié vaut de l'or." },
      },
    ],
  },
  {
    id: "vieux_manoir",
    titre: "Le Vieux Manoir",
    texte:
      "Aujourd'hui, toute l'équipe te lance un regard suppliant : « Patron, on veut tous aller au Vieux Manoir ce soir ! Steuplé ?! »",
    unique: true,
    condition: (s) =>
      s.semaineEquipe3 !== undefined &&
      s.semaine >= s.semaineEquipe3 + 2 &&
      s.semaine <= s.semaineEquipe3 + 5 &&
      s.employes.filter((e) => !e.demissionne).length >= 3,
    choix: [
      {
        label: "Les laisser y aller",
        effet: {
          caSoirPourcent: 0.5,
          capaciteLendemain: 0.8,
          note: "🎉 Soirée mémorable au Vieux Manoir : le bar carbure ce soir (+50 % de CA), mais gare à la gueule de bois — l'équipe traînera un peu demain.",
        },
      },
      {
        label: "Refuser, ce soir on bosse",
        effet: { moralEquipe: -10, note: "😒 L'équipe fait la tête toute la soirée. Le moral en prend un coup." },
      },
    ],
  },

  // ---- V-NOME, le chien du quartier ----
  // État tout entier dans state.drapeaux (pas de champs dédiés) :
  //  - chien_cout_hebdo (number) : 0/absent = pas (ou plus) adopté, >0 = coût hebdo actuel de la mascotte.
  //  - chien_chasses (number) : 0 = jamais chassé, 1 = chassé une fois (revient une dernière fois), 2 = chassé deux fois (parti pour de bon).
  {
    id: "chien_star",
    titre: "Le chien du quartier",
    texte:
      "Aujourd'hui, un chien mal éduqué dort devant le bar — « V-NOME » gravé sur sa vieille médaille — « WOOF ! WOOF !! » Les gens s'arrêtent pour le caresser.",
    condition: (s) =>
      s.semaine < 10 &&
      !(Number(s.drapeaux.chien_cout_hebdo) > 0) &&
      (Number(s.drapeaux.chien_chasses) || 0) === 0,
    choix: [
      {
        label: "L'adopter comme mascotte (gamelle et panier : 100 €)",
        effet: {
          budget: -100,
          notoriete: 4,
          moralEquipe: 4,
          poseDrapeau: { cle: "chien_cout_hebdo", valeur: 200 },
          note: "🐕 « Le bar de V-NOME » — les clients viennent exprès pour lui. Mascotte adoptée : 200 €/semaine.",
        },
      },
      {
        label: "Le chasser gentiment",
        effet: {
          poseDrapeau: { cle: "chien_chasses", valeur: 1 },
          note: "🐕 Il est parti s'installer devant la boulangerie. Elle ne le regrettera pas.",
        },
      },
    ],
  },
  {
    id: "chien_retour",
    titre: "V-NOME est de retour",
    texte:
      "Aujourd'hui, le même chien revient se coucher devant la porte du bar, la truffe basse — une dernière fois, comme s'il espérait une seconde chance.",
    priorite: true, // revient à coup sûr la semaine suivante, comme les vacances
    cooldown: 1,
    condition: (s) =>
      !(Number(s.drapeaux.chien_cout_hebdo) > 0) && (Number(s.drapeaux.chien_chasses) || 0) === 1,
    choix: [
      {
        label: "L'adopter comme mascotte (gamelle et panier : 100 €)",
        effet: {
          budget: -100,
          notoriete: 4,
          moralEquipe: 4,
          poseDrapeau: { cle: "chien_cout_hebdo", valeur: 200 },
          note: "🐕 « Le bar de V-NOME » — les clients viennent exprès pour lui. Mascotte adoptée : 200 €/semaine.",
        },
      },
      {
        label: "Le chasser à nouveau",
        effet: {
          poseDrapeau: { cle: "chien_chasses", valeur: 2 },
          note: "🐕 Cette fois, il ne reviendra plus. V-NOME s'éloigne pour de bon.",
        },
      },
    ],
  },
  {
    id: "chien_augmentation",
    titre: "L'augmentation de V-NOME",
    texte:
      "WOOF ! Après tout ce que ma présence t'a rapporté je veux une augmentation ! Tu vas me passer à 10 000 euros par semaine !",
    unique: true,
    condition: (s) => Number(s.drapeaux.chien_cout_hebdo) > 0 && s.semaine >= 20 && s.semaine <= 30,
    choix: [
      {
        label: "Accepter (10 000 €/semaine)",
        effet: {
          poseDrapeau: { cle: "chien_cout_hebdo", valeur: 10000 },
          note: "🐕 V-NOME touche désormais 10 000 €/semaine. Bonne chance pour la suite.",
        },
      },
      {
        label: "Refuser",
        effet: { note: "🐕 « Ah ouais ? On va voir ça… »" },
        enchaine: { id: "chien_augmentation_suite", proba: 1 },
      },
    ],
  },
  {
    id: "chien_augmentation_suite",
    titre: "V-NOME s'énerve",
    texte:
      "WOOF WOOF ! *V-NOME devient fou, ouvre la gueule et vous chope par le pantalon… il se déchire* « WOOF ! On est d'accord, va pour 500 € par semaine alors ?! »",
    condition: () => false, // jamais tiré au hasard : uniquement enchaîné depuis chien_augmentation
    choix: [
      {
        label: "Accepter (500 €/semaine)",
        effet: {
          poseDrapeau: { cle: "chien_cout_hebdo", valeur: 500 },
          note: "🐕 V-NOME se calme et repart avec son nouveau salaire : 500 €/semaine.",
        },
      },
      {
        label: "Refuser",
        effet: {
          poseDrapeau: { cle: "chien_cout_hebdo", valeur: 0 },
          note: "🐕 « Bon bah j'me casse moi ! WOOF WOOF ! » V-NOME tourne les talons et disparaît pour de bon.",
        },
      },
    ],
  },

  // ---- Le quotidien du comptoir ----
  {
    id: "vomi",
    titre: "Accident au fond de la salle",
    texte:
      "Aujourd'hui, un client a repeint le carrelage des toilettes après un verre de trop. Tout le monde regarde ailleurs : qui va y aller ?",
    // Un bouton par salarié actif : celui qui nettoie finit la semaine plus fatigué.
    genererChoix: (s) => {
      const boutons: Choice[] = s.employes
        .filter((e) => !e.demissionne)
        .map((e) => ({
          label: `Envoyer ${e.nom} ${e.emoji}`,
          cibleId: e.id,
          effet: {
            fatigueCible: 15,
            note: `🤢 ${e.nom} a nettoyé les toilettes en apnée. Héroïque, mais épuisant.`,
          },
        }));
      boutons.push({
        label: "Condamner les toilettes ce soir",
        effet: {
          proprete: -10,
          notoriete: -2,
          note: "🤢 Toilettes fermées « pour travaux ». L'odeur s'est installée, les clients ont écourté.",
        },
      });
      return boutons;
    },
    choix: [], // remplacés au tirage par genererChoix
  },
  {
    id: "sdf_monnaie",
    titre: "De la monnaie ?",
    texte:
      "Aujourd'hui, Fredo, longue barbe blanche et quelques cheveux encore présents autour du crâne, pousse la porte et entre dans le bar avec son odeur et ses deux chiens : « Salut mon ami, tu peux me faire de la monnaie ? »",
    choix: [
      {
        label: "Faire la monnaie",
        effet: {
          tirage: {
            proba: 0.5,
            risque: true, // la zone = la fatigue qui traîne
            succes: {
              fatiguePresentsJour: 4,
              note: "🪙 L'odeur et les chiens ont traîné un peu trop longtemps au comptoir : l'équipe présente ce soir en ressort fatiguée.",
            },
            echec: {
              note: "🪙 Il repart avec sa monnaie, ni vu ni connu.",
            },
          },
        },
      },
      {
        label: "Refuser",
        effet: {
          notoriete: -2,
          note: "🪙 Il sort en criant « TA GUEULE ! » aux clients présents. Le quartier en jase.",
        },
      },
    ],
  },
  {
    id: "habitue_prix",
    titre: "Le prix d'ami",
    texte:
      "Aujourd'hui, Mr RV — fidèle au poste depuis l'ouverture, toujours le même tabouret — se lance enfin : « Patron, ça fait des semaines que je viens… tu m'fais un prix d'ami ? »",
    condition: (s) => s.semaine >= 5, // il faut être « depuis le début » pour oser demander
    unique: true,
    choix: [
      {
        label: "Accorder le prix d'ami",
        effet: {
          poseDrapeau: { cle: "prix_ami", valeur: true },
          notoriete: 4,
          note: "🍻 Mr RV rayonne et le raconte à tout le quartier. (Ton panier moyen baisse un peu, pour toujours.)",
        },
      },
      {
        label: "Refuser gentiment",
        effet: {
          notoriete: -3,
          note: "🍻 Mr RV encaisse le refus. Il vient un peu moins souvent, et ça jase au comptoir.",
        },
      },
    ],
  },

  // ---- La presse & le quartier ----
  {
    id: "client_mystere_ok",
    titre: "Le client mystère",
    texte:
      "Aujourd'hui, tu reconnais le chroniqueur des Grenobleus, attablé discrètement depuis une heure, carnet à la main. Son article sort demain… et ton bar est impeccable.",
    condition: (s) => s.proprete >= 60,
    choix: [
      {
        label: "Lire l'article au matin",
        effet: { notoriete: 5, note: "📰 « Une adresse tenue avec soin » — le journal recommande ton bar !" },
      },
    ],
  },
  {
    id: "client_mystere_ko",
    titre: "Le client mystère",
    texte:
      "Aujourd'hui, tu reconnais le chroniqueur du journal local, attablé discrètement, carnet à la main. Son regard traîne sur les tables collantes… Son article sort demain.",
    condition: (s) => s.proprete < 60,
    choix: [
      {
        label: "Encaisser l'article",
        effet: { notoriete: -4, note: "📰 « On y va pour l'ambiance, pas pour l'hygiène » — aïe." },
      },
      {
        label: "Payer un encart publicitaire pour limiter la casse (250 €)",
        effet: { budget: -250, notoriete: -1, note: "📰 L'article pique, mais ta pub en dernière page rattrape un peu le coup." },
      },
    ],
  },
  {
    id: "soiree_etudiante",
    titre: "L'invasion étudiante",
    texte:
      "Aujourd'hui, le BDE Médecine débarque après les partiels : trente carabins assoiffés qui chantent déjà sur le trottoir.",
    choix: [
      {
        label: "Ouvrir grand les portes",
        effet: {
          budget: 400,
          notoriete: 2,
          fatigueEquipe: 8,
          stock: { bieres: -8, cocktails: -5, softs: -3 },
          grosseSoiree: true,
          causeSoiree: "votre soirée étudiante avec le BDE Médecine",
          note: "🎓 Soirée marathon : caisse pleine (+400 €), équipe rincée, stocks au tapis.",
        },
        // Une chance sur deux que la soirée dérape : le vomi s'invite le même soir.
        enchaine: {
          id: "vomi",
          proba: 0.5,
          texte:
            "Le BDE Médecine a trop bu : un carabin a repeint le carrelage des toilettes. Tout le monde regarde ailleurs : qui va y aller ?",
        },
      },
      {
        label: "Limiter l'entrée « aux habitués »",
        effet: { notoriete: -2, note: "🎓 Les étudiants sont partis ailleurs. Les jeunes du quartier s'en souviendront." },
      },
    ],
  },
  {
    id: "match_foot",
    titre: "Soir de match",
    texte:
      "Aujourd'hui, c'est LE match de la saison et ton bar n'a pas l'abonnement sport. Les clients scrutent l'écran éteint avec espoir.",
    genererChoix: (s) => {
      const coutAbonnement = coutAdaptatif(s, 0.03, 150, 1500);
      return [
        {
          label: `Payer l'abonnement au bar d'à côté du satellite (${coutAbonnement} €)`,
          effet: {
            budget: -coutAbonnement,
            notoriete: 3,
            fatigueEquipe: 4,
            grosseSoiree: true,
            causeSoiree: "votre diffusion du match de foot",
            note: "⚽ Bar plein à craquer jusqu'au coup de sifflet final. Le quartier a vibré chez toi.",
          },
        },
        {
          label: "« Ici on discute, on ne regarde pas la télé »",
          effet: { notoriete: -1, note: "⚽ La moitié de la salle a migré chez le concurrent au coup d'envoi." },
        },
      ];
    },
    choix: [], // remplacés au tirage par genererChoix
  },
  {
    id: "police_avertissement",
    titre: "La police à la porte",
    texte:
      "Le lendemain de {cause}, deux agents passent au bar : plusieurs voisins se sont plaints du bruit jusqu'à point d'heure. « On vous met juste en garde, cette fois. »",
    priorite: true,
    cooldown: 1,
    condition: (s) => s.policeEnAttente === "avertissement" && s.semaine > (s.policeEnAttenteSemaine ?? 0),
    choix: [
      {
        label: "Prendre note",
        effet: {
          resoudPoliceAvertissement: true,
          note: "🚨 Premier avertissement : la prochaine grosse soirée, ce sera plus sérieux.",
        },
      },
    ],
  },
  {
    id: "police_proces",
    titre: "Convocation au tribunal",
    texte:
      "Cette fois, c'est plus grave : nouvelle plainte pour tapage après {cause}, et la mairie parle de fermeture administrative. Une audience est fixée.",
    priorite: true,
    cooldown: 1,
    condition: (s) => s.policeEnAttente === "proces" && s.semaine > (s.policeEnAttenteSemaine ?? 0),
    choix: [
      {
        label: "Se présenter à l'audience",
        effet: {
          tirage: {
            proba: 0.5,
            succes: {
              declencherAmendePolice: { pourcentage: 0.3, fermeture: false },
              note: "⚖️ Le bar reste ouvert. Amende salée : 30 % du CA de la semaine.",
            },
            echec: {
              declencherAmendePolice: { pourcentage: 0.3, fermeture: true },
              note: "⚖️ Amende (30 % du CA) ET fermeture administrative : porte close toute la semaine prochaine.",
            },
          },
        },
      },
    ],
  },

  // ---- Fournisseurs & voisinage ----
  {
    id: "brasseur_lot",
    titre: "L'affaire du fournisseur",
    texte:
      "Aujourd'hui, ton fournisseur t'appelle : une commande annulée lui reste sur les bras. « Je te fais le lot à moitié prix, mais c'est maintenant. »",
    condition: (s) => s.budget >= 300,
    choix: [
      {
        label: "Acheter le lot (300 €)",
        effet: { budget: -300, stock: { bieres: 75 }, note: "🍺 La cave est pleine pour un bon moment. Belle affaire." },
      },
      {
        label: "Décliner",
        effet: { note: "🍺 Il l'a vendu au bar d'en face. Tant pis." },
      },
    ],
  },
  {
    id: "voisin_grincheux",
    titre: "Le voisin du dessus",
    texte:
      "Aujourd'hui, le voisin du dessus descend en furie : « Chaque soir ce boucan ! J'appelle la mairie si ça continue ! »",
    condition: (s) => !s.drapeaux["isolation_bar"],
    // Tant que rien n'est fait, il redescend (presque) chaque mois : l'isolation
    // est un GROS chèque qui achète la paix définitive, l'ignorer une roulette
    // récurrente — le dilemme doit rester ouvert selon le budget du moment.
    cooldown: 4,
    choix: [
      {
        label: "Faire isoler le plafond (2 500 €)",
        effet: {
          budget: -2500,
          poseDrapeau: { cle: "isolation_bar", valeur: true },
          note: "🔇 Plafond isolé : le voisin ne reviendra plus jamais se plaindre. La paix, ça se paie.",
        },
      },
      {
        label: "L'ignorer poliment",
        effet: {
          tirage: {
            proba: 0.5,
            risque: true, // la zone = l'amende de la mairie
            aide: "mafieux", // des contacts à la mairie pour étouffer l'amende
            succes: {
              budget: -1500,
              notoriete: -3,
              note: "🔇 Amende de la mairie pour nuisances sonores (-1 500 €) — et l'entrefilet dans le journal local fait mauvais genre.",
            },
            echec: { note: "🔇 Pas de suite… pour l'instant. Mais il te fusille du regard chaque matin — il reviendra." },
          },
        },
      },
    ],
  },

  // ---- La vie de l'équipe ----
  {
    id: "serveur_viral",
    titre: "La vidéo qui tourne",
    texte:
      "Aujourd'hui, une vidéo de {nom} en plein service explose sur les réseaux — des dizaines de milliers de vues. Des curieux poussent la porte « pour voir la star », qui en profite : « Patron, une petite augmentation pour la célébrité du quartier ? »",
    choisirCible: (s) => salarieAuHasard(s)?.id,
    genererChoix: (s, cibleId) => {
      const e = s.employes.find((x) => x.id === cibleId);
      const hausse = e ? Math.max(30, Math.round((e.salaire * 0.05) / 10) * 10) : 30;
      return [
        {
          label: `Accorder +${hausse} €/semaine à la star`,
          cibleId,
          effet: {
            notoriete: 6,
            augmentationCible: hausse,
            moralCible: 8,
            note: `🎬 {nom} rayonne derrière le comptoir (+${hausse} €/sem). Les curieux continuent d'affluer.`,
          },
        },
        {
          label: "« La gloire, ça ne se paie pas »",
          cibleId,
          effet: {
            notoriete: 6,
            moralCible: -10,
            note: "🎬 Les curieux affluent, mais {nom} sert avec un sourire un peu forcé.",
          },
        },
      ];
    },
    choix: [], // remplacés au tirage
  },
  {
    id: "demande_vacances",
    titre: "Besoin de souffler",
    texte:
      "Aujourd'hui, {nom} s'accoude au comptoir, les traits tirés : « Patron, je suis au bout du rouleau. Il me faudrait une vraie semaine pour souffler. »",
    priorite: true, // passe devant les autres événements : la fatigue n'attend pas
    cooldown: 3, // pas plus d'une demande de vacances toutes les 3 sem. (anti-flood)
    condition: (s) => salarieEpuise(s) !== undefined,
    choisirCible: (s) => salarieEpuise(s)?.id,
    choix: [
      {
        label: "Accorder une semaine de vacances",
        effet: {
          vacancesCible: true,
          moralCible: 8,
          note: "🏖 {nom} pose ses sept jours la semaine prochaine. Il reviendra à neuf.",
        },
      },
      {
        label: "« Tiens encore un peu, on a besoin de toi »",
        effet: {
          moralCible: -15,
          ajusterVacancesRefus: 1,
          note: "🏖 {nom} serre les dents. Sa fatigue s'accumule… et sa rancune aussi.",
        },
      },
    ],
  },
  {
    id: "vacances_menace",
    titre: "Menace de procès",
    texte:
      "Aujourd'hui, {nom} revient à la charge, plus froid que la dernière fois : « Patron, la loi m'accorde des congés. Si ça continue comme ça, j'appelle un avocat. »",
    priorite: true,
    cooldown: 1,
    condition: (s) => salarieVacancesMenace(s) !== undefined,
    choisirCible: (s) => salarieVacancesMenace(s)?.id,
    choix: [
      {
        label: "Accorder les vacances, cette fois",
        effet: {
          vacancesCible: true,
          moralCible: 10,
          note: "🏖 {nom} part se reposer, menace désamorcée de justesse.",
        },
      },
      {
        label: "Refuser encore",
        effet: {
          moralCible: -15,
          ajusterVacancesRefus: 1,
          note: "⚖️ {nom} : « Très bien. On se reverra devant le juge. »",
        },
      },
    ],
  },
  {
    id: "proces_vacances",
    titre: "Le procès",
    texte:
      "Aujourd'hui, {nom} met sa menace à exécution : convocation aux prud'hommes pour refus de congés. Il faut y aller.",
    priorite: true,
    cooldown: 1,
    condition: (s) => salarieVacancesProces(s) !== undefined,
    choisirCible: (s) => salarieVacancesProces(s)?.id,
    choix: [
      {
        label: "Aller au tribunal",
        effet: {
          tirage: {
            proba: 0.5,
            succes: {
              moralEquipePourcent: -0.2,
              demissionCible: true,
              note: "⚖️ Tu gagnes : pas un centime perdu. Mais {nom} claque la porte, écœuré — et le reste de l'équipe encaisse le choc (moral -20 %).",
            },
            echec: {
              budgetPourcentage: -0.5,
              demissionCible: true,
              note: "⚖️ Tu perds : {nom} part... avec la moitié de la caisse en dédommagement.",
            },
          },
        },
      },
    ],
  },
  {
    id: "demande_augmentation",
    titre: "Un mot en privé",
    texte:
      "Aujourd'hui, {nom} te prend à part après le service : « Ça fait un moment que je suis là, patron. J'aimerais qu'on parle de mon salaire. »",
    condition: (s) => salarieEligibleAugmentation(s) !== undefined,
    choisirCible: (s) => salarieEligibleAugmentation(s)?.id,
    genererChoix: (s, cibleId) => {
      const e = s.employes.find((x) => x.id === cibleId);
      const hausse = e ? Math.max(30, Math.round((e.salaire * 0.1) / 10) * 10) : 30;
      return [
        {
          label: `Accorder +${hausse} €/semaine`,
          cibleId,
          effet: {
            augmentationCible: hausse,
            moralCible: 10,
            note: `💶 {nom} repart regonflé (+${hausse} €/sem sur la fiche de paie).`,
          },
        },
        {
          label: "Refuser pour l'instant",
          cibleId,
          effet: {
            moralCible: -12,
            note: "💶 {nom} hoche la tête, déçu. Son entrain n'est plus tout à fait le même.",
          },
        },
      ];
    },
    choix: [], // remplacés au tirage
  },
  {
    id: "brisco_tacos",
    titre: "Brisco a la dalle !",
    texte:
      "Brisco, un habitué qui bosse dans l'immobilier, débarque affamé — mais il a complètement zappé la commande de son tacos, celui que tu lui avais préparé il y a un bail. « Steuplé, refais-le-moi comme la dernière fois, j'ai trop la dalle ! »",
    unique: true,
    condition: (s) => s.semaine >= 4,
    choix: [
      {
        label: "Essayer de retrouver sa commande",
        effet: { ouvrirConfigTacos: true },
      },
      {
        label: "Lui avouer qu'on ne s'en souvient plus",
        effet: { note: "🌯 Brisco hausse les épaules, un peu déçu, et commande autre chose." },
      },
    ],
  },
];
