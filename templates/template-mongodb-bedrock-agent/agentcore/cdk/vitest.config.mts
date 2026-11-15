import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Match the require-only SDK entry used by the generated CommonJS CDK code.
    alias: {
      '@aws/agentcore-cdk': createRequire(import.meta.url).resolve('@aws/agentcore-cdk'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
