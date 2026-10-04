import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { MastraEvalsReporter } from "@mastra/evals/vitest";

export default defineConfig({
  root: fileURLToPath(new URL("..", import.meta.url)),
  cacheDir: "node_modules/.vite",
  test: {
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    reporters: ["default", new MastraEvalsReporter()],
    testTimeout: 20000,
  },
});
