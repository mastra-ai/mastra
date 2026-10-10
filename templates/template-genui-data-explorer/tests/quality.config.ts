import { defineConfig } from "vitest/config";
import config from "./vitest.config.ts";
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["tests/integration/quality.test.ts", "tests/integration/packaging.test.ts"],
    exclude: ["tests/fixtures/failing-eval.test.ts"],
    testTimeout: 360000,
  },
});
