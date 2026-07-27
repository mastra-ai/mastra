import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsup';

import { createFilesystemResolver, rewriteRelativeSpecifiers } from './scripts/rewrite-specifiers.mjs';

/**
 * Esbuild plugin that rewrites extensionless relative specifiers (e.g.
 * `./factory`) to their emitted Node ESM paths (e.g. `./factory.js`) while
 * files are transpiled. Required because `bundle: false` transpiles each file
 * independently without rewriting TypeScript import specifiers.
 *
 * Leaves package imports, explicit `.js`/`.json` specifiers, and URL/protocol
 * imports untouched.
 */
const rewriteRelativeSpecifiersPlugin = {
  name: 'rewrite-relative-specifiers',
  setup(build: any) {
    build.onLoad({ filter: /\.ts$/ }, (args: { path: string }) => {
      const contents = readFileSync(args.path, 'utf8');
      const resolveSuffix = createFilesystemResolver(dirname(args.path));
      const rewritten = rewriteRelativeSpecifiers(contents, resolveSuffix);
      return { contents: rewritten, loader: 'ts' as const };
    });
  },
};

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
  esbuildPlugins: [rewriteRelativeSpecifiersPlugin],
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
