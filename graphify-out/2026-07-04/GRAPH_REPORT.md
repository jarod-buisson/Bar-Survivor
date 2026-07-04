# Graph Report - Bar Survivor  (2026-07-04)

## Corpus Check
- 24 files · ~28,974 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 282 nodes · 660 edges · 21 communities (12 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1127b50b`
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
1. `eur()` - 22 edges
2. `simulerSemaine()` - 20 edges
3. `compilerOptions` - 15 edges
4. `GameState` - 14 edges
5. `ecranMenu()` - 14 edges
6. `Bar Survival — décisions de conception` - 13 edges
7. `run()` - 12 edges
8. `rendreBrut()` - 12 edges
9. `actifs()` - 11 edges
10. `entete()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `#phone (simulation écran mobile)` --conceptually_related_to--> `🍺 Bar Survival`  [INFERRED]
  index.html → README.md
- `#app (point de montage)` --conceptually_related_to--> `🍺 Bar Survival`  [INFERRED]
  index.html → README.md
- `run()` --calls--> `commanderStocks()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts
- `run()` --calls--> `coutCommande()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts
- `run()` --calls--> `creerPartie()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Même code: web (TS+Vite) vers mobile (Capacitor)** — readme_bar_survival, readme_typescript_vite, readme_capacitor [EXTRACTED 0.85]
- **Boucle de jeu hebdomadaire** — readme_economie_engine, readme_evenements, readme_recap_hebdo, readme_game_over [INFERRED 0.75]

## Communities (21 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.18
Nodes (17): CATEGORIES_STOCK, EMPRUNT_MAX, trait(), Employee, ecranAccueil(), badgeTrait(), bandeauBas(), echap() (+9 more)

### Community 1 - "UI & ecrans (rendu)"
Cohesion: 0.29
Nodes (7): #app (point de montage), #phone (simulation écran mobile), 🍺 Bar Survival, Lancer le jeu (développement), Structure du projet, Techno, État d'avancement (selon le GDD)

### Community 2 - "Config TypeScript (tsconfig)"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.08
Nodes (35): declencherEvenement(), definirEmprunt(), definirNomBar(), embaucher(), joursOuverture(), licencier(), planifierEvenements(), refuserCandidat() (+27 more)

### Community 4 - "Manifeste npm (package.json)"
Cohesion: 0.13
Nodes (14): allowScripts, esbuild@0.25.12, description, devDependencies, typescript, vite, name, private (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.06
Nodes (39): aucunRepos(), CategorieStock, CV_PROFILS, equipeA(), equipeDeDepart(), EVENEMENTS, genererCV(), ModeleCandidat (+31 more)

### Community 6 - "Outillage graphify"
Cohesion: 0.13
Nodes (14): Bar Survival — décisions de conception, Cadrage de la partie, graphify, Machines, Modèle économique (bottom-up), Notoriété = moteur d'affluence, Objectif & fin de partie, Pistes non encore faites (backlog) (+6 more)

### Community 8 - "Community 8"
Cohesion: 0.15
Nodes (29): agrandirBar(), aIngenieur(), ameliorationsDebloquees(), ameliorerMachine(), capaciteBar(), capaciteLocale(), coutLicenciement(), coutMenagePro() (+21 more)

### Community 9 - "Community 9"
Cohesion: 0.33
Nodes (10): aidesPourChoix(), bonusChanceux(), probaAvecAide(), bandeauSalaries(), boutonChoix(), ecranEvenement(), JOURS_LONGS, resumeEffet() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.09
Nodes (46): actifsN(), moyenne(), run(), RunResult, genererCandidats(), stocksPleins(), actifs(), AFFLUENCE_JOUR (+38 more)

### Community 11 - "Community 11"
Cohesion: 0.20
Nodes (9): appliquerAmelioration(), BONUS_PAR_NIVEAU, COUT_REPARATION, facteurUsure(), POIDS_MACHINE, PRIX_AMELIORATION, rendementMachine(), USURE_PAR_MACHINE (+1 more)

## Knowledge Gaps
- **87 isolated node(s):** `name`, `private`, `version`, `type`, `description` (+82 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `#app (point de montage)` connect `UI & ecrans (rendu)` to `Community 3`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `eur()` connect `Community 8` to `Community 0`, `Community 3`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _87 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Config TypeScript (tsconfig)` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.08067375886524823 - nodes in this community are weakly interconnected._
- **Should `Manifeste npm (package.json)` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `Community 5` be split into smaller, more focused modules?**
  _Cohesion score 0.06464646464646465 - nodes in this community are weakly interconnected._