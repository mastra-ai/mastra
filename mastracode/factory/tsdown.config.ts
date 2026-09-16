import { readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { generateTypes } from '@internal/types-builder';
import { defineConfig } from 'tsdown';

import { createFilesystemResolver, rewriteRelativeSpecifiers } from './scripts/rewrite-specifiers.mjs';

const rewriteRelativeSpecifiersPlugin = {
  name: 'rewrite-relative-specifiers',
  transform(_code: string, id: string) {
    if (!id.endsWith('.ts')) {
      return null;
    }

    const contents = readFileSync(id, 'utf8');
    const resolveSuffix = createFilesystemResolver(dirname(id));
    const rewritten = rewriteRelativeSpecifiers(contents, resolveSuffix);

    return rewritten === contents ? null : { code: rewritten, map: null };
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
  fixedExtension: false,
  nodeProtocol: 'strip',
  bundle: false,
  clean: true,
  dts: false,
  sourcemap: true,
  deps: {
    alwaysBundle: ['@mastra/libsql', '@internal/workspace'],
    neverBundle: [/^@mastra\//, '@octokit/auth-app', '@octokit/rest', 'chat', 'hono', /^hono\//, 'zod'],
  },
  inputOptions: {
    plugins: [rewriteRelativeSpecifiersPlugin],
  },
  onSuccess: async () => {
    await generateTypes(process.cwd());
  },
});
