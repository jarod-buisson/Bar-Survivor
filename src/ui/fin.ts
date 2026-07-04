// ============================================================
//  ÉCRAN DE FIN — deux cas :
//   • "victoire" = dette remboursée (jalon, PAS une fin) → bouton Mode infini.
//   • "gameover" = faillite → dernier bilan pour comprendre + Rejouer.
// ============================================================

import type { GameState } from "../game/types";
import { eur } from "./components";

export function ecranFin(s: GameState): string {
  const victoire = s.phase === "victoire";
  const b = s.dernierBilan;

  const ligne = (label: string, montant: number) =>
    `<div class="bilan-ligne"><span>${label}</span><span class="${montant < 0 ? "neg" : "pos"}">${montant >= 0 ? "+" : ""}${eur(montant)}</span></div>`;

  const recap = b
    ? `
      <div class="fin-recap">
        <div class="bloc-titre">Dernière semaine — S${b.semaine}</div>
        <div class="info">👥 ${b.clientsTotal} clients servis${b.refusesTotal > 0 ? ` · ${b.refusesTotal} refusés` : ""}</div>
        ${ligne("Chiffre d'affaires", b.chiffreAffaires)}
        ${ligne("Coût matières", -b.matieres)}
        ${ligne("Salaires", -b.salaires)}
        ${ligne("Loyer", -b.loyer)}
        ${ligne("Charges & taxes", -b.charges)}
        ${b.detteRemboursement > 0 ? ligne("Remboursement emprunt", -b.detteRemboursement) : ""}
        ${b.inflation > 0 ? ligne("Inflation (mode infini)", -b.inflation) : ""}
        <div class="bilan-ligne total"><span>Résultat</span><span class="${b.resultat < 0 ? "neg" : "pos"}">${b.resultat >= 0 ? "+" : ""}${eur(b.resultat)}</span></div>
        <div class="bilan-ligne total"><span>Budget final</span><span>${eur(b.budgetApres)}</span></div>
      </div>`
    : "";

  if (victoire) {
    const semaines = s.semaineVictoire ?? s.semaine;
    return `
      <div class="ecran fin win">
        <div class="grand-portrait">🎉</div>
        <h1>Bar sauvé !</h1>
        <p class="raison">${s.detteInitiale > 0 ? `Tu as remboursé les <strong>${eur(s.detteInitiale)}</strong> en <strong>${semaines}</strong> semaines.` : `Parti sans emprunt, sans dette.`} Le bar est à toi, libre de toute dette.</p>
        ${recap}
        <p class="hint">Mode infini : plus de dette, mais les charges vont grimper semaine après semaine. Tiens le plus longtemps possible avant la faillite.</p>
        <button class="principal" data-action="modeInfini">Mode infini →</button>
      </div>
    `;
  }

  return `
    <div class="ecran fin lose">
      <div class="grand-portrait">💀</div>
      <h1>Game Over</h1>
      <p class="raison">${s.raisonFin ?? ""}</p>
      <p class="score">Tu as tenu <strong>${s.semaine}</strong> semaine${s.semaine > 1 ? "s" : ""}.</p>
      ${recap}
      <button class="principal" data-action="rejouer">Rejouer</button>
    </div>
  `;
}
