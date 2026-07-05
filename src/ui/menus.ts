// ============================================================
//  SOUS-MENUS DU HUB — Salariés · Stock(Armand)+améliorations
//  · Réparations · Banque · Historique · Calendrier.
// ============================================================

import type { CV, Employee, GameState, Machine } from "../game/types";
import {
  MENAGE,
  aIngenieur,
  ameliorationsDebloquees,
  capaciteBar,
  capaciteLocale,
  coutAutoStock,
  coutLicenciement,
  coutMenagePro,
  coutTravaux,
  tauxDette,
} from "../game/engine";
import { CATEGORIES_STOCK } from "../game/content";
import { NIVEAU_MAX, bonusRendementPct, coutAmelioration, coutReparation } from "../game/machines";
import { badgeTrait, badgesTraits, eur } from "./components";
import { bilanDetail } from "./recap";

function entete(titre: string): string {
  return `
    <div class="menu-entete">
      <button class="retour-btn" data-action="fermerMenu">←</button>
      <h2>${titre}</h2>
    </div>`;
}

function statBar(label: string, val: number): string {
  return `
    <div class="stat-ligne">
      <span class="stat-lbl">${label}</span>
      <span class="stat-barre"><span class="stat-fill" style="width:${val}%"></span></span>
      <span class="stat-val">${val}</span>
    </div>`;
}

function classeHp(m: Machine): string {
  if (m.etat === "panne") return "cassee";
  if (m.hp < 25) return "cassee";
  if (m.hp < 50) return "degradee";
  return "ok";
}

// ---- Salariés ----

const JOURS_COURTS = ["L", "M", "M", "J", "V", "S", "D"];

/** Rangée de 7 boutons Lun→Dim : touche un jour pour basculer travail/repos. */
function planningJours(e: Employee): string {
  const chips = JOURS_COURTS.map(
    (j, i) => `
      <button class="jour-chip ${e.reposJours[i] ? "repos" : ""}"
        data-action="toggleRepos" data-value="${e.id}:${i}">
        ${e.reposJours[i] ? "💤" : j}
      </button>`,
  ).join("");
  return `
    <div class="sc-planning">
      <span class="stat-lbl">🗓 Planning</span>
      <div class="jour-chips">${chips}</div>
    </div>`;
}

function menuSalaries(s: GameState): string {
  const cartes = s.employes
    .filter((e: Employee) => !e.demissionne)
    .map((e: Employee) => {
      const licencier = e.irrevocable
        ? ""
        : `<button class="mini no" data-action="licencier" data-value="${e.id}"
              ${s.budget < coutLicenciement(e) ? "disabled" : ""}>
              Licencier (${eur(coutLicenciement(e))})
            </button>`;
      return `
      <div class="salarie-carte">
        <div class="sc-portrait">${e.emoji}</div>
        <div class="sc-main">
          <div class="sc-nom">${e.nom} ${e.irrevocable ? '<span class="badge-irr">irrévocable</span>' : ""}</div>
          <div class="sc-role">${eur(e.salaire)}/sem</div>
          ${badgesTraits(e)}
          <div class="sc-stats">
            ${statBar("❤ Moral", e.moral)}
            ${statBar("😮‍💨 Fatigue", e.fatigue)}
            ${statBar("💪 Compétence", e.competence)}
          </div>
          ${planningJours(e)}
          ${
            e.vacances === "posees"
              ? '<div class="hint-small">🏖 Part en vacances la semaine prochaine</div>'
              : e.vacances === "encours"
                ? '<div class="hint-small">🏖 En vacances cette semaine</div>'
                : ""
          }
          ${
            e.joursSansRepos >= 5
              ? `<div class="hint-small neg">⏰ ${e.joursSansRepos} jours enchaînés sans 2 jours de repos d'affilée — heures sup de plus en plus chères !</div>`
              : ""
          }
          ${licencier}
        </div>
      </div>`;
    })
    .join("");
  const coutMascotte = Number(s.drapeaux.chien_cout_hebdo);
  const mascotte =
    coutMascotte > 0
      ? `
      <div class="salarie-carte">
        <div class="sc-portrait">🐕</div>
        <div class="sc-main">
          <div class="sc-nom">MASCOTTE DU BAR</div>
          <div class="sc-role">Coût : ${eur(coutMascotte)}/semaine</div>
        </div>
      </div>`
      : "";
  return `
    ${entete("👥 Salariés")}
    <div class="menu-corps">
      <p class="hint-small">💤 Touche un jour pour mettre un salarié en repos. Personne au travail = bar fermé ce jour-là.</p>
      <p class="hint-small">💪 Plus l'équipe du soir est compétente, plus le ticket moyen grimpe : les bons vendeurs font plus de CA avec les mêmes clients.</p>
      ${cartes}${mascotte}
    </div>`;
}

// ---- CV reçus ----

function cvCarte(cv: CV): string {
  const e = cv.profil;
  // Les faiblesses de certains CV sont masquées (aléa) : on embauche à l'aveugle.
  const forces = `<div class="cv-traits">💪 ${e.forces.map(badgeTrait).join("")}</div>`;
  const faiblesses = cv.faiblessesMasquees
    ? `<div class="cv-masque">🔒 Faiblesses masquées — à toi de prendre le risque</div>`
    : `<div class="cv-traits">⚠ ${e.faiblesses.map(badgeTrait).join("")}</div>`;
  return `
    <div class="salarie-carte">
      <div class="sc-portrait">${e.emoji}</div>
      <div class="sc-main">
        <div class="sc-nom">${e.nom}</div>
        <div class="sc-role">${eur(e.salaire)}/sem</div>
        <div class="sc-stats">
          ${statBar("💪 Compétence", e.competence)}
        </div>
        ${forces}
        ${faiblesses}
        <div class="c-actions">
          <button class="mini ok" data-action="embaucherCV" data-value="${e.id}">Embaucher</button>
          <button class="mini no" data-action="refuserCV" data-value="${e.id}">Refuser</button>
        </div>
      </div>
    </div>`;
}

function menuCV(s: GameState): string {
  const corps =
    s.cvRecus.length === 0
      ? `<p class="hint-small">Aucun CV pour l'instant. Il en arrive de temps en temps.</p>`
      : `<p class="hint-small">💪 Un salarié compétent monte le ticket moyen des soirs où il travaille.</p>` +
        s.cvRecus.map(cvCarte).join("");
  return `${entete("📄 CV reçus")}<div class="menu-corps">${corps}</div>`;
}

// ---- Fournisseur (commande de stock par curseurs) + améliorations ----

function menuFournisseur(s: GameState): string {
  // Un curseur par catégorie : min = stock actuel, max = 100, incrément 1.
  // Le coût total se recalcule côté client (main.ts) au glissement des curseurs.
  const curseurs = CATEGORIES_STOCK.map((c) => {
    const val = Math.round(s.stocks[c.id]);
    const alerte = val <= 0 ? "rupture" : val < 30 ? "stock-bas" : "";
    return `
      <div class="four-ligne ${alerte}">
        <div class="four-tete">
          <span class="four-nom">${c.emoji} ${c.nom}</span>
          <span class="four-val" data-cat-val="${c.id}">${val}%</span>
        </div>
        <div class="four-slider-wrap" style="--fill:${val}%">
          <div class="four-fill"></div>
          <input type="range" class="four-slider" data-cat="${c.id}" data-prix="${c.prix}" data-base="${val}"
                 min="0" max="100" step="1" value="${val}" />
        </div>
      </div>`;
  }).join("");

  let ameliorations: string;
  if (!ameliorationsDebloquees(s)) {
    ameliorations = `<p class="hint-small">🔒 Améliorations débloquées à la semaine 5 (actuellement semaine ${s.semaine}).</p>`;
  } else {
    ameliorations = s.machines
      .map((m: Machine) => {
        if (m.niveau >= NIVEAU_MAX) {
          return `<div class="machine-ligne"><span>${m.emoji} ${m.nom}</span><span class="ok-txt">Niv. MAX</span></div>`;
        }
        const c = coutAmelioration(m);
        const dispo = s.budget >= c;
        return `
          <div class="machine-ligne">
            <span>${m.emoji} ${m.nom} <small>niv.${m.niveau} · rendement +${bonusRendementPct(m)} %</small></span>
            <button class="mini ok" data-action="ameliorer" data-value="${m.id}" ${dispo ? "" : "disabled"}>Améliorer (${eur(c)})</button>
          </div>`;
      })
      .join("");
    const coutAS = coutAutoStock();
    ameliorations += s.autoStockAchete
      ? `<div class="machine-ligne">
          <span>🤖 Auto-stock <small>remonte le stock à fond chaque fin de semaine (payant, à double tranchant)</small></span>
          <button class="mini ${s.autoStockActif ? "ok" : ""}" data-action="toggleAutoStock">${
            s.autoStockActif ? "Activé (désactiver)" : "Désactivé (activer)"
          }</button>
        </div>`
      : `<div class="machine-ligne">
          <span>🤖 Auto-stock <small>remonte le stock à fond chaque fin de semaine (payant, à double tranchant)</small></span>
          <button class="mini ok" data-action="acheterAutoStock" ${s.budget >= coutAS ? "" : "disabled"}>Acheter (${eur(coutAS)})</button>
        </div>`;
  }

  return `
    ${entete("📦 Fournisseur")}
    <div class="menu-corps">
      <p class="hint-small">Tire un curseur pour recommander (budget ${eur(s.budget)}). Tu peux ouvrir sans faire le plein.</p>
      <div class="fournisseur">${curseurs}</div>
      <button class="principal" data-action="commander" id="btn-commander" disabled>
        Commander · <span id="cout-commande">0 €</span>
      </button>
      <div class="bloc-titre">Améliorer le matériel (+ efficacité)</div>
      ${ameliorations}
    </div>`;
}

// ---- Réparations ----

function menuReparations(s: GameState): string {
  const ing = aIngenieur(s);
  const lignes = s.machines
    .map((m: Machine) => {
      let actions: string;
      if (m.etat === "panne") {
        const proDispo = s.budget >= coutReparation(m);
        const ingDispo = ing && !s.reparTentees.includes(m.id);
        const tentee = s.reparTentees.includes(m.id);
        actions = `
          ${ingDispo ? `<button class="mini ok" data-action="reparerIng" data-value="${m.id}">🔧 Ingénieur (50%)</button>` : ""}
          ${tentee ? `<span class="hint-small">tentative ratée</span>` : ""}
          <button class="mini no" data-action="reparerPro" data-value="${m.id}" ${proDispo ? "" : "disabled"}>🛠 Pro (${eur(coutReparation(m))})</button>`;
      } else {
        actions = `<span class="ok-txt">en marche</span>`;
      }
      const etatTxt =
        m.etat === "panne" ? `<span class="neg">en panne</span>` : `<span class="hint-small">${Math.round(m.hp)}%</span>`;
      return `
        <div class="machine-carte">
          <div class="machine-tete"><span>${m.emoji} ${m.nom}</span>${etatTxt}</div>
          <div class="hp-barre"><span class="hp-fill ${classeHp(m)}" style="width:${m.etat === "panne" ? 100 : m.hp}%"></span></div>
          <div class="machine-actions">${actions}</div>
        </div>`;
    })
    .join("");
  return `${entete("🔧 Réparations")}<div class="menu-corps">${lignes}</div>`;
}

// ---- Ménage (propreté du bar) ----

function menuMenage(s: GameState): string {
  const p = Math.round(s.proprete);
  const etat = p >= 80 ? "Impeccable ✨" : p >= 60 ? "Correct" : p >= 40 ? "Sale" : "Crade 🤢";
  const nickel = p >= 100;
  return `
    ${entete("🧹 Ménage")}
    <div class="menu-corps">
      <div class="cal-now">Propreté : <strong>${p}%</strong> — ${etat}</div>
      <div class="jauge-barre" style="margin:8px 0"><span class="jauge-fill" style="width:${p}%"></span></div>
      <div class="hint-small">Chaque client salit un peu le bar. Un bar sale attire moins de monde (jusqu'à -20 % de clients), plombe la réputation sous 40… et attire des invités indésirables.</div>
      <div class="bloc-titre">Faire le ménage</div>
      <button class="principal" data-action="menageEquipe" ${nickel ? "disabled" : ""}>
        🧽 Ménage d'équipe — gratuit (+${MENAGE.equipeProprete} propreté, fatigue +${MENAGE.equipeFatigue} pour tous)
      </button>
      <button class="principal" data-action="menagePro" ${nickel || s.budget < coutMenagePro(s) ? "disabled" : ""}>
        ✨ Société de nettoyage — ${eur(coutMenagePro(s))} (propreté 100, zéro fatigue)
      </button>
      ${
        nickel
          ? `<p class="hint-small">Le bar brille déjà, rien à nettoyer.</p>`
          : `<p class="hint-small">La société facture selon l'état : ${eur(MENAGE.proBase)} de déplacement + ${MENAGE.proParPoint} €/point de propreté à remonter. Plus tu laisses pourrir, plus la facture grimpe.</p>`
      }
    </div>`;
}

// ---- Travaux (agrandissement du local) ----

function menuTravaux(s: GameState): string {
  const noms = ["Troquet de quartier", "Bar spacieux", "Grande brasserie", "Institution du quartier"];

  // Plan vu du dessus : Terrasse + Bar toujours acquis (agencement fixe en grille,
  // pas un simple alignement), puis jusqu'à 3 salles dans le prolongement des murs
  // — acquise / prochaine (cliquable) / verrouillée.
  const salles = [1, 2, 3]
    .map((niveau) => {
      if (niveau <= s.niveauLocal) {
        return `
          <div class="piece salle-${niveau} actif">
            <span class="piece-nom">${noms[niveau]}</span>
            <span class="piece-cap">+${capaciteLocale({ ...s, niveauLocal: niveau }) - capaciteLocale({ ...s, niveauLocal: niveau - 1 })} pl.</span>
          </div>`;
      }
      const cout = coutTravaux({ ...s, niveauLocal: niveau - 1 });
      if (cout === undefined) return "";
      if (niveau === s.niveauLocal + 1) {
        const dispo = s.budget >= cout;
        return `
          <button class="piece salle-${niveau} dispo" data-action="agrandir" ${dispo ? "" : "disabled"}>
            <span class="piece-nom">${noms[niveau]}</span>
            <span class="piece-cap">+${capaciteLocale({ ...s, niveauLocal: niveau }) - capaciteLocale(s)} pl.</span>
            <span class="piece-prix">${dispo ? "🏗" : "🔒"} ${eur(cout)}</span>
          </button>`;
      }
      return `
        <div class="piece salle-${niveau} verrou">
          <span class="piece-nom">${noms[niveau]}</span>
          <span class="piece-prix">🔒 ${eur(cout)}</span>
        </div>`;
    })
    .join("");

  const cout = coutTravaux(s);
  const insuffisant = cout !== undefined && s.budget < cout;

  return `
    ${entete("🏗 Travaux")}
    <div class="menu-corps">
      <div class="hint-small">Capacité de service actuelle : ~${capaciteBar(s)} clients/soir (équipe + machines, bridée par le local).</div>
      <div class="plan-bar">
        <div class="piece terrasse actif">
          <span class="piece-nom">Terrasse</span>
          <span class="piece-cap">50 pl.</span>
        </div>
        <div class="piece bar actif">
          <span class="piece-nom">🍸 Bar</span>
          <span class="piece-cap">100 pl.</span>
        </div>
        ${salles}
      </div>
      ${
        cout === undefined
          ? `<div class="ok-txt">Taille maximale atteinte 🏆</div>`
          : insuffisant
            ? `<p class="hint-small">Budget insuffisant pour la prochaine salle — c'est un gros coup à préparer.</p>`
            : `<p class="hint-small">Clique la salle éclairée pour lancer les travaux.</p>`
      }
    </div>`;
}

// ---- Banque (budget + emprunt initial) ----

function menuBanque(s: GameState): string {
  const total = s.detteInitiale;
  const restant = s.detteRestant;
  const rembourse = total - restant;
  const pct = Math.round((rembourse / total) * 100);
  const dette =
    restant <= 0
      ? `<div class="bloc-titre">Emprunt initial</div><div class="ok-txt">Soldé ✅</div>`
      : `
        <div class="bloc-titre">Emprunt initial</div>
        <div>Dette restante : <strong>${eur(restant)}</strong></div>
        <div class="jauge-barre" style="margin:8px 0"><span class="jauge-fill" style="width:${pct}%"></span></div>
        <div class="hint-small">Remboursé ${eur(rembourse)} / ${eur(total)}</div>
        <div>Remboursement : <strong>${Math.round(tauxDette(s.semaine) * 100)} % du CA de chaque semaine</strong></div>
        <div class="hint-small">Plus le bar tourne, plus la dette fond — une semaine creuse coûte peu. Le taux grimpe avec le temps : 15 % (sem. 1-10), 20 % (11-20), 35 % au-delà.</div>
        ${s.dernierBilan ? `<div class="hint-small">Semaine dernière : ${eur(s.dernierBilan.detteRemboursement)} remboursés.</div>` : ""}`;
  return `
    ${entete("🏦 Banque")}
    <div class="menu-corps">
      <div class="cal-now">Budget : <strong>${eur(s.budget)}</strong></div>
      ${dette}
    </div>`;
}

// ---- Historique ----

function menuHistorique(s: GameState): string {
  const lignes =
    s.historique.length === 0
      ? `<p class="hint-small">Aucune semaine terminée pour l'instant.</p>`
      : s.historique
          .map(
            (b) => `
        <details class="histo-details">
          <summary>
            <div class="histo-ligne">
              <span class="histo-sem"><span class="chevron">▸</span> S${b.semaine}</span>
              <span>CA <span class="pos">+${eur(b.chiffreAffaires)}</span></span>
              <span>Rés. <span class="${b.resultat < 0 ? "neg" : "pos"}">${b.resultat >= 0 ? "+" : ""}${eur(b.resultat)}</span></span>
              <span class="histo-budget">${eur(b.budgetApres)}</span>
            </div>
          </summary>
          <div class="histo-bilan">${bilanDetail(b)}</div>
        </details>`,
          )
          .join("");
  return `${entete("📜 Historique")}<div class="menu-corps">${lignes}</div>`;
}

// ---- Calendrier ----

function menuCalendrier(s: GameState): string {
  const aVenir = [1, 2, 3, 4]
    .map((d) => `<div class="cal-case">Semaine ${s.semaine + d}<small>—</small></div>`)
    .join("");
  return `
    ${entete("📅 Calendrier")}
    <div class="menu-corps">
      <div class="cal-now">Semaine courante : <strong>${s.semaine}</strong></div>
      <div class="cal-grid">${aVenir}</div>
      <p class="hint-small">Événements saisonniers : plus tard 📅</p>
    </div>`;
}

/** Affiche le menu ouvert (state.menuOuvert). */
export function ecranMenu(s: GameState): string {
  let corps: string;
  switch (s.menuOuvert) {
    case "salaries":
      corps = menuSalaries(s);
      break;
    case "cv":
      corps = menuCV(s);
      break;
    case "stock":
      corps = menuFournisseur(s);
      break;
    case "reparations":
      corps = menuReparations(s);
      break;
    case "menage":
      corps = menuMenage(s);
      break;
    case "travaux":
      corps = menuTravaux(s);
      break;
    case "banque":
      corps = menuBanque(s);
      break;
    case "historique":
      corps = menuHistorique(s);
      break;
    case "calendrier":
      corps = menuCalendrier(s);
      break;
    default:
      corps = entete("Menu");
  }
  return `<div class="ecran menu">${corps}</div>`;
}
