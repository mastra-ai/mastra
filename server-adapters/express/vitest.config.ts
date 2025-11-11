import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { createRequire } from 'node:module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const requireFromExpress = createRequire(resolve(__dirname, 'package.json'));
const superagentPath = requireFromExpress.resolve('superagent/lib/node/index.js');

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts', 'src/**/performance-indexes/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
    setupFiles: ['src/__tests__/setup.cjs'],
  },
  resolve: {
    alias: {
      '@mastra/core/utils/zod-to-json': resolve(__dirname, '../../packages/core/src/zod-to-json.ts'),
      '@mastra/core': resolve(__dirname, '../../packages/core/src'),
      '@mastra/server': resolve(__dirname, '../../packages/server/src/server'),
      '@mastra/schema-compat': resolve(__dirname, '../../packages/schema-compat/src'),
      '@mastra/agent-builder': resolve(__dirname, '../../packages/agent-builder/src'),
      '@mastra/memory': resolve(__dirname, '../../packages/memory/src'),
      '@internal/ai-sdk-v4': resolve(__dirname, '../../packages/_ai-sdk-v4/src'),
      '@paralleldrive/cuid2': resolve(__dirname, './src/__tests__/cuid2-stub.cjs'),
      formidable: resolve(__dirname, './src/__tests__/formidable-stub.cjs'),
      superagent: superagentPath,
      'superagent/src/node/index.js': superagentPath,
    },
  },
});
