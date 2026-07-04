// ============================================================
//  TOOLTIP FLOTTANT — infobulle positionnée sur <body> (position:fixed)
//  pour ne PAS être rognée par le cadre du téléphone (overflow:hidden).
//  S'attache à tout élément possédant data-tip.
// ============================================================

let box: HTMLElement | null = null;

function boite(): HTMLElement {
  if (!box) {
    box = document.createElement("div");
    box.className = "tooltip-flottant";
    box.style.display = "none";
    document.body.appendChild(box);
  }
  return box;
}

function afficher(cible: HTMLElement): void {
  const texte = cible.dataset.tip;
  if (!texte) return;
  const b = boite();
  b.textContent = texte;
  b.style.display = "block";

  const marge = 8;
  const largeur = Math.min(220, window.innerWidth - 2 * marge);
  b.style.width = `${largeur}px`;

  const r = cible.getBoundingClientRect();
  let gauche = r.left + r.width / 2 - largeur / 2;
  gauche = Math.max(marge, Math.min(gauche, window.innerWidth - largeur - marge));
  b.style.left = `${gauche}px`;

  // Au-dessus de l'élément ; si pas la place, en dessous.
  let haut = r.top - b.offsetHeight - marge;
  if (haut < marge) haut = r.bottom + marge;
  b.style.top = `${haut}px`;
}

function cacher(): void {
  if (box) box.style.display = "none";
}

/** À appeler une fois au démarrage. */
export function initTooltips(): void {
  document.addEventListener("mouseover", (e) => {
    const cible = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (cible) afficher(cible);
  });
  document.addEventListener("mouseout", (e) => {
    const cible = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
    if (cible) cacher();
  });
}
