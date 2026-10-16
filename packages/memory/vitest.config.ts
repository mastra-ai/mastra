import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'unit:packages/memory',
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: process.env.PROMPT_RECORD_DIR ? ['../core/src/test-utils/prompt-recorder.setup.ts'] : [],
    typecheck: {
      enabled: true,
      include: ['type-tests/**/*.test-d.ts'],
    },
    isolate: false,
    // smaller output to save token space when LLMs run tests
    reporters: 'dot',
    bail: 1,
  },
});
