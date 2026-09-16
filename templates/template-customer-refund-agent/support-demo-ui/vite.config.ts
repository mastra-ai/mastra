import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const requestedApiPort = process.env.E2E_API_PORT ?? "4111";
const supportApiPort = Number(requestedApiPort);
if (
  !Number.isInteger(supportApiPort) ||
  supportApiPort < 1 ||
  supportApiPort > 65_535
)
  throw new Error("E2E_API_PORT must be an integer from 1 through 65535.");

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  server: {
    // The local Mastra API stays loopback-only; E2E can select an isolated
    // port while ordinary development retains :4111. Proxying avoids CORS.
    proxy: {
      "/support": `http://127.0.0.1:${supportApiPort}`,
    },
  },
});
