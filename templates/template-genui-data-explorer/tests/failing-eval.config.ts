import { defineConfig } from "vitest/config";
import config from "./vitest.config.ts";
export default defineConfig({
  ...config,
  test: {
    ...config.test,
    include: ["tests/fixtures/failing-eval.test.ts"],
    exclude: [],
    testTimeout: 360000,
  },
});
