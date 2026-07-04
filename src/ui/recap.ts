// ============================================================
//  RÉCAP DE FIN DE SEMAINE (pop-up) — détail soir par soir,
//  salaires individuels, loyer, prêt, résultat.
// ============================================================

import type { GameState, WeeklyRecap } from "../game/types";
import { eur } from "./components";

/** Corps complet d'un bilan hebdo — partagé entre le pop-up de récap et l'Historique. */
export function bilanDetail(b: WeeklyRecap): string {
  const ligne = (label: string, montant: number) =>
    `<div class="bilan-ligne"><span>${label}</span><span class="${montant < 0 ? "neg" : "pos"}">${montant >= 0 ? "+" : ""}${eur(montant)}</span></div>`;

  // Détail des 7 soirs.
  const jours = b.jours
    .map((j) => {
      if (j.ferme) {
        return `
        <div class="jour-ligne ferme">
          <div class="jl-haut"><span class="jl-jour">${j.jour}</span><span class="tag">🚪 Fermé (repos)</span></div>
        </div>`;
      }
      const clientsTag = `<span class="tag">👥 ${j.clients} clients · ${eur(j.panier)}/pers.</span>`;
      const refus =
        j.refuses > 0 ? `<span class="tag neg">🚫 ${j.refuses} refusés (trop de monde)</span>` : "";
      const panne = j.pannes.length
        ? `<span class="tag neg">⚠ ${j.pannes.join(", ")} en panne</span>`
        : "";
      return `
        <div class="jour-ligne">
          <div class="jl-haut"><span class="jl-jour">${j.jour}</span><span class="${j.ca === 0 ? "neg" : "pos"}">${eur(j.ca)}</span></div>
          <div class="jl-tags">${clientsTag}${refus}${panne}</div>
        </div>`;
    })
    .join("");

  // Salaires détaillés.
  const salaires = b.salairesDetail.map((l) => ligne(l.nom, -l.montant)).join("");

  return `
        <div class="bloc-titre">Chiffre d'affaires de la semaine</div>
        <details class="recap-jours">
          <summary class="jour-resume">
            <span class="jr-gauche"><span class="chevron">▸</span><span class="jl-jour">Lun–Dim</span></span>
            <span class="jr-clients">👥 ${b.clientsTotal} clients</span>
            <span class="pos">+${eur(b.chiffreAffaires)}</span>
          </summary>
          <div class="jours-recap">${jours}</div>
        </details>
        ${b.refusesTotal > 0 ? `<div class="info neg">🚫 ${b.refusesTotal} clients refusés faute de place cette semaine</div>` : ""}
        ${b.notorDelta !== 0 ? `<div class="info ${b.notorDelta < 0 ? "neg" : "pos"}">📣 Réputation ${b.notorDelta > 0 ? "+" : ""}${b.notorDelta} cette semaine</div>` : ""}
        ${b.notes.map((n) => `<div class="info">${n}</div>`).join("")}
        ${ligne("Coût matières (boissons)", -b.matieres)}

        <div class="bloc-titre">Salaires</div>
        ${salaires}
        ${b.heuresSup > 0 ? ligne("⏰ Heures supplémentaires", -b.heuresSup) : ""}
        <div class="bilan-ligne"><span>Total salaires</span><span class="neg">−${eur(b.salaires + b.heuresSup)}</span></div>

        <div class="bilan-sep"></div>
        ${ligne("Loyer", -b.loyer)}
        ${ligne("Charges & taxes", -b.charges)}
        ${b.detteRemboursement > 0 ? ligne("Remboursement emprunt", -b.detteRemboursement) : ""}
        ${b.remboursement > 0 ? ligne("Remboursement prêt", -b.remboursement) : ""}
        ${b.inflation > 0 ? ligne("📈 Inflation (mode infini)", -b.inflation) : ""}
        ${b.evenements !== 0 ? ligne("🎲 Événements & imprévus", b.evenements) : ""}
        <div class="bilan-ligne total"><span>Résultat de la semaine</span><span class="${b.resultat < 0 ? "neg" : "pos"}">${b.resultat >= 0 ? "+" : ""}${eur(b.resultat)}</span></div>
        <div class="bilan-ligne total"><span>Budget restant</span><span>${eur(b.budgetApres)}</span></div>
  `;
}

export function ecranRecap(s: GameState): string {
  const b = s.dernierBilan;
  if (!b) return "";

  return `
    <div class="ecran modal-ecran">
      <div class="modal-backdrop"></div>
      <div class="modal">
        <h2>📋 Bilan — Semaine ${b.semaine}</h2>
        ${bilanDetail(b)}
        <p class="hint-small">🚚 Pense à réassortir au menu Fournisseur avant de rouvrir.</p>
        <button class="principal" data-action="fermerRecap">Continuer →</button>
      </div>
    </div>
  `;
}
