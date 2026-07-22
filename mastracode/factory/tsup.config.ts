import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

/**
 * Transpile-only build that preserves the src/ module structure in dist/ so
 * the package.json wildcard export (`"./*"`) resolves every module, matching
 * the @mastra/code-sdk build setup.
 */
export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/test-utils.ts', '!src/**/__tests__/**'],
  format: ['esm'],
  clean: true,
  dts: false,
  splitting: false,
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
