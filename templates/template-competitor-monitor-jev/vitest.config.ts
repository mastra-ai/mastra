import { MastraEvalsReporter } from '@mastra/evals/vitest';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    reporters: ['default', new MastraEvalsReporter()],
    setupFiles: ['@mastra/evals/vitest/setup'],
    passWithNoTests: false,
  },
});
