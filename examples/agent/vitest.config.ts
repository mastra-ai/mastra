import { existsSync } from 'node:fs';
import { MastraEvalsReporter } from '@mastra/evals/vitest';
import { defineConfig } from 'vitest/config';

// Load OPENAI_API_KEY & co from the example's .env for eval tests.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    reporters: ['default', new MastraEvalsReporter()],
    setupFiles: ['@mastra/evals/vitest/setup'],
  },
});
