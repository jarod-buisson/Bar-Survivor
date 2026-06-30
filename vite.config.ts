import { defineConfig } from "vite";

// base: "./" => chemins relatifs dans le build final.
// Indispensable pour que le jeu fonctionne une fois emballé en app
// native avec Capacitor (les fichiers sont chargés en local, pas via un serveur).
export default defineConfig({
  base: "./",
  server: {
    host: true,
  },
});
