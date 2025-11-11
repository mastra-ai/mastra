import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.performance.test.ts', 'src/**/performance-indexes/*.test.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
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
    },
  },
});
