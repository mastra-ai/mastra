import { config } from "dotenv";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from .env file if it exists
// This will not override existing environment variables
config({ path: join(__dirname, ".env") });

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Don't override env vars - just let them pass through from the system
    // The env object here will be merged with process.env
    env: {
      OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    },
    include: ["tests/**/*.test.ts"],
    hookTimeout: 30000,
    testTimeout: 30000,
    typecheck: {
      enabled: true,
      include: ["tests/**/*.test.ts"],
    },
  },
});
