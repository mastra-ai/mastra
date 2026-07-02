import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeBundle } from './analyze';
import { slash } from './utils';

const tempDirs: string[] = [];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = join(packageRoot, '.tmp');

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map(dir =>
      rm(dir, {
        recursive: true,
        force: true,
      }),
    ),
  );
});

describe('workspace path normalization (issue #13022)', () => {
  it('should normalize backslashes so startsWith matches rollup imports', () => {
    const rollupImport = 'apps/@agents/devstudio/.mastra/.build/chunk-ILQXPZCD.mjs';
    const windowsPath = 'apps\\@agents\\devstudio';

    expect(rollupImport.startsWith(windowsPath)).toBe(false);
    expect(rollupImport.startsWith(slash(windowsPath))).toBe(true);
  });
});

describe('protocol imports', () => {
  it('should exclude protocol imports from externalDependencies', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-protocol-imports-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      entryFile,
      `
        import { env } from 'cloudflare:workers';
        import { Mastra } from '@mastra/core/mastra';

        export const binding = env.TEST_BINDING;
        export const mastra = new Mastra({});
      `,
    );

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'browser',
        bundlerOptions: {
          externals: [],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    expect(result.externalDependencies.has('cloudflare:workers')).toBe(false);
  }, 15000);
});

describe('npm alias dependencies', () => {
  it('preserves alias install specs in external dependency metadata', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-npm-alias-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    const aliasPackageDir = join(tempDir, 'node_modules', '@ai-sdk', 'provider-utils-v7');
    await mkdir(outputDir, { recursive: true });
    await mkdir(aliasPackageDir, { recursive: true });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'alias-test-project',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          '@ai-sdk/provider-utils-v7': 'npm:@ai-sdk/provider-utils@5.0.0',
        },
      }),
    );
    await writeFile(
      join(aliasPackageDir, 'package.json'),
      JSON.stringify({ name: '@ai-sdk/provider-utils', version: '5.0.0', type: 'module', main: './index.js' }),
    );
    await writeFile(join(aliasPackageDir, 'index.js'), `export const aliasValue = 'alias';`);
    await writeFile(
      entryFile,
      `
        import { aliasValue } from '@ai-sdk/provider-utils-v7';

        export const value = aliasValue;
      `,
    );

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: {
          externals: ['@ai-sdk/provider-utils-v7'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    expect(result.externalDependencies.get('@ai-sdk/provider-utils-v7')).toEqual({
      version: '5.0.0',
      packageSpec: 'npm:@ai-sdk/provider-utils@5.0.0',
    });
  }, 15000);

  it('resolves alias install specs for dynamic external dependency fallbacks', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-npm-alias-dynamic-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    const aliasPackageDir = join(tempDir, 'node_modules', '@ai-sdk', 'provider-utils-v5');
    await mkdir(outputDir, { recursive: true });
    await mkdir(aliasPackageDir, { recursive: true });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'alias-dynamic-test-project',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          '@ai-sdk/provider-utils-v5': 'npm:@ai-sdk/provider-utils@3.0.25',
        },
      }),
    );
    await writeFile(
      join(aliasPackageDir, 'package.json'),
      JSON.stringify({ name: '@ai-sdk/provider-utils', version: '3.0.25', type: 'module', main: './index.js' }),
    );
    await writeFile(join(aliasPackageDir, 'index.js'), `export const aliasValue = 'alias';`);
    await writeFile(entryFile, `export const value = 'entry';`);

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: {
          externals: [],
          dynamicPackages: ['@ai-sdk/provider-utils-v5'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    expect(result.externalDependencies.get('@ai-sdk/provider-utils-v5')).toEqual({
      version: '3.0.25',
      packageSpec: 'npm:@ai-sdk/provider-utils@3.0.25',
    });
  }, 15000);
});
