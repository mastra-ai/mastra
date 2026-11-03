import { access, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

describe('external dependency versions', () => {
  it('resolves an external dependency version from the bundled workspace importer', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-importer-version-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const workspacePackageDir = join(tempDir, 'packages', 'workspace-package');
    const externalPackageDir = join(workspacePackageDir, 'node_modules', 'external-only-from-workspace');
    const entryFile = join(appDir, 'index.ts');
    const outputDir = join(appDir, '.mastra', '.build');

    await mkdir(outputDir, { recursive: true });
    await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(externalPackageDir, { recursive: true });
    await mkdir(join(workspacePackageDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
    await writeFile(
      join(workspacePackageDir, 'package.json'),
      JSON.stringify({
        name: '@internal/workspace-package',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: {
          'external-only-from-workspace': '4.5.6',
        },
      }),
    );
    await writeFile(
      join(externalPackageDir, 'package.json'),
      JSON.stringify({ name: 'external-only-from-workspace', version: '4.5.6', type: 'module', main: './index.js' }),
    );
    await writeFile(
      join(externalPackageDir, 'index.js'),
      `throw new Error('external dependency loaded during validation');`,
    );
    await writeFile(
      join(workspacePackageDir, 'src', 'index.js'),
      `import { externalValue } from 'external-only-from-workspace';\nexport const workspaceValue = externalValue;`,
    );
    await symlink(workspacePackageDir, join(appDir, 'node_modules', '@internal', 'workspace-package'));
    await writeFile(
      entryFile,
      `import { workspaceValue } from '@internal/workspace-package';\nexport const value = workspaceValue;`,
    );

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const result = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: {
            externals: ['external-only-from-workspace'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.get('external-only-from-workspace')).toEqual({
        version: '4.5.6',
        packageSpec: undefined,
      });
    } finally {
      process.chdir(originalCwd);
    }
  }, 15000);

  it('resolves an external dependency version from a dynamic import in a bundled workspace package', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-dynamic-importer-version-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const workspacePackageDir = join(tempDir, 'packages', 'workspace-package');
    const externalPackageDir = join(workspacePackageDir, 'node_modules', 'typescript');
    const entryFile = join(appDir, 'index.ts');
    const outputDir = join(appDir, '.mastra', '.build');

    await mkdir(outputDir, { recursive: true });
    await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(externalPackageDir, { recursive: true });
    await mkdir(join(workspacePackageDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
    await writeFile(
      join(workspacePackageDir, 'package.json'),
      JSON.stringify({
        name: '@internal/workspace-package',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: {
          typescript: '5.9.3',
        },
      }),
    );
    await writeFile(
      join(externalPackageDir, 'package.json'),
      JSON.stringify({ name: 'typescript', version: '5.9.3', type: 'module', main: './index.js' }),
    );
    await writeFile(join(externalPackageDir, 'index.js'), `export const version = '5.9.3';`);
    await writeFile(
      join(workspacePackageDir, 'src', 'index.js'),
      `export async function loadTypescript() { return import('typescript'); }`,
    );
    await symlink(workspacePackageDir, join(appDir, 'node_modules', '@internal', 'workspace-package'));
    await writeFile(
      entryFile,
      `import { loadTypescript } from '@internal/workspace-package';\nexport const value = loadTypescript;`,
    );

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const result = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: {
            externals: ['typescript'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.get('typescript')).toEqual({
        version: '5.9.3',
        packageSpec: undefined,
      });
    } finally {
      process.chdir(originalCwd);
    }
  }, 15000);

  it('does not externalize transitive workspace dependencies in production builds', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-transitive-workspace-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const pkgADir = join(tempDir, 'packages', 'a');
    const pkgBDir = join(tempDir, 'packages', 'b');
    const pkgCDir = join(tempDir, 'packages', 'c');
    const entryFile = join(appDir, 'index.ts');
    const outputDir = join(appDir, '.mastra', '.build');

    await mkdir(outputDir, { recursive: true });
    await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(join(pkgADir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(join(pkgBDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(join(appDir, 'src'), { recursive: true });
    await mkdir(join(pkgADir, 'src'), { recursive: true });
    await mkdir(join(pkgBDir, 'src'), { recursive: true });
    await mkdir(join(pkgCDir, 'src'), { recursive: true });

    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
    await writeFile(
      join(pkgADir, 'package.json'),
      JSON.stringify({
        name: '@internal/a',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: { '@internal/b': 'workspace:*' },
      }),
    );
    await writeFile(
      join(pkgBDir, 'package.json'),
      JSON.stringify({
        name: '@internal/b',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: { '@internal/c': 'workspace:*' },
      }),
    );
    await writeFile(
      join(pkgCDir, 'package.json'),
      JSON.stringify({ name: '@internal/c', version: '1.0.0', type: 'module', main: './src/index.js' }),
    );

    await writeFile(
      join(pkgADir, 'src', 'index.js'),
      `import { valueB } from '@internal/b';\nexport const valueA = valueB;`,
    );
    await writeFile(
      join(pkgBDir, 'src', 'index.js'),
      `import { valueC } from '@internal/c';\nexport const valueB = valueC;`,
    );
    await writeFile(join(pkgCDir, 'src', 'index.js'), `export const valueC = 'c';`);
    await writeFile(entryFile, `import { valueA } from '@internal/a';\nexport const value = valueA;`);

    await symlink(pkgADir, join(appDir, 'node_modules', '@internal', 'a'));
    await symlink(pkgBDir, join(pkgADir, 'node_modules', '@internal', 'b'));
    await symlink(pkgCDir, join(pkgBDir, 'node_modules', '@internal', 'c'));

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const result = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          bundlerOptions: {
            externals: [],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.has('@internal/a')).toBe(false);
      expect(result.externalDependencies.has('@internal/b')).toBe(false);
      expect(result.externalDependencies.has('@internal/c')).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  }, 15000);

  it('declares a configured native package without importing its binary during validation', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-native-external-'));
    tempDirs.push(tempDir);

    const nativePackageDir = join(tempDir, 'node_modules', 'better-sqlite3');
    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    const loadedSentinel = join(tempDir, 'native-package-loaded');

    await mkdir(join(nativePackageDir, 'lib'), { recursive: true });
    await mkdir(outputDir, { recursive: true });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'native-external-app',
        version: '1.0.0',
        type: 'module',
        dependencies: { 'better-sqlite3': '11.10.0' },
      }),
    );
    await writeFile(
      join(nativePackageDir, 'package.json'),
      JSON.stringify({ name: 'better-sqlite3', version: '11.10.0', main: './lib/database.js' }),
    );
    await writeFile(
      join(nativePackageDir, 'lib', 'database.js'),
      `require('node:fs').writeFileSync(${JSON.stringify(loadedSentinel)}, 'loaded'); require('../build/Release/better_sqlite3.node'); module.exports = class Database {};`,
    );
    await writeFile(entryFile, `import Database from 'better-sqlite3';\nexport const database = Database;`);

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const result = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: tempDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: {
            externals: ['better-sqlite3'],
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(result.externalDependencies.get('better-sqlite3')).toEqual({
        version: '11.10.0',
        packageSpec: undefined,
      });
      await expect(access(loadedSentinel)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      process.chdir(originalCwd);
    }
  }, 15000);
});

describe('analysis without external version lookups', () => {
  // `mastra dev` skips the lookups: it installs nothing. Validation stubs externals by name, so the names must stay.
  it('lists the same externals and optimized dependencies, without versions', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-no-version-lookup-'));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const workspacePackageDir = join(tempDir, 'packages', 'workspace-package');
    const externalPackageDir = join(workspacePackageDir, 'node_modules', 'external-only-from-workspace');
    const entryFile = join(appDir, 'index.ts');
    const outputDir = join(appDir, '.mastra', '.build');

    await mkdir(outputDir, { recursive: true });
    await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
    await mkdir(externalPackageDir, { recursive: true });
    await mkdir(join(workspacePackageDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
    await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
    await writeFile(
      join(workspacePackageDir, 'package.json'),
      JSON.stringify({
        name: '@internal/workspace-package',
        version: '1.0.0',
        type: 'module',
        main: './src/index.js',
        dependencies: { 'external-only-from-workspace': '4.5.6' },
      }),
    );
    await writeFile(
      join(externalPackageDir, 'package.json'),
      JSON.stringify({ name: 'external-only-from-workspace', version: '4.5.6', type: 'module', main: './index.js' }),
    );
    await writeFile(join(externalPackageDir, 'index.js'), `export const externalValue = 1;`);
    await writeFile(
      join(workspacePackageDir, 'src', 'index.js'),
      `import { externalValue } from 'external-only-from-workspace';\nexport const workspaceValue = externalValue;`,
    );
    await symlink(workspacePackageDir, join(appDir, 'node_modules', '@internal', 'workspace-package'));
    await writeFile(
      entryFile,
      `import { workspaceValue } from '@internal/workspace-package';\nexport const value = workspaceValue;`,
    );

    // The workspace lookup cache is module state; an earlier test that ran outside any workspace would hide this one.
    vi.resetModules();
    const { analyzeBundle: freshAnalyzeBundle } = await import('./analyze');
    const analyze = (resolveExternalVersions: boolean) =>
      freshAnalyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          isDev: true,
          resolveExternalVersions,
          bundlerOptions: { externals: [], enableSourcemap: false },
        },
        noopLogger,
      );

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const withLookups = await analyze(true);
      expect(withLookups.externalDependencies.get('external-only-from-workspace')?.version).toBe('4.5.6');

      const withoutLookups = await analyze(false);
      expect([...withoutLookups.externalDependencies.keys()]).toEqual([...withLookups.externalDependencies.keys()]);
      expect(withoutLookups.externalDependencies.get('external-only-from-workspace')?.version).toBeUndefined();
      expect(withoutLookups.dependencies).toEqual(withLookups.dependencies);
      expect(withoutLookups.depsToOptimize).toEqual(withLookups.depsToOptimize);
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);
});

describe('repeated analysis in one process', () => {
  // `mastra dev` analyzes again in the same process after a restart; package lookups must not leak across analyses.
  it('picks up a dependency installed or upgraded since the previous analysis', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-reanalyze-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    const externalPackageDir = join(tempDir, 'node_modules', 'late-external');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'reanalyze-app', type: 'module' }));
    await writeFile(entryFile, `import { value } from 'late-external';\nexport const result = value;`);

    const analyze = () =>
      analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: tempDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: { externals: ['late-external'], enableSourcemap: false },
        },
        noopLogger,
      );
    const installExternal = async (version: string) => {
      await mkdir(externalPackageDir, { recursive: true });
      await writeFile(
        join(externalPackageDir, 'package.json'),
        JSON.stringify({ name: 'late-external', version, type: 'module', main: './index.js' }),
      );
      await writeFile(join(externalPackageDir, 'index.js'), `export const value = ${JSON.stringify(version)};`);
    };

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      expect((await analyze()).externalDependencies.get('late-external')?.version).toBeUndefined();

      await installExternal('1.0.0');
      expect((await analyze()).externalDependencies.get('late-external')?.version).toBe('1.0.0');

      await installExternal('2.0.0');
      expect((await analyze()).externalDependencies.get('late-external')?.version).toBe('2.0.0');
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);
});

describe('bundle validation', () => {
  // Bundled dependencies are validated in parallel child processes. When several fail, the reported error must not
  // depend on which child finishes first.
  it('reports the same failing dependency regardless of which validation finishes first', async () => {
    const analyzeWithBrokenDependencies = async (delays: { alpha: number; beta: number }) => {
      await mkdir(tempRoot, { recursive: true });
      const tempDir = await mkdtemp(join(tempRoot, 'mastra-validation-order-'));
      tempDirs.push(tempDir);

      const entryFile = join(tempDir, 'index.ts');
      const outputDir = join(tempDir, '.mastra', '.build');
      await mkdir(outputDir, { recursive: true });
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'validation-order-app', type: 'module' }));
      for (const [name, delay] of Object.entries(delays)) {
        const packageDir = join(tempDir, 'node_modules', name);
        await mkdir(packageDir, { recursive: true });
        await writeFile(
          join(packageDir, 'package.json'),
          JSON.stringify({ name, version: '1.0.0', type: 'module', main: './index.js' }),
        );
        // Fails while the bundled module is evaluated, after `delay` ms.
        await writeFile(
          join(packageDir, 'index.js'),
          `Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ${delay});\nexport const ${name} = globalThis.missing.${name};`,
        );
      }
      await writeFile(
        entryFile,
        `import { alpha } from 'alpha';\nimport { beta } from 'beta';\nexport const values = [alpha, beta];`,
      );

      const originalCwd = process.cwd();
      process.chdir(tempDir);
      try {
        const error = await analyzeBundle(
          [entryFile],
          entryFile,
          {
            outputDir,
            projectRoot: tempDir,
            platform: 'node',
            bundlerOptions: { externals: [], enableSourcemap: false },
          },
          noopLogger,
        ).then(
          () => undefined,
          (err: unknown) => err,
        );
        expect(error).toBeInstanceOf(Error);
        return (error as Error).message.match(/bundle "(alpha|beta)"/)?.[1];
      } finally {
        process.chdir(originalCwd);
      }
    };

    const whenAlphaIsSlow = await analyzeWithBrokenDependencies({ alpha: 1500, beta: 0 });
    const whenBetaIsSlow = await analyzeWithBrokenDependencies({ alpha: 0, beta: 1500 });

    expect(whenAlphaIsSlow).toMatch(/^(alpha|beta)$/);
    expect(whenBetaIsSlow).toBe(whenAlphaIsSlow);
  }, 30000);
});

// Entries are scanned in parallel; a long chain of local modules makes an entry's scan finish after the others.
async function writeModuleChain(dir: string, name: string, length: number, lastModule: string) {
  await mkdir(join(dir, name), { recursive: true });
  for (let i = 0; i < length; i++) {
    await writeFile(
      join(dir, name, `m${i}.js`),
      i === length - 1 ? lastModule : `export * from './m${i + 1}.js';\nexport const v${i} = ${i};`,
    );
  }
  return `./${name}/m0.js`;
}

describe('analyzing several entries', () => {
  async function createApp(prefix: string) {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, prefix));
    tempDirs.push(tempDir);
    await mkdir(join(tempDir, '.mastra', '.build'), { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'several-entries-app', type: 'module' }));
    return tempDir;
  }

  async function analyzeIn(cwd: string, entries: string[], options: { externals: string[]; isDev?: boolean }) {
    const originalCwd = process.cwd();
    process.chdir(cwd);
    try {
      return await analyzeBundle(
        entries,
        entries[0]!,
        {
          outputDir: join(cwd, '.mastra', '.build'),
          projectRoot: cwd,
          platform: 'node',
          isDev: options.isDev,
          bundlerOptions: { externals: options.externals, enableSourcemap: false },
        },
        noopLogger,
      );
    } finally {
      process.chdir(originalCwd);
    }
  }

  it('keeps the entry order in the output when a later entry finishes analyzing first', async () => {
    const appDir = await createApp('mastra-entry-order-');
    const slowChain = await writeModuleChain(appDir, 'slow', 300, `export const last = 'last';`);
    const slowEntry = join(appDir, 'slow-entry.ts');
    const fastEntry = join(appDir, 'fast-entry.ts');
    await writeFile(
      slowEntry,
      `import { zeta } from 'zeta-ext';\nexport * from '${slowChain}';\nexport const slowValue = zeta;`,
    );
    await writeFile(fastEntry, `import { alpha } from 'alpha-ext';\nexport const fastValue = alpha;`);

    const result = await analyzeIn(appDir, [slowEntry, fastEntry], { externals: ['zeta-ext', 'alpha-ext'] });

    expect([...result.externalDependencies.keys()]).toEqual(['zeta-ext', 'alpha-ext']);
    const [firstEntry, secondEntry] = await Promise.all([
      readFile(join(appDir, '.mastra', '.build', 'entry-0.mjs'), 'utf-8'),
      readFile(join(appDir, '.mastra', '.build', 'entry-1.mjs'), 'utf-8'),
    ]);
    expect(firstEntry).toContain('slowValue');
    expect(secondEntry).toContain('fastValue');
  }, 30000);

  it('reports the failure of the first failing entry even when a later one fails sooner', async () => {
    const appDir = await createApp('mastra-entry-first-error-');
    const slowChain = await writeModuleChain(appDir, 'slow', 300, `export const broken = ;`);
    const slowEntry = join(appDir, 'slow-broken-entry.ts');
    const fastEntry = join(appDir, 'fast-broken-entry.ts');
    await writeFile(slowEntry, `export * from '${slowChain}';`);
    await writeFile(fastEntry, `export const broken = ;`);

    const error = await analyzeIn(appDir, [slowEntry, fastEntry], { externals: [] }).then(
      () => undefined,
      (err: unknown) => err,
    );

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toContain(join('slow', 'm299.js'));
    expect((error as Error).message).not.toContain('fast-broken-entry');
  }, 30000);

  // Entry a reaches workspace package b through a, entry b reaches a through b. Sharing in-flight analyses between
  // entries must not leave each waiting for the other.
  it('analyzes entries that reach a workspace dependency cycle from opposite ends', async () => {
    // Outside the repo: workspace roots are cached by directory prefix, and earlier tests cached the repo root for
    // everything under `.tmp`.
    const tempDir = await realpath(await mkdtemp(join(tmpdir(), 'mastra-entry-cycle-')));
    tempDirs.push(tempDir);

    const appDir = join(tempDir, 'apps', 'app');
    const pkgADir = join(tempDir, 'packages', 'a');
    const pkgBDir = join(tempDir, 'packages', 'b');
    await mkdir(join(appDir, '.mastra', '.build'), { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'cycle-workspace', version: '1.0.0' }));
    await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
    await writeFile(
      join(appDir, 'package.json'),
      JSON.stringify({
        name: 'app',
        version: '1.0.0',
        type: 'module',
        dependencies: { '@cyc/a': 'workspace:*', '@cyc/b': 'workspace:*' },
      }),
    );
    for (const [dir, name, other] of [
      [pkgADir, 'a', 'b'],
      [pkgBDir, 'b', 'a'],
    ] as const) {
      await mkdir(join(dir, 'src'), { recursive: true });
      await mkdir(join(dir, 'node_modules', '@cyc'), { recursive: true });
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({
          name: `@cyc/${name}`,
          version: '1.0.0',
          type: 'module',
          main: './src/index.js',
          dependencies: { [`@cyc/${other}`]: 'workspace:*' },
        }),
      );
      await writeFile(
        join(dir, 'src', 'index.js'),
        `import { ${other} } from '@cyc/${other}';\nexport const ${name} = '${name}';\nexport const get${other.toUpperCase()} = () => ${other};`,
      );
    }
    await mkdir(join(appDir, 'node_modules', '@cyc'), { recursive: true });
    await symlink(pkgADir, join(appDir, 'node_modules', '@cyc', 'a'));
    await symlink(pkgBDir, join(appDir, 'node_modules', '@cyc', 'b'));
    await symlink(pkgBDir, join(pkgADir, 'node_modules', '@cyc', 'b'));
    await symlink(pkgADir, join(pkgBDir, 'node_modules', '@cyc', 'a'));

    const entryA = join(appDir, 'a.ts');
    const entryB = join(appDir, 'b.ts');
    await writeFile(entryA, `import { a } from '@cyc/a';\nexport const fromA = a;`);
    await writeFile(entryB, `import { b } from '@cyc/b';\nexport const fromB = b;`);

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const result = await analyzeBundle(
        [entryA, entryB],
        entryA,
        {
          outputDir: join(appDir, '.mastra', '.build'),
          projectRoot: appDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: { externals: [], enableSourcemap: false },
        },
        noopLogger,
      );

      expect([...result.depsToOptimize].map(([dep, { exports }]) => [dep, exports])).toEqual([
        ['@cyc/a', ['a']],
        ['@cyc/b', ['b']],
      ]);
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);
});

describe('protocol imports', () => {
  it('should exclude protocol imports from externalDependencies', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'mastra-protocol-imports-'));
    tempDirs.push(tempDir);

    const entryFile = join(tempDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'protocol-import-test', type: 'module' }));
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

describe('Software Factory project type detection', () => {
  it('classifies a MastraFactory entry as factory', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'factory-analyze-'));
    tempDirs.push(tempDir);

    const mastraDir = join(tempDir, 'src', 'mastra');
    const entryFile = join(mastraDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await mkdir(mastraDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', type: 'module' }));
    await writeFile(join(mastraDir, 'factory.ts'), `export class MastraFactory { prepare() { return {}; } }\n`);
    await writeFile(
      entryFile,
      `import { MastraFactory } from './factory';\n` +
        `const factory = new MastraFactory();\n` +
        `export const mastra = factory.prepare();\n`,
    );

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: { externals: [], enableSourcemap: false },
      },
      noopLogger,
    );

    expect(result.projectType).toBe('factory');
  });

  it('classifies an ordinary Mastra entry as undefined projectType', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'factory-analyze-'));
    tempDirs.push(tempDir);

    const mastraDir = join(tempDir, 'src', 'mastra');
    const entryFile = join(mastraDir, 'index.ts');
    const outputDir = join(tempDir, '.mastra', '.build');
    await mkdir(outputDir, { recursive: true });
    await mkdir(mastraDir, { recursive: true });
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test', version: '1.0.0', type: 'module' }));
    await writeFile(entryFile, `export const mastra = new Mastra({});\n`);

    const result = await analyzeBundle(
      [entryFile],
      entryFile,
      {
        outputDir,
        projectRoot: tempDir,
        platform: 'node',
        bundlerOptions: { externals: [], enableSourcemap: false },
      },
      noopLogger,
    );

    expect(result.projectType).toBeUndefined();
  });
});
