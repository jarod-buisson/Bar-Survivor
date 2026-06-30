# 🍺 Bar Survival

Roguelite de gestion narrative pour mobile (iOS / Android).
Inspiré de Reigns, Underchoice, Balatro et Papers Please.

> Tu gères un bar qui part à la dérive. Chaque décision compte,
> et la faillite est toujours à un mauvais choix.

## Techno

- **TypeScript** + **Vite** (web) → testable instantanément dans le navigateur.
- **Capacitor** (à venir) pour emballer le jeu en vraie app iOS / Android,
  à partir du **même code**.

## Lancer le jeu (développement)

Dans un terminal, depuis ce dossier :

```bash
npm install      # une seule fois (installe les outils)
npm run dev      # démarre le jeu sur http://localhost:5173
```

Ouvre ensuite `http://localhost:5173` dans ton navigateur.
Le jeu se recharge tout seul à chaque modification du code (rechargement à chaud).

```bash
npm run build    # crée la version optimisée (dossier dist/) + vérifie les types
```

## Structure du projet

```
src/
├── main.ts            Point d'entrée : relie le moteur et l'interface
├── style.css          Thème visuel (mobile vertical, ambiance bar)
├── ui.ts              Construit le HTML de chaque écran
└── game/
    ├── types.ts       Définition de toutes les données du jeu
    ├── content.ts     Salariés + ÉVÉNEMENTS (c'est ici qu'on ajoute du contenu)
    └── engine.ts      Logique : CA, choix, fin de semaine, game over
```

👉 **Pour ajouter un événement**, il suffit d'ajouter un objet dans la liste
`EVENEMENTS` de `src/game/content.ts`. Aucune autre modification nécessaire.

👉 **Pour équilibrer l'économie** (budgets, multiplicateurs, loyer, conso de
stock), tout est regroupé en haut de `src/game/engine.ts`.

## État d'avancement (selon le GDD)

**Phase 1 — Prototype : ✅ terminée**
- [x] Interface mobile verticale
- [x] Système de budget
- [x] Salariés avec moral + type d'offre
- [x] Événements à choix (8 codés, plus que les 5 prévus)
- [x] Récap hebdomadaire
- [x] Conditions de game over

**Déjà entamé sur la Phase 2 :** jauges de stock + fournisseur, notoriété,
escalade de difficulté, victoire spéciale (rachat).

**À venir :** forces/faiblesses aléatoires, propreté gérable, machines & pannes,
le Store, le roster complet, plus d'événements, pixel art & son.
