# Graph Report - Bar Survivor  (2026-07-07)

## Corpus Check
- 24 files · ~44,980 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 354 nodes · 854 edges · 26 communities (17 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7513ead7`
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
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]

## God Nodes (most connected - your core abstractions)
1. `simulerSemaine()` - 29 edges
2. `eur()` - 24 edges
3. `runHabile()` - 20 edges
4. `ecranMenu()` - 15 edges
5. `compilerOptions` - 15 edges
6. `Bar Survival — décisions de conception` - 15 edges
7. `GameState` - 14 edges
8. `actifs()` - 13 edges
9. `rendreBrut()` - 12 edges
10. `entete()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `#phone (simulation écran mobile)` --conceptually_related_to--> `🍺 Bar Survival`  [INFERRED]
  index.html → README.md
- `resoudreUnPopup()` --calls--> `appliquerChoix()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts
- `gererSemaineCourante()` --calls--> `coutCommande()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts
- `gererSemaineCourante()` --calls--> `menageEquipe()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts
- `run()` --calls--> `creerPartie()`  [EXTRACTED]
  sim/simulation.ts → src/game/engine.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Même code: web (TS+Vite) vers mobile (Capacitor)** — readme_bar_survival, readme_typescript_vite, readme_capacitor [EXTRACTED 0.85]
- **Boucle de jeu hebdomadaire** — readme_economie_engine, readme_evenements, readme_recap_hebdo, readme_game_over [INFERRED 0.75]

## Communities (26 total, 9 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.12
Nodes (33): actifsN(), choisirChoixBot(), coutSemaineFermee(), equipeCibleLocal(), evenementsDeLaSemaine, fixerGraine(), gererSemaineCourante(), graineCourante() (+25 more)

### Community 1 - "UI & ecrans (rendu)"
Cohesion: 0.29
Nodes (7): #app (point de montage), #phone (simulation écran mobile), 🍺 Bar Survival, Lancer le jeu (développement), Structure du projet, Techno, État d'avancement (selon le GDD)

### Community 2 - "Config TypeScript (tsconfig)"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+8 more)

### Community 3 - "Community 3"
Cohesion: 0.09
Nodes (37): CATEGORIES_STOCK, moisAbrege(), EMPRUNT_MAX, joursOuverture(), statutNotif(), trait(), Employee, GameState (+29 more)

### Community 4 - "Manifeste npm (package.json)"
Cohesion: 0.13
Nodes (14): allowScripts, esbuild@0.25.12, description, devDependencies, typescript, vite, name, private (+6 more)

### Community 5 - "Community 5"
Cohesion: 0.12
Nodes (13): CV_PROFILS, equipeA(), EVENEMENTS, ModeleCandidat, MOIS_ABBR, MOIS_INFOS, ProfilCV, ROSTER (+5 more)

### Community 6 - "Outillage graphify"
Cohesion: 0.12
Nodes (16): Bar Survival — décisions de conception, Cadrage de la partie, graphify, Machines, Modèle économique (bottom-up), Notoriété = moteur d'affluence, Objectif & fin de partie, Pistes non encore faites (backlog) (+8 more)

### Community 8 - "Community 8"
Cohesion: 0.14
Nodes (30): moisIndex(), aIngenieur(), coutAutoStock(), coutLicenciement(), coutMenagePro(), prixDe(), tauxDette(), bonusPanierPct() (+22 more)

### Community 9 - "Community 9"
Cohesion: 0.17
Nodes (17): TACOS_CRUDITES, TACOS_SAUCE_FROMAGERE, TACOS_SAUCES, TACOS_VIANDES, aidesPourChoix(), bonusChanceux(), probaAvecAide(), Choice (+9 more)

### Community 10 - "Community 10"
Cohesion: 0.06
Nodes (58): moisDeSemaine(), actifs(), AFFLUENCE_JOUR, aFonction(), AMBLAM, appliquerChoix(), appliquerEffet(), borne() (+50 more)

### Community 11 - "Community 11"
Cohesion: 0.15
Nodes (12): CV, Difficulty, GameEvent, JourCA, OfferType, Phase, Pret, SalaireLigne (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.09
Nodes (20): acheterAutoStock(), coutCommande(), coutCommandeBrut(), definirEmprunt(), definirNomBar(), embaucher(), investirLivret(), licencier() (+12 more)

### Community 13 - "Community 13"
Cohesion: 0.20
Nodes (9): bonusPassif(), FAIBLESSES, FORCES, INCOMPATIBLES, PAR_ID, POIDS_RARETE, CibleEffet, Rarete (+1 more)

### Community 23 - "Community 23"
Cohesion: 0.25
Nodes (9): aucunRepos(), equipeDeDepart(), genererCV(), profilVersEmploye(), rand(), salairePourCompetence(), arriveeCV(), piocherPondere() (+1 more)

### Community 24 - "Community 24"
Cohesion: 0.50
Nodes (4): CategorieStock, MoisInfo, NiveauPrix, StockCategorie

### Community 25 - "Community 25"
Cohesion: 0.50
Nodes (4): genererCandidats(), stocksPleins(), creerPartie(), machinesDeDepart()

## Knowledge Gaps
- **98 isolated node(s):** `name`, `private`, `version`, `type`, `description` (+93 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `#app (point de montage)` connect `UI & ecrans (rendu)` to `Community 12`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Why does `simulerSemaine()` connect `Community 10` to `Community 0`, `Community 3`, `Community 5`, `Community 8`, `Community 12`, `Community 13`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _98 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Config TypeScript (tsconfig)` be split into smaller, more focused modules?**
  _Cohesion score 0.11764705882352941 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.0858843537414966 - nodes in this community are weakly interconnected._
- **Should `Manifeste npm (package.json)` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._