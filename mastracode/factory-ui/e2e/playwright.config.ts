import { defineConfig } from '@playwright/test';
import path from 'node:path';

const output = process.env.KNOWLEDGE_PROOF_OUTPUT
  ? path.resolve(process.env.KNOWLEDGE_PROOF_OUTPUT)
  : path.resolve('test-results/knowledge');

export default defineConfig({
  testDir: '.',
  outputDir: path.join(output, 'artifacts'),
  globalTeardown: './knowledge/proof-teardown.ts',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4178',
    trace: 'on',
    video: 'on',
    screenshot: 'only-on-failure',
  },
  reporter: [['line'], ['./knowledge/proof-reporter.ts', { output }]],
  webServer: {
    command: 'pnpm dev --host 127.0.0.1 --port 4178',
    url: 'http://127.0.0.1:4178',
    reuseExistingServer: !process.env.KNOWLEDGE_PROOF_OUTPUT,
    timeout: 120_000,
  },
});
