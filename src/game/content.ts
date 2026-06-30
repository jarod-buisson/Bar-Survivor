// ============================================================
//  CONTENU DU JEU — salariés de départ + événements
//  C'est ici qu'on ajoutera du contenu au fur et à mesure.
//  Tout est "data-driven" : pour créer un événement, il suffit
//  d'ajouter un objet dans la liste EVENEMENTS, sans toucher au moteur.
// ============================================================

import type { Employee, GameEvent } from "./types";

/** Crée l'équipe de départ. Maurice est toujours là (contrat irrévocable). */
export function equipeDeDepart(): Employee[] {
  return [
    {
      id: "maurice",
      nom: "Maurice",
      role: "Barman senior",
      emoji: "🧔",
      salaire: 900,
      moral: 60,
      competence: 80,
      tolerance: 50,
      loyaute: 70,
      irrevocable: true,
    },
    {
      id: "camille",
      nom: "Camille",
      role: "Serveuse",
      emoji: "👩",
      salaire: 650,
      moral: 70,
      competence: 65,
      tolerance: 55,
      loyaute: 60,
    },
    {
      id: "benji",
      nom: "Benji",
      role: "Videur",
      emoji: "💂",
      salaire: 850,
      moral: 55,
      competence: 70,
      tolerance: 60,
      loyaute: 65,
    },
  ];
}

/**
 * Banque d'événements. Le moteur en tire un au hasard parmi ceux
 * dont la `condition` est remplie (ou sans condition).
 */
export const EVENEMENTS: GameEvent[] = [
  {
    id: "maurice_picole",
    cibleId: "maurice",
    titre: "Maurice a picolé",
    texte: "Ce matin, Maurice sent l'alcool à plein nez. Le service du soir approche.",
    choix: [
      {
        label: "Le laisser travailler",
        effet: { moralEquipe: -10 },
        note: "Risque d'incident, mais le service est assuré.",
      },
      {
        label: "Le renvoyer chez lui",
        effet: { moralCible: -20, budget: -600 },
        note: "Service du soir affaibli : CA en baisse.",
      },
    ],
  },
  {
    id: "augmentation_camille",
    cibleId: "camille",
    titre: "Augmentation ou démission",
    texte: "Camille : « Soit tu m'augmentes de 100 €, soit je rends mon tablier. »",
    choix: [
      {
        label: "Accepter (+100 €/sem)",
        effet: { salaireCible: 100, moralCible: 20 },
        note: "Camille est ravie. Charge salariale en hausse.",
      },
      {
        label: "Refuser",
        effet: { moralCible: -25 },
        note: "Elle l'a très mal pris...",
      },
    ],
  },
  {
    id: "bagarre",
    titre: "Bagarre au bar",
    texte: "Deux clients se chauffent au fond de la salle. La tension monte.",
    condition: (s) => s.difficulte !== "facile",
    choix: [
      {
        label: "Envoyer Benji",
        effet: { moralCible: 0 },
        note: "Incident maîtrisé proprement.",
        // Note : si Benji a démissionné, le moteur appliquera la pénalité ci-dessous.
      },
      {
        label: "Ignorer",
        effet: { budget: -800, notoriete: -10 },
        note: "La bagarre éclate : dégâts et mauvaise presse.",
      },
    ],
  },
  {
    id: "verres_offerts",
    cibleId: "maurice",
    titre: "Les verres de trop",
    texte: "Maurice a encore offert des tournées à ses habitués. 180 € envolés ce soir.",
    choix: [
      {
        label: "Laisser faire",
        effet: { moralCible: 5, budget: -180 },
        note: "Les habitués adorent Maurice.",
      },
      {
        label: "Interdire",
        effet: { moralCible: -20 },
        note: "Maurice fait la tête. Risque de vol.",
      },
    ],
  },
  {
    id: "jalousie_benji",
    cibleId: "benji",
    titre: "Jalousie salariale",
    texte: "Benji a découvert qu'un collègue gagne plus que lui. Il exige une revalorisation.",
    choix: [
      {
        label: "Aligner le salaire (+100 €/sem)",
        effet: { salaireCible: 100, moralCible: 15 },
        note: "Benji est apaisé.",
      },
      {
        label: "Refuser",
        effet: { moralCible: -25 },
        note: "Rancune : risque de vol ou de départ.",
      },
    ],
  },
  {
    id: "panne_lave_verre",
    titre: "Panne machine",
    texte: "Le lave-verre vient de rendre l'âme en plein service du soir.",
    choix: [
      {
        label: "Appeler un technicien (-400 €)",
        effet: { budget: -400 },
        note: "Réparé dès demain, service normal.",
      },
      {
        label: "Ne rien faire",
        effet: { notoriete: -5 },
        differe: { budget: -200 },
        note: "Efficacité réduite jusqu'au remplacement.",
      },
    ],
  },
  {
    id: "article_presse",
    titre: "Article de presse",
    texte: "Un journaliste local a adoré votre bar et publie un article élogieux !",
    choix: [
      {
        label: "Savourer le moment",
        effet: { notoriete: 10, budget: 800, moralEquipe: 5 },
        note: "Excellente publicité : notoriété et CA en hausse.",
      },
    ],
  },
  {
    id: "pot_equipe",
    titre: "Pot d'équipe ?",
    texte: "L'équipe est fatiguée. Organiser un pot pourrait remonter le moral général (300 €).",
    choix: [
      {
        label: "Organiser le pot (-300 €)",
        effet: { budget: -300, moralEquipe: 15 },
        note: "Ambiance au beau fixe !",
      },
      {
        label: "Pas maintenant",
        effet: {},
        note: "On serre les dents.",
      },
    ],
  },
  {
    id: "rachat_investisseur",
    titre: "Proposition de rachat",
    texte:
      "Un investisseur en costume veut racheter votre bar. Une sortie en or... mais la partie s'arrête.",
    unique: true,
    condition: (s) => s.semaine >= 8 && s.notoriete >= 50,
    choix: [
      {
        label: "Accepter le rachat",
        effet: {},
        note: "Tu t'en es sorti !",
        // Le moteur détecte cet id pour déclencher la VICTOIRE.
      },
      {
        label: "Refuser, le bar c'est ma vie",
        effet: { notoriete: 5 },
        note: "L'aventure continue.",
      },
    ],
  },
];
