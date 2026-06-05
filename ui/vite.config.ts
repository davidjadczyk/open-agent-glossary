import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The control server serves the built assets at "/" same-origin in production,
// so no base path or proxy is needed there. In dev, proxy /api to the server.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:7337",
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
