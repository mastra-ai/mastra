import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

/**
 * Transpile-only build that preserves the src/ module structure in dist/ so
 * the package.json wildcard export (`"./*"`) resolves every module. The
 * published `mastracode` package and the standalone mastracode-web project
 * both consume this as a regular dependency (`workspace:^` / `link:../sdk`).
 *
 * No `MASTRACODE_VERSION` define here: `utils/update-check.ts` guards the
 * global with `typeof` and the published tui build injects it.
 */
export default defineConfig({
  entry: ['src/**/*.ts', '!src/**/*.test.ts', '!src/**/__tests__/**'],
  format: ['esm'],
  fixedExtension: false,
  nodeProtocol: 'strip',
  bundle: false,
  clean: true,
  dts: false,
  sourcemap: true,
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
