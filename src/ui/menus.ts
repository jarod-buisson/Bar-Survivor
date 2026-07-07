// ============================================================
//  SOUS-MENUS DU HUB — Salariés · Stock(Armand)+améliorations
//  · Réparations · Banque · Historique · Calendrier.
// ============================================================

import type { CV, Employee, GameState, Machine } from "../game/types";
import {
  aIngenieur,
  ameliorationsDebloquees,
  capaciteLocale,
  coutAutoStock,
  coutLicenciement,
  coutMenagePro,
  coutTravaux,
  prixDe,
  tauxDette,
  TAUX_LIVRET,
} from "../game/engine";
import type { Fonction, NiveauPrix } from "../game/types";

/** Libellés des 3 niveaux de prix (menu Fournisseur & prix). */
const PRIX_LABEL: Record<NiveauPrix, string> = {
  petit: "Petit prix",
  moyen: "Prix moyen",
  gros: "Gros prix",
};

/** Libellé + effet passif d'un salarié spécial (Psy/Mécano). */
function fonctionInfo(f: Fonction): { label: string; passif: string } {
  return f === "psychologue"
    ? { label: "🧠 Psychologue", passif: "Toute l'équipe ne fatigue plus jamais." }
    : { label: "🔧 Mécano", passif: "Plus aucune usure sur les machines." };
}
import { CATEGORIES_STOCK, HISTORIQUE_VERSIONS, MOIS_INFOS, VERSION_ACTUELLE, moisIndex } from "../game/content";
import {
  NIVEAU_MAX,
  bonusPanierPct,
  bonusPanierPctProchain,
  coutAmelioration,
  coutReparation,
} from "../game/machines";
import { badgeTrait, badgesTraits, barreStats, echap, eur } from "./components";
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
      // 🧠🔧 Salarié SPÉCIAL (fonction) : carte allégée, hors service (ni repos ni fatigue).
      if (e.fonction) {
        const info = fonctionInfo(e.fonction);
        return `
      <div class="salarie-carte">
        <div class="sc-portrait">${e.emoji}</div>
        <div class="sc-main">
          <div class="sc-nom">${e.nom} <span class="badge-fonction">${info.label}</span></div>
          <div class="sc-role">${eur(e.salaire)}/sem · ne fait pas le service</div>
          <div class="sc-stats">${statBar("❤ Moral", e.moral)}</div>
          <div class="hint-small pos">✨ ${info.passif}</div>
          ${licencier}
        </div>
      </div>`;
      }
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
  // 🧠🔧 CV SPÉCIAL (fonction) : pas de compétence ni de traits, on annonce l'effet passif.
  if (e.fonction) {
    const info = fonctionInfo(e.fonction);
    return `
    <div class="salarie-carte">
      <div class="sc-portrait">${e.emoji}</div>
      <div class="sc-main">
        <div class="sc-nom">${e.nom} <span class="badge-fonction">${info.label}</span></div>
        <div class="sc-role">${eur(e.salaire)}/sem · ne fait pas le service</div>
        <div class="hint-small pos">✨ ${info.passif}</div>
        <div class="c-actions">
          <button class="mini ok" data-action="embaucherCV" data-value="${e.id}">Embaucher</button>
          <button class="mini no" data-action="refuserCV" data-value="${e.id}">Refuser</button>
        </div>
      </div>
    </div>`;
  }
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
    // 🤖 Curseur gris (seuil auto) : visible seulement si l'auto-stock est acheté.
    const seuil = s.autoStockAchete ? Math.round(s.autoStockSeuils?.[c.id] ?? 0) : 0;
    const seuilLigne = s.autoStockAchete
      ? `
        <div class="seuil-ligne">
          <span class="seuil-lbl">🤖 seuil auto <span data-seuil-val="${c.id}">${seuil === 0 ? "off" : `${seuil}%`}</span></span>
          <div class="four-slider-wrap seuil-wrap" style="--fill:${seuil}%">
            <div class="four-fill"></div>
            <input type="range" class="seuil-slider" data-cat="${c.id}"
                   min="0" max="100" step="5" value="${seuil}" />
          </div>
        </div>`
      : "";
    const niveau = prixDe(s, c.id);
    const prixRow = (["petit", "moyen", "gros"] as const)
      .map(
        (niv) =>
          `<button class="prix-btn ${niveau === niv ? "actif" : ""}" data-action="setPrix" data-value="${c.id}:${niv}">${PRIX_LABEL[niv]}</button>`,
      )
      .join("");
    return `
      <div class="four-ligne ${alerte}">
        <div class="four-tete">
          <span class="four-nom">${c.emoji} ${c.nom}</span>
          <span class="four-val" data-cat-val="${c.id}">Stock : ${val}%</span>
        </div>
        <div class="four-slider-wrap" style="--fill:${val}%">
          <div class="four-fill"></div>
          <input type="range" class="four-slider" data-cat="${c.id}" data-prix="${c.prix}" data-base="${val}"
                 min="0" max="100" step="1" value="${val}" />
        </div>
        <div class="prix-choix">${prixRow}</div>
        ${seuilLigne}
      </div>`;
  }).join("");

  let ameliorations: string;
  if (!ameliorationsDebloquees(s)) {
    ameliorations = `<p class="hint-small">🔒 Améliorations débloquées à la semaine 5 (actuellement semaine ${s.semaine}).</p>`;
  } else {
    const coutAS = coutAutoStock();
    ameliorations = s.autoStockAchete
      ? `<div class="machine-ligne">
          <span>🤖 Auto-stock <small>règle le <b>seuil gris</b> de chaque produit ci-dessus : en fin de semaine, s'il est retombé sous le seuil, il est recomplété (plein tarif). « off » = désarmé.</small></span>
        </div>`
      : `<div class="machine-ligne">
          <span>🤖 Auto-stock <small>ajoute un seuil de sécurité par produit : recomplété tout seul chaque fin de semaine (payant)</small></span>
          <button class="mini ok" data-action="acheterAutoStock" ${s.budget >= coutAS ? "" : "disabled"}>Acheter (${eur(coutAS)})</button>
        </div>`;
    ameliorations += s.machines
      .map((m: Machine) => {
        if (m.niveau >= NIVEAU_MAX) {
          return `<div class="machine-ligne"><span>${m.emoji} ${m.nom}</span><span class="ok-txt">Niv. MAX</span></div>`;
        }
        const c = coutAmelioration(m);
        const dispo = s.budget >= c;
        return `
          <div class="machine-ligne">
            <span>${m.emoji} ${m.nom} <small>niv.${m.niveau} · panier +${bonusPanierPct(m)} % -> niv.${m.niveau + 1} · +${bonusPanierPctProchain(m)} %</small></span>
            <button class="mini ok" data-action="ameliorer" data-value="${m.id}" ${dispo ? "" : "disabled"}>Améliorer (${eur(c)})</button>
          </div>`;
      })
      .join("");
  }

  return `
    ${entete("📦 Fournisseur & prix")}
    <div class="menu-corps">
      <p class="hint-small">Tire un curseur pour commander. Et défini ton prix de vente en selectionnant le prix que tu veux mettre à chaques articles ! refère toi au 📅 Calendrier pour deviner comment les ajuster ! (si tu ne sais pas laisse en "Prix moyen")</p>
      <div class="fournisseur">${curseurs}</div>
      <div class="preset-btns">
        <button class="mini" data-action="presetStock" data-value="50">Tous les stocks à 50%</button>
        <button class="mini" data-action="presetStock" data-value="100">Tous les stocks à 100%</button>
      </div>
      <button class="principal" data-action="commander" id="btn-commander" disabled>
        Commander · <span id="cout-commande">0 €</span>
      </button>
      <div class="bloc-titre">Améliorer le matériel (+ panier, permanent)</div>
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
      <div class="hint-small">Un bar sale attire moins de monde, sauf les invités indésirables...</div>
      <div class="bloc-titre">Faire le ménage</div>
      <button class="principal" data-action="menageEquipe" ${nickel ? "disabled" : ""}>
        Ménage d'équipe — Incomplet
      </button>
      <button class="principal" data-action="menagePro" ${nickel || s.budget < coutMenagePro(s) ? "disabled" : ""}>
        Société de nettoyage — ${eur(coutMenagePro(s))} Complet
      </button>
      ${
        nickel
          ? `<p class="hint-small">Le bar brille déjà, rien à nettoyer.</p>`
          : `<p class="hint-small">La société facture selon l'état : déplacement + niveau de propreté à remonter.</p>`
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
      <div class="hint-small">⚠️ Lancer des travaux ferme le bar pendant toute la semaine du chantier.</div>
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
        <div class="hint-small">Plus le bar tourne, plus la dette fond !</div>
        ${s.dernierBilan ? `<div class="hint-small">Semaine dernière : ${eur(s.dernierBilan.detteRemboursement)} remboursés.</div>` : ""}`;
  const livret = Math.round(s.livret ?? 0);
  const gainHebdo = Math.round(livret * TAUX_LIVRET);
  const tauxPct = Math.round(TAUX_LIVRET * 100);
  const investissements = s.drapeaux["livret_arnaque"]
    ? ""
    : `
    <div class="bloc-titre">💰 Investissements</div>
    <div class="livret-bloc">
      <div class="four-tete">
        <span>🏦 Livret <small>bloqué à vie</small></span>
        <span>Placé : <strong>${eur(livret)}</strong></span>
      </div>
      ${livret > 0 ? `<div class="hint-small pos">+${eur(gainHebdo)} versés chaque semaine (${tauxPct} %).</div>` : ""}
      <p class="hint-small">Place ton argent : la banque te reversera <strong>${tauxPct} %</strong> chaque semaine. ⚠️ aucun retrait possible.</p>
      <div class="four-slider-wrap" style="--fill:0%">
        <div class="four-fill"></div>
        <input type="range" id="livret-slider" class="livret-slider" data-budget="${Math.round(s.budget)}"
               min="0" max="100" step="1" value="0" />
      </div>
      <div class="four-tete"><span class="hint-small">Montant à placer</span><span class="four-val" id="livret-montant">0 €</span></div>
      <button class="principal" data-action="investirLivret" id="btn-investir" disabled>Investir</button>
      <p class="hint-small">2 autres placements arrivent bientôt 📈</p>
    </div>`;
  return `
    ${entete("🏦 Banque")}
    <div class="menu-corps">
      <div class="cal-now">Budget : <strong>${eur(s.budget)}</strong></div>
      ${dette}
      ${investissements}
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
  const courant = moisIndex(s.semaine, s.moisDepart);
  const semaineDansMois = ((Math.max(1, s.semaine) - 1) % 4) + 1; // 1..4
  const info = MOIS_INFOS[courant];
  const cases = MOIS_INFOS.map((m, i) => {
    const actif = i === courant;
    return `
      <div class="mois-case ${actif ? "actif" : "grise"}">
        <span class="mois-nom">${m.nom}</span>
        ${actif ? `<span class="mois-tag">sem. ${semaineDansMois}/4</span>` : ""}
      </div>`;
  }).join("");
  return `
    ${entete("📅 Calendrier")}
    <div class="menu-corps">
      <div class="cal-now">Mois en cours : <strong>${info.nom}</strong> · semaine ${s.semaine}</div>
      <div class="mois-indice">💡 ${info.indice}</div>
      <p class="hint-small">Chaque mois a ses envies. Ajuste tes prix (menu 📦 Fournisseur & prix) pour coller à la demande du moment : plus tu vises juste, plus ça rapporte. On change de mois toutes les 4 semaines.</p>
      <div class="mois-grid">${cases}</div>
    </div>`;
}

// ---- Réglages ----

function menuReglages(s: GameState): string {
  return `
    ${entete("⚙ Réglages")}
    <div class="menu-corps">
      <div class="cal-now">${echap(s.nomBar || "Bar")} — Semaine <strong>${s.semaine}</strong></div>
      <button class="secondaire" data-action="ouvrirMenu" data-value="versions">📋 Versions (v${VERSION_ACTUELLE})</button>
      <p class="hint-small">La partie est sauvegardée automatiquement. Recommencer efface définitivement la partie en cours.</p>
      <button class="principal danger" data-action="recommencer">🔄 Recommencer une partie</button>
    </div>`;
}

// ---- Versions ----

function menuVersions(_s: GameState): string {
  const items = HISTORIQUE_VERSIONS.map(
    (v, i) => `
      <div class="version-item ${i === 0 ? "version-actuelle" : ""}">
        <div class="version-tete">
          <span class="version-num">v${v.version}</span>
          ${i === 0 ? `<span class="version-badge">actuelle</span>` : ""}
          <span class="version-titre">${v.titre}</span>
        </div>
        <p class="version-resume">${v.resume}</p>
      </div>`,
  ).join("");

  return `
    ${entete("📋 Versions")}
    <div class="menu-corps">
      <div class="cal-now">Version actuelle : <strong>v${VERSION_ACTUELLE}</strong></div>
      <div class="versions-liste">${items}</div>
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
    case "reglages":
      corps = menuReglages(s);
      break;
    case "versions":
      corps = menuVersions(s);
      break;
    default:
      corps = entete("Menu");
  }
  return `<div class="ecran menu">${barreStats(s)}${corps}</div>`;
}
