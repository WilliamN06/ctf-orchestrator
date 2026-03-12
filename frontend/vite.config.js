import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to local wrangler dev server
      "/api":    "http://localhost:8787",
      "/ws":     { target: "ws://localhost:8787", ws: true },
      "/agents": { target: "ws://localhost:8787", ws: true },
    },
  },
});
