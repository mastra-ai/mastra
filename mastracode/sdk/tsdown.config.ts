import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

const require = createRequire(import.meta.url);

/**
 * Exact versions of the packages installed on first use (`src/features/catalog.ts`). Pinned at build time
 * so a published SDK always installs the versions it was built and tested with.
 */
const FEATURE_PACKAGES = ['@mastra/fastembed'];
const featurePins = Object.fromEntries(
  FEATURE_PACKAGES.map(name => [
    name,
    JSON.parse(readFileSync(require.resolve(`${name}/package.json`), 'utf8')).version,
  ]),
);

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
  unbundle: true,
  clean: true,
  dts: false,
  sourcemap: true,
  define: {
    __MASTRACODE_FEATURE_PINS__: JSON.stringify(featurePins),
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
