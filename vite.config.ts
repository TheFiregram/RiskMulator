import { defineConfig } from "vite";
import path from "node:path";

const isTauriDev = !!process.env.TAURI_DEV_HOST;

export default defineConfig({
  root: ".",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Tauri expects a fixed port and will fail if it is already in use.
  server: {
    port: 1420,
    strictPort: true,
    host: isTauriDev ? "0.0.0.0" : false,
    watch: {
      // Don't watch the Rust backend, Tauri's own dev server handles that.
      ignored: ["**/src-tauri/**"],
    },
  },
  envPrefix: ["VITE_", "TAURI_"],
  build: {
    // Tauri supports es2021.
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    outDir: "dist",
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ["three"],
        },
      },
    },
  },
});
