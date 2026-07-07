// ============================================================
//  POINT D'ENTRÉE — relie le moteur (engine) et l'interface (ui).
//  Garde l'état, réagit aux clics, gère l'animation de la semaine,
//  ré-affiche l'écran courant.
//
//  v0.3 : la semaine se déroule seule (plus d'événements à choix).
//  Animation des 7 jours → simulation → récap détaillé.
// ============================================================

import "./style.css";
import type { GameState, NiveauPrix, StockCategorie } from "./game/types";
import {
  acheterAutoStock,
  agrandirBar,
  aidesPourChoix,
  ameliorerMachine,
  appliquerChoix,
  appliquerEffet,
  bonusChanceux,
  commanderStocks,
  coutCommande,
  coutCommandeBrut,
  creerPartie,
  definirEmprunt,
  definirNomBar,
  EMPRUNT_MAX,
  embaucher,
  embaucherCV,
  investirLivret,
  joursOuverture,
  licencier,
  menageEquipe,
  menagePro,
  planifierEvenements,
  preparerSemaineSuivante,
  probaAvecAide,
  refuserCV,
  refuserCandidat,
  reparerIngenieur,
  reparerPro,
  resoudreTacos,
  simulerSemaine,
  tirerEvenement,
  declencherEvenement,
  toggleRepos,
} from "./game/engine";
import { TACOS_CRUDITES, TACOS_SAUCES, TACOS_SAUCE_FROMAGERE, TACOS_VIANDES } from "./game/content";
import {
  ecranAccueil,
  ecranAlerte,
  ecranEmbauche,
  ecranEvenement,
  ecranFin,
  ecranHub,
  ecranLancement,
  ecranMenu,
  ecranPresentation,
  ecranRecap,
  ecranSemaine,
  initTooltips,
} from "./ui";
import { eur } from "./ui/components";
import { cartesTraitsAntho, emojiEmprunt, objectifEmprunt, salarieDeBase } from "./ui/onboarding";
import { aTrait, tirerTraits } from "./game/traits";

const app = document.getElementById("app")!;

let state: GameState | null = null;
let minuteur: number | undefined;

const JOUR_MS = 280;
const JOUR_FERME_MS = 90; // les jours fermés défilent vite (on saute le service)

// ---- Sauvegarde locale (localStorage) : pas de backend, juste survivre au F5 ----
const SAVE_KEY = "bar-survival-save";

function sauvegarder(): void {
  if (!state) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    // stockage indisponible (navigation privée, quota...) : tant pis, pas bloquant
  }
}

function chargerSauvegarde(): GameState | null {
  try {
    const brut = localStorage.getItem(SAVE_KEY);
    if (!brut) return null;
    const s = JSON.parse(brut) as GameState;
    return typeof s?.semaine === "number" ? s : null;
  } catch {
    return null;
  }
}

function effacerSauvegarde(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // rien à faire
  }
}

/** Rendu avec fondu : quand on CHANGE d'écran (phase ou menu), le navigateur
 *  fait un court crossfade via l'API View Transitions (110 ms, voir style.css).
 *  Les re-rendus internes (animation de semaine, sliders, toggles, pinte)
 *  restent instantanés pour ne jamais ralentir le joueur. */
let dernierEcran = "";
function rendre(): void {
  const cle = state
    ? `${state.phase}:${state.menuOuvert ?? ""}:${state.phase === "presentation" ? state.presentationEtape : ""}`
    : "accueil";
  const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
  const change = cle !== dernierEcran;
  dernierEcran = cle;
  // Re-rendu du même écran (toggle, slider...) : on garde la position de scroll,
  // sinon app.innerHTML recrée le conteneur et le fait sauter en haut. On restaure
  // CHAQUE conteneur défilable : les sous-menus (Salariés, etc.) scrollent sur
  // `.menu-corps`, pas sur `.ecran` — d'où le saut au toggle d'un repos en bas.
  const SELECTEURS_SCROLL = [".ecran", ".menu-corps"];
  const scrolls: Record<string, number> = {};
  if (!change) {
    for (const sel of SELECTEURS_SCROLL) scrolls[sel] = app.querySelector(sel)?.scrollTop ?? 0;
  }
  if (change && doc.startViewTransition) {
    doc.startViewTransition(() => rendreBrut());
  } else {
    rendreBrut();
  }
  if (!change) {
    for (const sel of SELECTEURS_SCROLL) {
      const top = scrolls[sel];
      const el = app.querySelector(sel);
      if (top && el) el.scrollTop = top;
    }
  }
  sauvegarder();
}

function rendreBrut(): void {
  if (!state) {
    app.innerHTML = ecranAccueil();
    return;
  }
  switch (state.phase) {
    case "presentation":
      app.innerHTML = ecranPresentation(state);
      break;
    case "embauche":
      app.innerHTML = ecranEmbauche(state);
      break;
    case "lancement":
      app.innerHTML = ecranLancement(state);
      break;
    case "semaine":
      app.innerHTML = ecranSemaine(state);
      break;
    case "evenement":
      app.innerHTML = ecranEvenement(state);
      break;
    case "recapPopup":
      app.innerHTML = ecranRecap(state);
      break;
    case "alerte":
      app.innerHTML = ecranAlerte(state);
      break;
    case "hub":
      app.innerHTML = state.menuOuvert ? ecranMenu(state) : ecranHub(state);
      break;
    case "gameover":
    case "victoire":
      app.innerHTML = ecranFin(state);
      break;
    default:
      app.innerHTML = ecranAccueil();
  }
}

/** Durée de la transition "ouverture du bar" avant le vrai début de semaine
 *  (voir ecranLancement + .lancement-tuiles/.lancement-intro dans style.css). */
const LANCEMENT_MS = 2000;

/** Démarre la semaine : d'abord la transition "les tuiles s'aplatissent" (2 s),
 *  puis l'animation des 7 jours et la simulation + récap. Des événements
 *  peuvent interrompre l'animation des jours (pop-up à choix). */
function lancerSemaine(): void {
  if (!state) return;
  if (minuteur) window.clearTimeout(minuteur);
  state.phase = "lancement";
  rendre();
  // Double rAF : on laisse le navigateur peindre l'état "plein" avant de
  // basculer les classes, sinon la transition CSS n'a rien à interpoler.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      app.querySelector(".lancement-tuiles")?.classList.add("reduites");
      app.querySelector(".lancement-intro")?.classList.add("visible");
    });
  });
  minuteur = window.setTimeout(() => {
    if (!state) return;
    state.jourAnim = 0;
    state.phase = "semaine";
    planifierEvenements(state); // tire les jours d'événement de la semaine
    rendre();
    avancerJour();
  }, LANCEMENT_MS);
}

function avancerJour(): void {
  if (!state) return;
  // Jour fermé (repos) : l'animation le saute presque instantanément.
  const prochainOuvert = joursOuverture(state)[state.jourAnim];
  minuteur = window.setTimeout(
    () => {
      if (!state) return;
      state.jourAnim += 1;
      rendre();
      // Un événement tombe ce jour-là : pause de l'animation, pop-up à choix.
      // La reprise se fait au clic sur un choix (action "choix").
      if (state.joursEvenements.includes(state.jourAnim)) {
        tirerEvenement(state); // ne change de phase que s'il y a un événement éligible
        if (state.phase === "evenement") {
          rendre();
          return;
        }
      }
      finJourOuContinue();
    },
    prochainOuvert ? JOUR_MS : JOUR_FERME_MS,
  );
}

/** Ferme le pop-up d'événement, ouvre un éventuel enchaînement (ex : vomi
 *  après la soirée étudiante — même soir), sinon reprend l'animation. */
function reprendreApresEvenement(): void {
  if (!state) return;
  state.evenementCourant = undefined;
  const enchaine = state.evenementEnchaine;
  state.evenementEnchaine = undefined;
  if (enchaine) {
    declencherEvenement(state, enchaine.id, enchaine.texte);
    if (state.evenementCourant) {
      rendre(); // nouveau pop-up : l'animation reste en pause ce soir-là
      return;
    }
  }
  state.phase = "semaine";
  rendre();
  finJourOuContinue();
}

/** Fin de l'animation (7 jours) → simulation ; sinon jour suivant. */
function finJourOuContinue(): void {
  if (!state) return;
  if (state.jourAnim >= 7) {
    simulerSemaine(state); // calcule le CA soir par soir + applique tout
    rendre();
    return;
  }
  avancerJour();
}

app.addEventListener("click", (e) => {
  const cible = (e.target as HTMLElement).closest("[data-action]") as HTMLElement | null;
  if (!cible) return;
  const action = cible.dataset.action!;
  const value = cible.dataset.value;

  switch (action) {
    case "commencer":
      state = creerPartie("difficile", "populaire");
      break;
    case "presSuivant":
      // Onboarding : on lit la carte courante (nom / emprunt) avant d'avancer.
      if (state && state.phase === "presentation") {
        if (state.presentationEtape === 1) {
          const inp = document.getElementById("nom-bar") as HTMLInputElement | null;
          definirNomBar(state, inp?.value ?? "");
        } else if (state.presentationEtape === 2) {
          const curseur = document.getElementById("emprunt-slider") as HTMLInputElement | null;
          if (curseur) definirEmprunt(state, Number(curseur.value));
        }
        state.presentationEtape = Math.min(4, state.presentationEtape + 1);
      }
      break;
    case "randomAntho":
      // Onboarding : on relance le sort sur Antho — force ET faiblesse changent
      // ensemble (on ne choisit pas vraiment, on retente le combo). On ré-injecte
      // seulement les cartes de traits : pas de rendre() complet, sinon les textes
      // « machine à écrire » de la carte rejoueraient leur apparition.
      if (state && state.phase === "presentation") {
        const antho = salarieDeBase(state);
        const t = tirerTraits();
        antho.forces = t.forces;
        antho.faiblesses = t.faiblesses;
        const cont = document.getElementById("antho-traits");
        if (cont) cont.innerHTML = cartesTraitsAntho(state);
      }
      return;
    case "versHub":
      if (state) {
        state.phase = "hub";
        state.menuOuvert = undefined;
      }
      break;
    case "embaucher":
      if (state && value) embaucher(state, value);
      break;
    case "refuser":
      if (state && value) refuserCandidat(state, value);
      break;
    case "embaucherCV":
      if (state && value) embaucherCV(state, value);
      break;
    case "refuserCV":
      if (state && value) refuserCV(state, value);
      break;
    case "toggleRepos":
      if (state && value) {
        const [id, jour] = value.split(":");
        toggleRepos(state, id, Number(jour));
      }
      break;
    case "licencier":
      if (state && value) licencier(state, value);
      break;
    case "lancerSemaine":
      lancerSemaine();
      return; // l'animation gère le rendu
    case "choix": {
      // Choix d'événement : s'il comporte un pari, on tire le résultat en coulisses
      // et on lance l'animation de la pinte ; sinon on applique et on reprend.
      if (state && state.phase === "evenement") {
        const index = Number(cible.dataset.index);
        const choixEv = state.evenementCourant?.choix[index];
        // Négociation Olmo : ce choix n'applique rien lui-même, il ouvre le curseur.
        if (choixEv?.effet.ouvrirNegociationOlmo) {
          const plafondAccepte = state.employes.some((e) => !e.demissionne && aTrait(e, "mafieux"))
            ? 40
            : 32;
          state.negociationOlmo = { plafondAccepte, valeur: 20 };
          rendre();
          return;
        }
        // Config du tacos de Brisco : ce choix n'applique rien lui-même, il ouvre les 4 cases.
        if (choixEv?.effet.ouvrirConfigTacos) {
          state.configTacos = { viande: 0, sauceFromagere: 0, sauce: 0, crudites: 0 };
          rendre();
          return;
        }
        const tirage = choixEv?.effet.tirage;
        if (tirage && choixEv && !state.tirageEnCours) {
          // Aide assignée à CE choix (revalidée : salarié encore éligible) → proba boostée.
          const aidant =
            state.aideEvenement?.choixIndex === index &&
            aidesPourChoix(state, choixEv).some((x) => x.id === state!.aideEvenement!.employeId)
              ? state.employes.find((x) => x.id === state!.aideEvenement!.employeId)
              : undefined;
          const proba = probaAvecAide(tirage, aidant !== undefined, bonusChanceux(state));
          state.tirageEnCours = {
            index,
            gagne: Math.random() < proba,
            proba,
            risque: tirage.risque === true,
            aide: aidant ? { nom: aidant.nom, emoji: aidant.emoji } : undefined,
          };
          rendre(); // affiche la pinte qui se remplit
          return;
        }
        appliquerChoix(state, index);
        reprendreApresEvenement();
      }
      return; // la reprise gère le rendu
    }
    case "finTirage":
      // Fin de l'animation de la pinte : on applique le choix avec le résultat pré-tiré.
      if (state && state.phase === "evenement" && state.tirageEnCours) {
        appliquerChoix(state, state.tirageEnCours.index, state.tirageEnCours.gagne);
        state.tirageEnCours = undefined;
        reprendreApresEvenement();
      }
      return;
    case "confirmerNegociationOlmo":
      // Contre-offre validée : accepté si ≤ plafond, sinon l'Olmo se braque (casse en fin de semaine).
      if (state && state.phase === "evenement" && state.negociationOlmo) {
        const { valeur, plafondAccepte } = state.negociationOlmo;
        const budgetRef = state.historique[state.historique.length - 1]?.budgetApres ?? state.budget;
        const recu = Math.round(budgetRef * 0.5);
        const succes = valeur <= plafondAccepte;
        // valeur = % de commission que tu réclames ; tu TOUCHES ce montant (positif),
        // l'argent blanchi ne passe jamais par ton budget.
        const garde = Math.round(recu * (valeur / 100));
        const effet = succes
          ? {
              budget: garde,
              note: `🤝 L'Olmo accepte ${valeur} % : tu touches ${garde.toLocaleString("fr-FR")} € de commission, propre.`,
            }
          : {
              poseDrapeau: { cle: "sem_olmo_casse", valeur: true },
              note: "😠 L'Olmo pense que tu te fous de lui. Il part sans un mot — il y aura de la casse.",
            };
        const budgetAvant = state.budget;
        appliquerEffet(state, effet);
        state.evenementsBudget += state.budget - budgetAvant;
        state.negociationOlmo = undefined;
        state.evenementsJoues += 1;
        reprendreApresEvenement();
      }
      return;
    case "tacosCycle":
      // value = "categorie:direction" (ex. "viande:1" ou "sauce:-1") : fait défiler la case.
      if (state && state.configTacos && value) {
        const [cat, dirStr] = value.split(":") as [keyof GameState["configTacos"] & string, string];
        const longueurs: Record<string, number> = {
          viande: TACOS_VIANDES.length,
          sauceFromagere: TACOS_SAUCE_FROMAGERE.length,
          sauce: TACOS_SAUCES.length,
          crudites: TACOS_CRUDITES.length,
        };
        const len = longueurs[cat];
        const config = state.configTacos as unknown as Record<string, number>;
        config[cat] = (config[cat] + Number(dirStr) + len) % len;
        rendre();
      }
      return;
    case "validerTacos":
      if (state && state.phase === "evenement" && state.configTacos) {
        resoudreTacos(state);
        state.evenementsJoues += 1;
        reprendreApresEvenement();
      }
      return;
    case "ouvrirMenu":
      if (state && value) state.menuOuvert = value;
      break;
    case "fermerMenu":
      if (state) state.menuOuvert = undefined;
      break;
    case "commander":
      if (state) {
        const cibles: Partial<Record<StockCategorie, number>> = {};
        app.querySelectorAll<HTMLInputElement>(".four-slider").forEach((el) => {
          if (el.dataset.cat) {
            cibles[el.dataset.cat as StockCategorie] = Math.max(
              Number(el.dataset.base),
              Number(el.value),
            );
          }
        });
        // Commande passée → retour direct au hub (plus rien à faire ici).
        if (commanderStocks(state, cibles)) state.menuOuvert = undefined;
      }
      break;
    case "menageEquipe":
      if (state) menageEquipe(state);
      break;
    case "menagePro":
      if (state) menagePro(state);
      break;
    case "reparerIng":
      if (state && value) reparerIngenieur(state, value);
      break;
    case "reparerPro":
      if (state && value) reparerPro(state, value);
      break;
    case "ameliorer":
      if (state && value) ameliorerMachine(state, value);
      break;
    case "acheterAutoStock":
      if (state) acheterAutoStock(state);
      break;
    case "investirLivret":
      if (state) {
        const sl = document.getElementById("livret-slider") as HTMLInputElement | null;
        const pct = sl ? Number(sl.value) : 0;
        investirLivret(state, (state.budget * pct) / 100);
      }
      break;
    case "presetStock":
      // Prérègle TOUS les curseurs de commande d'un coup (50 % ou 100 %) sans
      // descendre sous le stock actuel. Manip DOM directe + recalcul du coût, sans
      // re-render : sinon les curseurs repartiraient de leur valeur d'origine.
      if (value) {
        const cible = Number(value);
        app.querySelectorAll<HTMLInputElement>(".four-slider").forEach((el) => {
          el.value = String(Math.max(Number(el.dataset.base), cible));
        });
        majCoutCommande();
      }
      return;
    case "agrandir":
      if (state) agrandirBar(state);
      break;
    case "setPrix":
      // Choix du tarif d'une ressource (radio Petit/Moyen/Gros). data-value = "cat:niveau".
      if (state && value) {
        const [cat, niv] = value.split(":");
        (state.prix ??= {})[cat as StockCategorie] = niv as NiveauPrix;
      }
      break;
    case "fermerRecap":
      if (state) {
        const soldee = state.detteJusteSoldee === true;
        const perte = state.dernierBilan ? state.dernierBilan.resultat < 0 : false;
        state.detteJusteSoldee = false;
        preparerSemaineSuivante(state);
        if (state.phase !== "gameover") {
          state.menuOuvert = undefined;
          state.phase = soldee ? "victoire" : perte ? "alerte" : "hub";
        }
      }
      break;
    case "fermerAlerte":
      if (state) {
        state.phase = "hub";
        state.menuOuvert = undefined;
      }
      break;
    case "modeInfini":
      if (state) {
        state.modeInfini = true;
        state.phase = "hub";
        state.menuOuvert = undefined;
      }
      break;
    case "rejouer":
      if (minuteur) window.clearTimeout(minuteur);
      state = null;
      effacerSauvegarde();
      break;
    case "recommencer":
      // Action destructive : on efface la partie en cours et on repart à zéro
      // (écran d'accueil → onboarding). Confirmation obligatoire.
      if (!window.confirm("Recommencer une nouvelle partie ? La partie en cours sera définitivement effacée.")) {
        return;
      }
      if (minuteur) window.clearTimeout(minuteur);
      state = null;
      effacerSauvegarde();
      break;
  }
  rendre();
});

/** Recalcule en direct le coût de la commande fournisseur au glissement des curseurs.
 *  📦 Négociant présent : prix normal barré + prix réellement payé (remisé). */
function majCoutCommande(): void {
  if (!state) return;
  const cibles: Partial<Record<StockCategorie, number>> = {};
  app.querySelectorAll<HTMLInputElement>(".four-slider").forEach((el) => {
    const base = Number(el.dataset.base);
    if (Number(el.value) < base) el.value = String(base); // pas de commande négative
    const wrap = el.closest(".four-slider-wrap") as HTMLElement | null;
    if (wrap) wrap.style.setProperty("--fill", `${el.value}%`);
    cibles[el.dataset.cat as StockCategorie] = Number(el.value);
    const valLbl = app.querySelector(`[data-cat-val="${el.dataset.cat}"]`);
    if (valLbl) valLbl.textContent = `Stock : ${el.value}%`;
  });
  const brut = coutCommandeBrut(state, cibles);
  const total = coutCommande(state, cibles);
  const coutEl = document.getElementById("cout-commande");
  if (coutEl) {
    coutEl.innerHTML = total < brut ? `<s>${eur(brut)}</s> ${eur(total)}` : eur(total);
  }
  const btn = document.getElementById("btn-commander") as HTMLButtonElement | null;
  if (btn) btn.disabled = total <= 0 || total > state.budget;
}

app.addEventListener("input", (e) => {
  const el = e.target as HTMLElement;
  // Curseur d'emprunt (onboarding) : le pas de 10 k€ fait « snapper » la valeur,
  // la transition CSS de .four-fill anime le remplissage entre deux crans.
  if (el.classList.contains("emprunt-slider")) {
    const v = Number((el as HTMLInputElement).value);
    const val = document.getElementById("emprunt-val");
    if (val) val.textContent = eur(v);
    const emo = document.getElementById("emprunt-emoji");
    if (emo) emo.textContent = emojiEmprunt(v);
    const obj = document.getElementById("emprunt-obj");
    if (obj) obj.innerHTML = objectifEmprunt(v);
    (el.closest(".four-slider-wrap") as HTMLElement | null)?.style.setProperty(
      "--fill",
      `${(v / EMPRUNT_MAX) * 100}%`,
    );
    return;
  }
  // Curseur de négociation avec l'Olmo (20 % → 50 %, ne peut que monter).
  if (el.classList.contains("negociation-slider")) {
    majNegociationOlmo();
    return;
  }
  if (el.classList.contains("four-slider")) majCoutCommande();
  else if (el.classList.contains("seuil-slider")) majSeuilAuto(el as HTMLInputElement);
  else if (el.classList.contains("livret-slider")) majLivret(el as HTMLInputElement);
});

/** Curseur du livret (Banque) : % du budget à placer. Met à jour le remplissage,
 *  le montant en € et l'état du bouton Investir (désactivé à 0). */
function majLivret(el: HTMLInputElement): void {
  const pct = Number(el.value);
  const budget = Number(el.dataset.budget) || 0;
  const montant = Math.round((budget * pct) / 100);
  const wrap = el.closest(".four-slider-wrap") as HTMLElement | null;
  if (wrap) wrap.style.setProperty("--fill", `${pct}%`);
  const lbl = document.getElementById("livret-montant");
  if (lbl) lbl.textContent = eur(montant);
  const btn = document.getElementById("btn-investir") as HTMLButtonElement | null;
  if (btn) btn.disabled = montant <= 0;
}

/** Curseur gris (seuil auto-stock) d'une catégorie : met à jour le remplissage,
 *  le libellé et enregistre le seuil dans l'état (0 = désarmé, « off »). */
function majSeuilAuto(el: HTMLInputElement): void {
  if (!state) return;
  const cat = el.dataset.cat as StockCategorie | undefined;
  if (!cat) return;
  const v = Number(el.value);
  (state.autoStockSeuils ??= {})[cat] = v;
  const wrap = el.closest(".four-slider-wrap") as HTMLElement | null;
  if (wrap) wrap.style.setProperty("--fill", `${v}%`);
  const lbl = app.querySelector(`[data-seuil-val="${cat}"]`);
  if (lbl) lbl.textContent = v === 0 ? "off" : `${v}%`;
}

/** Met à jour en direct le remplissage/texte/bouton du curseur de négociation Olmo. */
function majNegociationOlmo(): void {
  if (!state || !state.negociationOlmo) return;
  const input = document.getElementById("negociation-slider") as HTMLInputElement | null;
  if (!input) return;
  const v = Number(input.value);
  state.negociationOlmo.valeur = v;
  const wrap = input.closest(".four-slider-wrap") as HTMLElement | null;
  if (wrap) wrap.style.setProperty("--fill", `${((v - 20) / (50 - 20)) * 100}%`);
  const valLbl = document.getElementById("negociation-val");
  if (valLbl) valLbl.textContent = `${v} %`;
  const btn = document.getElementById("negociation-confirmer");
  if (btn) btn.textContent = `Proposer ${v} %`;
}

// ---- Curseurs (fournisseur + emprunt) : drag tactile sur tout le rail ----
// Un <input type=range> restylé (-webkit-appearance:none) suit mal le doigt
// sur mobile : on pilote la valeur nous-mêmes au pointermove, comme le drag
// des jetons d'aide plus bas — même stratégie, même raison (tactile fiable).
let dragSlider: HTMLInputElement | null = null;

function valeurDepuisPointer(input: HTMLInputElement, wrap: HTMLElement, clientX: number): number {
  const rect = wrap.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const min = Number(input.min) || 0;
  const max = Number(input.max) || 100;
  const step = Number(input.step) || 1;
  const brut = min + ratio * (max - min);
  return Math.min(max, Math.max(min, Math.round(brut / step) * step));
}

function appliquerValeurSlider(input: HTMLInputElement, v: number): void {
  if (String(v) === input.value) return;
  input.value = String(v);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

app.addEventListener("pointerdown", (e) => {
  const wrap = (e.target as HTMLElement).closest(".four-slider-wrap") as HTMLElement | null;
  if (!wrap) return;
  const input = wrap.querySelector<HTMLInputElement>(".four-slider, .seuil-slider, .livret-slider");
  if (!input) return;
  e.preventDefault();
  dragSlider = input;
  appliquerValeurSlider(input, valeurDepuisPointer(input, wrap, e.clientX));
});

window.addEventListener("pointermove", (e) => {
  if (!dragSlider) return;
  const wrap = dragSlider.closest(".four-slider-wrap") as HTMLElement | null;
  if (!wrap) return;
  appliquerValeurSlider(dragSlider, valeurDepuisPointer(dragSlider, wrap, e.clientX));
});

window.addEventListener("pointerup", () => {
  dragSlider = null;
});
window.addEventListener("pointercancel", () => {
  dragSlider = null;
});

// ---- Aide au tirage : drag & drop d'un jeton salarié sur un choix ----
// Pointer events : fonctionne au doigt (mobile) comme à la souris. Le jeton
// suit le pointeur (clone flottant) ; lâché sur un choix compatible → aide
// assignée (re-render) ; lâché dans le vide → aide retirée.
let dragAide: { id: string; ghost: HTMLElement } | null = null;

function cibleDrop(e: PointerEvent): HTMLElement | null {
  const el = document.elementFromPoint(e.clientX, e.clientY);
  return (el?.closest("[data-drop-choix]") as HTMLElement | null) ?? null;
}

function bougeGhost(ghost: HTMLElement, e: PointerEvent): void {
  ghost.style.left = `${e.clientX}px`;
  ghost.style.top = `${e.clientY}px`;
}

function finDrag(): void {
  if (!dragAide) return;
  dragAide.ghost.remove();
  dragAide = null;
  app.querySelectorAll(".drop-hover").forEach((el) => el.classList.remove("drop-hover"));
}

app.addEventListener("pointerdown", (e) => {
  const chip = (e.target as HTMLElement).closest(".aide-chip") as HTMLElement | null;
  if (!chip || !state || state.phase !== "evenement" || dragAide) return;
  e.preventDefault();
  const ghost = chip.cloneNode(true) as HTMLElement;
  ghost.classList.add("aide-ghost");
  document.body.appendChild(ghost);
  bougeGhost(ghost, e);
  chip.classList.add("dragging");
  dragAide = { id: chip.dataset.aideId!, ghost };
});

window.addEventListener("pointermove", (e) => {
  if (!dragAide) return;
  bougeGhost(dragAide.ghost, e);
  const sur = cibleDrop(e);
  app.querySelectorAll(".drop-hover").forEach((el) => el.classList.remove("drop-hover"));
  if (sur) sur.classList.add("drop-hover");
});

window.addEventListener("pointerup", (e) => {
  if (!dragAide) return;
  const id = dragAide.id;
  finDrag();
  if (!state || !state.evenementCourant) return;
  const sur = cibleDrop(e);
  if (sur) {
    const index = Number(sur.dataset.dropChoix);
    const choix = state.evenementCourant.choix[index];
    if (choix && aidesPourChoix(state, choix).some((x) => x.id === id)) {
      state.aideEvenement = { employeId: id, choixIndex: index };
    }
  } else if (state.aideEvenement?.employeId === id) {
    state.aideEvenement = undefined; // lâché dans le vide : on retire l'aide
  }
  rendre();
});

window.addEventListener("pointercancel", finDrag);

initTooltips();
state = chargerSauvegarde();
// Rechargée en pleine animation de semaine (F5 pendant le défilement des jours) :
// aucun timer n'a survécu au rechargement, on relance juste la suite.
if (state && state.phase === "semaine" && !state.evenementCourant) {
  avancerJour();
}
rendre();
