import fs from 'node:fs/promises';
import path from 'node:path';
import { generateTypes } from '@internal/types-builder';
import { globby } from 'globby';
import { defineConfig } from 'tsup';

/**
 * Rewrite `@/` path aliases in generated .d.ts files to relative imports.
 * TypeScript's tsc does not resolve path aliases in emitted declarations,
 * so we do it as a post-processing step.
 */
async function rewritePathAliases(rootDir: string) {
  const distDir = path.join(rootDir, 'dist');
  const dtsFiles = await globby('**/*.d.ts', { cwd: distDir, onlyFiles: true });

  for (const file of dtsFiles) {
    const fullPath = path.join(distDir, file);
    const content = await fs.readFile(fullPath, 'utf-8');

    if (!content.includes('@/')) continue;

    const fileDir = path.dirname(fullPath);
    const rewritten = content.replace(/(from\s+['"])@\/([^'"]+)(['"])/g, (_, prefix, importPath, suffix) => {
      // Resolve the absolute target: @/ maps to dist/ (since rootDir in tsconfig.build.json is src/)
      const target = path.join(distDir, importPath);
      let relative = path.relative(fileDir, target);
      if (!relative.startsWith('.')) {
        relative = './' + relative;
      }
      return `${prefix}${relative}${suffix}`;
    });

    if (rewritten !== content) {
      await fs.writeFile(fullPath, rewritten);
    }
  }
}

export default defineConfig(options => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // Skip clean in watch so consumers don't see a missing dist mid-rebuild.
  clean: !options.watch,
  dts: false,
  splitting: true,
  treeshake: {
    preset: 'smallest',
  },
  sourcemap: true,
  external: [/^@mastra\/core/],
  onSuccess: async () => {
    await generateTypes(process.cwd());
    await rewritePathAliases(process.cwd());
  },
}));
