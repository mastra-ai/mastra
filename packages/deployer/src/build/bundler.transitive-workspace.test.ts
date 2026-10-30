import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import { rollup } from 'rollup';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeBundle } from './analyze';
import { getInputOptions } from './bundler';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = join(packageRoot, '.tmp');
const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
});

/**
 * pnpm workspace from #27134: versionless `@inner/leaf` and `@inner/dependent` export their TypeScript source,
 * dependent imports leaf, and the app depends on both but only imports dependent.
 */
async function createTransitiveOnlyWorkspace() {
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(join(tempRoot, 'transitive-only-workspace-'));
  tempDirs.push(tempDir);

  const appDir = join(tempDir, 'apps', 'app');
  const leafDir = join(tempDir, 'packages', 'leaf');
  const dependentDir = join(tempDir, 'packages', 'dependent');
  const entryFile = join(appDir, 'src', 'index.ts');

  await mkdir(join(appDir, 'src'), { recursive: true });
  await mkdir(join(appDir, 'node_modules', '@inner'), { recursive: true });
  await mkdir(join(appDir, '.mastra', '.build'), { recursive: true });
  await mkdir(join(leafDir, 'src'), { recursive: true });
  await mkdir(join(dependentDir, 'src'), { recursive: true });
  await mkdir(join(dependentDir, 'node_modules', '@inner'), { recursive: true });

  await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'workspace', private: true }));
  await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
  await writeFile(
    join(appDir, 'package.json'),
    JSON.stringify({
      name: 'app',
      version: '1.0.0',
      type: 'module',
      dependencies: { '@inner/dependent': 'workspace:*', '@inner/leaf': 'workspace:*' },
    }),
  );
  await writeFile(
    join(leafDir, 'package.json'),
    JSON.stringify({ name: '@inner/leaf', private: true, type: 'module', exports: './src/index.ts' }),
  );
  await writeFile(
    join(dependentDir, 'package.json'),
    JSON.stringify({
      name: '@inner/dependent',
      private: true,
      type: 'module',
      exports: './src/index.ts',
      dependencies: { '@inner/leaf': 'workspace:*' },
    }),
  );

  await writeFile(join(leafDir, 'src', 'index.ts'), `export const leaf = (): string => 'leaf';\n`);
  await writeFile(
    join(dependentDir, 'src', 'index.ts'),
    `import { leaf } from '@inner/leaf';\nexport const dependent = (): string => 'dependent:' + leaf();\n`,
  );
  await writeFile(entryFile, `import { dependent } from '@inner/dependent';\nexport const value = dependent();\n`);

  await symlink(leafDir, join(appDir, 'node_modules', '@inner', 'leaf'));
  await symlink(dependentDir, join(appDir, 'node_modules', '@inner', 'dependent'));
  await symlink(leafDir, join(dependentDir, 'node_modules', '@inner', 'leaf'));

  return { tempDir, appDir, leafDir, entryFile };
}

describe('bundling a transitive-only workspace package (#27134)', () => {
  it('builds with externals: true and the output runs code from the transitive package', async () => {
    const { tempDir, appDir, leafDir, entryFile } = await createTransitiveOnlyWorkspace();

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const analyzed = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir: join(appDir, '.mastra', '.build'),
          projectRoot: appDir,
          platform: 'node',
          bundlerOptions: { externals: true, enableSourcemap: false },
        },
        noopLogger,
      );

      const inputOptions = await getInputOptions(entryFile, analyzed, 'node', undefined, {
        projectRoot: appDir,
        workspaceRoot: tempDir,
        externalsPreset: true,
      });
      const bundle = await rollup({ ...inputOptions, input: entryFile });
      const { output } = await bundle.generate({ format: 'esm' });
      await bundle.close();

      const outputFile = join(appDir, '.mastra', 'output', 'index.mjs');
      await mkdir(dirname(outputFile), { recursive: true });
      await writeFile(outputFile, output[0].code);

      const mod = await import(pathToFileURL(outputFile).href);
      expect(mod.value).toBe('dependent:leaf');

      // leaf is compiled into its own package cache, like every other workspace package
      expect(join(tempDir, analyzed.dependencies.get('@inner/leaf')!)).toBe(
        join(leafDir, 'node_modules', '.cache', '@inner__leaf.mjs'),
      );
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);
});
