import { MastraEvalsReporter } from '@mastra/evals/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/live/**/*.live.ts'],
    reporters: ['default', new MastraEvalsReporter()],
    setupFiles: ['@mastra/evals/vitest/setup'],
    fileParallelism: false,
    bail: 1,
    maxWorkers: 1,
    testTimeout: 2700000,
    hookTimeout: 2700000,
  },
});
