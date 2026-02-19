import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    // viteSingleFile inlines all JS/CSS directly into index.html,
    // producing a single self-contained HTML file for embedding.
    assetsDir: "assets",
  },
});
