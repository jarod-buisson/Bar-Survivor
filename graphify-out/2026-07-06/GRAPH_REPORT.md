# Graph Report - Bar Survivor  (2026-07-06)

## Corpus Check
- 24 files · ~41,068 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 328 nodes · 786 edges · 22 communities (13 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `6af0725b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_UI & ecrans (rendu)|UI & ecrans (rendu)]]
- [[_COMMUNITY_Config TypeScript (tsconfig)|Config TypeScript (tsconfig)]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Manifeste npm (package.json)|Manifeste npm (package.json)]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Outillage graphify|Outillage graphify]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]

## God Nodes (most connected - your core abstractions)
1. `simulerSemaine()` - 24 edges
2. `eur()` - 24 edges
3. `runHabile()` - 20 edges
4. `ecranMenu()` - 15 edges
5. `compilerOptions` - 15 edges
6. `GameState` - 14 edges
7. `Bar Survival — décisions de conception` - 14 edges
8. `actifs()` - 12 edges
9. `capaciteLocale()` - 12 edges
10. `rendreBrut()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `#phone (simulation écran mobile)` --conceptually_related_to--> `🍺 Bar Survival`  [INFERRED]
  index.html → README.md
- `equipeCibleLocal()` --calls--> `capaciteLocale()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts
- `resoudreUnPopup()` --calls--> `appliquerChoix()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts
- `run()` --calls--> `creerPartie()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts
- `run()` --calls--> `simulerSemaine()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Même code: web (TS+Vite) vers mobile (Capacitor)** — readme_bar_survival, readme_typescript_vite, readme_capacitor [EXTRACTED 0.85]
- **Boucle de jeu hebdomadaire** — readme_economie_engine, readme_evenements, readme_recap_hebdo, readme_game_over [INFERRED 0.75]

## Communities (22 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.11
Nodes (35): actifsN(), choisirChoixBot(), coutSemaineFermee(), equipeCibleLocal(), evenementsDeLaSemaine, fixerGraine(), gererSemaineCourante(), graineCourante() (+27 more)

### Community 1 - "UI & ecrans (rendu)"
Cohesion: 0.29
Nodes (7): #app (point de montage), #phone (simulation écran mobile), 🍺 Bar Survival, Lancer le jeu (développement), Structure du projet, Techno, État d'avancement (selon le GDD)

### Community 2 - "Config TypeScript (tsconfig)"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.11
Nodes (30): EMPRUNT_MAX, joursOuverture(), Employee, GameState, rendreBrut(), ecranAccueil(), ecranAlerte(), bandeauBas() (+22 more)

### Community 4 - "Manifeste npm (package.json)"
Cohesion: 0.13
Nodes (14): allowScripts, esbuild@0.25.12, description, devDependencies, typescript, vite, name, private (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (41): aucunRepos(), CATEGORIES_STOCK, CategorieStock, CV_PROFILS, equipeA(), equipeDeDepart(), EVENEMENTS, genererCV() (+33 more)

### Community 6 - "Outillage graphify"
Cohesion: 0.12
Nodes (15): Bar Survival — décisions de conception, Cadrage de la partie, graphify, Machines, Modèle économique (bottom-up), Notoriété = moteur d'affluence, Objectif & fin de partie, Pistes non encore faites (backlog) (+7 more)

### Community 8 - "Community 8"
Cohesion: 0.18
Nodes (25): aIngenieur(), coutAutoStock(), coutLicenciement(), coutMenagePro(), tauxDette(), bonusRendementPct(), coutReparation(), badgesTraits() (+17 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (13): aidesPourChoix(), bonusChanceux(), probaAvecAide(), trait(), Effect, badgeTrait(), boutonChoix(), ecranEvenement() (+5 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (56): genererCandidats(), salarieVacancesMenace(), salarieVacancesProces(), stocksPleins(), actifs(), AFFLUENCE_JOUR, AMBLAM, appliquerChoix() (+48 more)

### Community 11 - "Community 11"
Cohesion: 0.50
Nodes (3): afficher(), boite(), initTooltips()

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (19): acheterAutoStock(), coutCommandeBrut(), definirEmprunt(), definirNomBar(), embaucher(), investirLivret(), licencier(), refuserCandidat() (+11 more)

## Knowledge Gaps
- **93 isolated node(s):** `name`, `private`, `version`, `type`, `description` (+88 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `#app (point de montage)` connect `UI & ecrans (rendu)` to `Community 12`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Why does `eur()` connect `Community 8` to `Community 3`, `Community 12`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _93 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11411411411411411 - nodes in this community are weakly interconnected._
- **Should `Config TypeScript (tsconfig)` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.11219512195121951 - nodes in this community are weakly interconnected._
- **Should `Manifeste npm (package.json)` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._