import { realpathSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { noopLogger } from '@mastra/core/logger';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeBundle } from '../analyze';
import type { DependencyMetadata } from '../types';
import { getWorkspaceDepCacheEntryPath, workspaceDepsWatcher } from './workspace-deps-watcher';

const tempDirs: string[] = [];
const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
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

async function setupMiniMonorepo() {
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(join(tempRoot, 'workspace-deps-hmr-'));
  tempDirs.push(tempDir);

  const appDir = join(tempDir, 'apps', 'app');
  const workspacePackageDir = join(tempDir, 'packages', 'shared-lib');
  const entryFile = join(appDir, 'index.ts');
  const outputDir = join(appDir, '.mastra', '.build');
  const sourceFile = join(workspacePackageDir, 'src', 'index.ts');

  await mkdir(outputDir, { recursive: true });
  await mkdir(join(appDir, 'node_modules', '@internal'), { recursive: true });
  await mkdir(join(workspacePackageDir, 'src'), { recursive: true });

  await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'test-workspace', version: '1.0.0' }));
  await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);
  await writeFile(join(appDir, 'package.json'), JSON.stringify({ name: 'app', version: '1.0.0', type: 'module' }));
  await writeFile(
    join(workspacePackageDir, 'package.json'),
    JSON.stringify({
      name: '@internal/shared-lib',
      version: '1.0.0',
      type: 'module',
      main: './src/index.ts',
    }),
  );
  await writeFile(sourceFile, `export const PACKAGE_VALUE = 'Package value is BEFORE.';\n`);
  await symlink(workspacePackageDir, join(appDir, 'node_modules', '@internal', 'shared-lib'));
  await writeFile(
    entryFile,
    `import { PACKAGE_VALUE } from '@internal/shared-lib';\nexport const APP_SUFFIX = 'App value is BEFORE.';\nexport const value = \`\${PACKAGE_VALUE} \${APP_SUFFIX}\`;\n`,
  );

  return { tempDir, appDir, workspacePackageDir, entryFile, outputDir, sourceFile };
}

describe('workspaceDepsWatcher', () => {
  it('watches workspace sources and regenerates .cache after package edits (including subsequent app rebuilds)', async () => {
    const { tempDir, appDir, workspacePackageDir, entryFile, outputDir, sourceFile } = await setupMiniMonorepo();
    const cachePath = getWorkspaceDepCacheEntryPath(workspacePackageDir, '@internal/shared-lib');

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const analyzeResult = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: {
            externals: true,
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      expect(analyzeResult.depsToOptimize?.size).toBeGreaterThan(0);
      expect(analyzeResult.dependencies.has('@internal/shared-lib')).toBe(true);

      const baselineCache = await readFile(cachePath, 'utf-8');
      expect(baselineCache).toContain('Package value is BEFORE.');
      expect(baselineCache).not.toContain('Package value is AFTER.');

      const workspaceMap = analyzeResult.workspaceMap;
      const depsToOptimize = analyzeResult.depsToOptimize as Map<string, DependencyMetadata>;
      const optimizedDependencyFiles = new Map<string, string>();
      for (const [dep, fileName] of analyzeResult.dependencies.entries()) {
        optimizedDependencyFiles.set(dep, fileName);
      }

      const plugin = workspaceDepsWatcher({
        depsToOptimize,
        optimizedDependencyFiles,
        workspaceMap,
        workspaceRoot: analyzeResult.workspaceRoot || tempDir,
        outputDir: analyzeResult.outputDir || outputDir,
        platform: 'node',
        bundlerOptions: {
          externals: true,
          enableSourcemap: false,
        },
      });

      const addWatchFile = vi.fn();
      const buildStart = plugin.buildStart as (this: { addWatchFile: typeof addWatchFile }) => Promise<void>;
      const watchChange = plugin.watchChange as (id: string, change: { event: 'update' }) => void;

      // First buildStart skips re-optimize (already done by analyzeBundle).
      await buildStart.call({ addWatchFile });
      expect(addWatchFile).toHaveBeenCalledWith(expect.stringContaining(join('shared-lib', 'src', 'index.ts')));

      // Edit workspace package only — this is the core HMR bug case.
      await writeFile(sourceFile, `export const PACKAGE_VALUE = 'Package value is AFTER.';\n`);
      // Rolldown reports changes by real path.
      watchChange(realpathSync(sourceFile), { event: 'update' });

      await buildStart.call({ addWatchFile });

      const afterPackageEdit = await readFile(cachePath, 'utf-8');
      expect(afterPackageEdit).toContain('Package value is AFTER.');
      expect(afterPackageEdit).not.toContain('Package value is BEFORE.');

      // Simulate an app-only rebuild: touch app entry without reverting package.
      // Cache must still reflect the package AFTER value (no stale optimizer output).
      const cacheMtimeBeforeAppEdit = (await stat(cachePath)).mtimeMs;
      await writeFile(
        entryFile,
        `import { PACKAGE_VALUE } from '@internal/shared-lib';\nexport const APP_SUFFIX = 'App value is AFTER.';\nexport const value = \`\${PACKAGE_VALUE} \${APP_SUFFIX}\`;\n`,
      );
      watchChange(realpathSync(entryFile), { event: 'update' });

      await buildStart.call({ addWatchFile });

      const afterAppEdit = await readFile(cachePath, 'utf-8');
      expect(afterAppEdit).toContain('Package value is AFTER.');
      expect(afterAppEdit).not.toContain('Package value is BEFORE.');
      // App-only changes must not re-run the workspace optimizer.
      expect((await stat(cachePath)).mtimeMs).toBe(cacheMtimeBeforeAppEdit);
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);

  it('regenerates missing .cache files on rebuild', async () => {
    const { tempDir, appDir, workspacePackageDir, entryFile, outputDir } = await setupMiniMonorepo();
    const cachePath = getWorkspaceDepCacheEntryPath(workspacePackageDir, '@internal/shared-lib');

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      const analyzeResult = await analyzeBundle(
        [entryFile],
        entryFile,
        {
          outputDir,
          projectRoot: appDir,
          platform: 'node',
          isDev: true,
          bundlerOptions: {
            externals: true,
            enableSourcemap: false,
          },
        },
        noopLogger,
      );

      const plugin = workspaceDepsWatcher({
        depsToOptimize: analyzeResult.depsToOptimize as Map<string, DependencyMetadata>,
        optimizedDependencyFiles: analyzeResult.dependencies,
        workspaceMap: analyzeResult.workspaceMap,
        workspaceRoot: analyzeResult.workspaceRoot || tempDir,
        outputDir: analyzeResult.outputDir || outputDir,
        platform: 'node',
        bundlerOptions: { externals: true, enableSourcemap: false },
      });

      const addWatchFile = vi.fn();
      const buildStart = plugin.buildStart as (this: { addWatchFile: typeof addWatchFile }) => Promise<void>;
      await buildStart.call({ addWatchFile });

      await rm(cachePath, { force: true });
      expect(await readFile(cachePath, 'utf-8').catch(() => null)).toBeNull();

      await buildStart.call({ addWatchFile });

      const regenerated = await readFile(cachePath, 'utf-8');
      expect(regenerated).toContain('Package value is BEFORE.');
    } finally {
      process.chdir(originalCwd);
    }
  }, 30000);

  it('watches workspace roots reached through a symlink by their real path', async () => {
    await mkdir(tempRoot, { recursive: true });
    const tempDir = await mkdtemp(join(tempRoot, 'workspace-deps-symlink-'));
    tempDirs.push(tempDir);

    const realPackageDir = join(tempDir, 'real', 'shared-lib');
    const linkedPackageDir = join(tempDir, 'linked-shared-lib');
    await mkdir(join(realPackageDir, 'src'), { recursive: true });
    await writeFile(join(realPackageDir, 'src', 'index.ts'), `export const value = 1;\n`);
    await symlink(realPackageDir, linkedPackageDir);

    const plugin = workspaceDepsWatcher({
      depsToOptimize: new Map([
        ['@internal/shared-lib', { exports: ['value'], rootPath: linkedPackageDir, isWorkspace: true }],
      ]),
      optimizedDependencyFiles: new Map(),
      workspaceMap: new Map(),
      workspaceRoot: tempDir,
      outputDir: join(tempDir, '.mastra', '.build'),
      platform: 'node',
    });

    const addWatchFile = vi.fn();
    const buildStart = plugin.buildStart as (this: { addWatchFile: typeof addWatchFile }) => Promise<void>;
    await buildStart.call({ addWatchFile });

    expect(addWatchFile).toHaveBeenCalledWith(realpathSync(join(realPackageDir, 'src', 'index.ts')));
    expect(addWatchFile).not.toHaveBeenCalledWith(expect.stringContaining('linked-shared-lib'));
  });
});
