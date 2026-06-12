import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import virtual from '@rollup/plugin-virtual';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeBundle } from './analyze';
import { getSafeBundlerExternals } from './analyze/constants';
import { createBundler, getInputOptions } from './bundler';
import { isDependencyPartOfPackage, slash } from './utils';

const tempDirs: string[] = [];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = join(packageRoot, '.tmp');

async function readGeneratedModules(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const modules = await Promise.all(
    entries.map(async entry => {
      const entryPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return readGeneratedModules(entryPath);
      }
      if (!entry.name.endsWith('.mjs')) {
        return [];
      }
      return [await readFile(entryPath, 'utf-8')];
    }),
  );

  return modules.flat();
}

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

describe('safe runtime externals', () => {
  it('preserves user externals while keeping Mastra runtime packages externalized', () => {
    expect(getSafeBundlerExternals(['pg', '@mastra/core'])).toEqual(
      expect.arrayContaining(['pg', '@mastra/core', '@mastra/memory']),
    );

    const merged = getSafeBundlerExternals(['pg', '@mastra/core']);
    expect(merged.filter(external => external === 'pg')).toHaveLength(1);
    expect(merged.filter(external => external === '@mastra/core')).toHaveLength(1);
    expect(merged.some(external => isDependencyPartOfPackage('@mastra/core/storage', external))).toBe(true);
  });

  it('keeps @mastra/core external with custom externals and top-level dynamic imports', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-safe-externals-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      entryFile,
      `
        import { Mastra } from '@mastra/core/mastra';

        export const storageModule = await import('@mastra/core/storage');
        export const mastra = new Mastra({});
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
          externals: ['pg'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    expect(result.externalDependencies.has('@mastra/core')).toBe(true);
    expect(result.externalDependencies.has('pg')).toBe(false);

    const generatedModules = await readGeneratedModules(outputDir);
    expect(generatedModules.join('\n')).not.toMatch(/import\(['"]\.\/(?:index|mastra)\.mjs['"]\)/);
  }, 15000);

  it('does not rewrite internal Mastra dynamic imports to self-imports in final output', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-no-self-imports-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'mastra.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    const bundleDir = join(tempDir, '.mastra', 'output');
    await mkdir(outputDir, { recursive: true });
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      entryFile,
      `
        import { Mastra } from '@mastra/core/mastra';

        export const mastra = new Mastra({});
      `,
    );

    const analyzedBundleInfo = await analyzeBundle(
      [
        `
          import { mastra } from '#mastra';

          export { mastra };
          export const storageModule = await import('@mastra/core/storage');
        `,
      ],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: {
          externals: ['pg'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    const inputOptions = await getInputOptions(
      entryFile,
      analyzedBundleInfo,
      'node',
      { 'process.env.NODE_ENV': JSON.stringify('production') },
      {
        projectRoot: tempDir,
        enableEsmShim: true,
        externalsPreset: false,
      },
    );

    inputOptions.input = { index: '#entry' };
    inputOptions.plugins = [
      virtual({
        '#entry': `
          import { mastra } from '#mastra';

          export { mastra };
          export const storageModule = await import('@mastra/core/storage');
        `,
      }),
      ...(Array.isArray(inputOptions.plugins) ? inputOptions.plugins : []),
    ];

    const bundler = await createBundler(inputOptions, {
      dir: bundleDir,
      manualChunks: {
        mastra: ['#mastra'],
      },
    });

    await bundler.write();
    await bundler.close();

    const generatedModules = await readGeneratedModules(bundleDir);
    const generatedOutput = generatedModules.join('\n');
    expect(generatedOutput).toContain("import('@mastra/core/storage')");
    expect(generatedOutput).not.toMatch(/import\(['"]\.\/(?:index|mastra)\.mjs['"]\)/);
  }, 15000);

  it('preserves Mastra subpath dynamic imports inside the TLA mastra chunk', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-subpath-tla-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'mastra.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    const bundleDir = join(tempDir, '.mastra', 'output');
    await mkdir(outputDir, { recursive: true });
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      entryFile,
      `
        import { Mastra } from '@mastra/core/mastra';

        export const storageModule = await import('@mastra/core/storage');
        export const mastra = new Mastra({});
      `,
    );

    const serverEntry = `
      import { mastra } from '#mastra';

      export { mastra };
    `;

    const analyzedBundleInfo = await analyzeBundle(
      [serverEntry],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: {
          externals: ['pg'],
          enableSourcemap: false,
        },
      },
      noopLogger,
    );

    const inputOptions = await getInputOptions(
      entryFile,
      analyzedBundleInfo,
      'node',
      { 'process.env.NODE_ENV': JSON.stringify('production') },
      {
        projectRoot: tempDir,
        enableEsmShim: true,
        externalsPreset: false,
      },
    );

    inputOptions.input = { index: '#entry' };
    inputOptions.plugins = [
      virtual({
        '#entry': serverEntry,
      }),
      ...(Array.isArray(inputOptions.plugins) ? inputOptions.plugins : []),
    ];

    const bundler = await createBundler(inputOptions, {
      dir: bundleDir,
      manualChunks: {
        mastra: ['#mastra'],
      },
    });

    const { output } = await bundler.write();
    await bundler.close();

    const generatedModules = await readGeneratedModules(bundleDir);
    const generatedOutput = generatedModules.join('\n');
    expect(generatedOutput).toContain("import('@mastra/core/storage')");
    expect(generatedOutput).not.toMatch(/import\(['"]\.\/[^'"]+\.mjs['"]\)/);

    const mastraChunk = output.find(chunk => chunk.type === 'chunk' && chunk.fileName === 'mastra.mjs');
    expect(mastraChunk).toBeDefined();
    expect(mastraChunk?.type === 'chunk' ? mastraChunk.imports : []).not.toContain('index.mjs');
  }, 15000);
});
