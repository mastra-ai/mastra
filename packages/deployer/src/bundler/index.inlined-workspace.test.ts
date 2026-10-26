import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DepsService } from '../services/deps';
import { Bundler } from './index';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const tempRoot = join(packageRoot, '.tmp');
const tempDirs: string[] = [];

class TestBundler extends Bundler {
  // Same as `mastra build`
  protected defaultExternalsPreset = true;

  async bundle(): Promise<void> {}

  getEnvFiles(): Promise<string[]> {
    return Promise.resolve([]);
  }

  bundleForTest(serverFile: string, mastraEntryFile: string, projectRoot: string, outputDirectory: string) {
    return this._bundle(serverFile, mastraEntryFile, { projectRoot, outputDirectory });
  }
}

type FixturePackage = { dependencies?: Record<string, string>; source: string };

/**
 * pnpm workspace from #28303. The app imports `@inner/inlined`, which `mastra build` compiles into the bundle, and
 * `@inner/external`, which the app names in `bundler.externals`.
 * - `@inner/inlined` imports the npm package `npm-dep` (installed in its own `node_modules`, as pnpm does) and
 *   declares a workspace dependency on `@inner/inlined-only-dep` that the bundle never needs at runtime.
 * - `@inner/external` imports the workspace package `@inner/external-dep`, which must ship with it.
 */
async function createWorkspace() {
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(join(tempRoot, 'inlined-workspace-'));
  tempDirs.push(tempDir);

  const appDir = join(tempDir, 'apps', 'app');
  const mastraDir = join(appDir, 'src', 'mastra');
  const packages: Record<string, FixturePackage> = {
    inlined: {
      dependencies: { 'npm-dep': '^2.0.0', '@inner/inlined-only-dep': 'workspace:*' },
      source: `import { npmDep } from 'npm-dep';\nexport const value = 'inlined:' + npmDep;\n`,
    },
    'inlined-only-dep': { source: `export const value = 'inlined-only-dep';\n` },
    external: {
      dependencies: { '@inner/external-dep': 'workspace:*' },
      source: `import { value as dep } from '@inner/external-dep';\nexport const value = 'external:' + dep;\n`,
    },
    'external-dep': { source: `export const value = 'external-dep';\n` },
  };

  await writeFile(join(tempDir, 'package.json'), JSON.stringify({ name: 'workspace', private: true }));
  await writeFile(join(tempDir, 'pnpm-workspace.yaml'), `packages:\n  - apps/*\n  - packages/*\n`);

  await mkdir(join(appDir, 'node_modules', '@inner'), { recursive: true });
  await mkdir(mastraDir, { recursive: true });
  await writeFile(
    join(appDir, 'package.json'),
    JSON.stringify({
      name: 'app',
      version: '1.0.0',
      type: 'module',
      dependencies: { '@inner/inlined': 'workspace:*', '@inner/external': 'workspace:*' },
    }),
  );

  for (const [name, { dependencies, source }] of Object.entries(packages)) {
    const dir = join(tempDir, 'packages', name);
    await mkdir(join(dir, 'src'), { recursive: true });
    await writeFile(
      join(dir, 'package.json'),
      JSON.stringify({
        name: `@inner/${name}`,
        version: '1.0.0',
        type: 'module',
        exports: './src/index.js',
        dependencies,
      }),
    );
    await writeFile(join(dir, 'src', 'index.js'), source);
    await symlink(dir, join(appDir, 'node_modules', '@inner', name));
  }

  await mkdir(join(tempDir, 'packages', 'external', 'node_modules', '@inner'), { recursive: true });
  await symlink(
    join(tempDir, 'packages', 'external-dep'),
    join(tempDir, 'packages', 'external', 'node_modules', '@inner', 'external-dep'),
  );

  const npmDepDir = join(tempDir, 'packages', 'inlined', 'node_modules', 'npm-dep');
  await mkdir(npmDepDir, { recursive: true });
  await writeFile(
    join(npmDepDir, 'package.json'),
    JSON.stringify({ name: 'npm-dep', version: '2.3.4', type: 'module', exports: './index.js' }),
  );
  await writeFile(join(npmDepDir, 'index.js'), `export const npmDep = 'npm-dep';\n`);

  const mastraEntryFile = join(mastraDir, 'index.ts');
  await writeFile(
    mastraEntryFile,
    [
      `import { Mastra } from '@mastra/core/mastra';`,
      `import { value as inlined } from '@inner/inlined';`,
      `import { value as external } from '@inner/external';`,
      `globalThis.values = [inlined, external];`,
      `export const mastra = new Mastra({ bundler: { externals: ['@inner/external'] } });`,
      '',
    ].join('\n'),
  );

  return { tempDir, appDir, mastraEntryFile };
}

describe('Bundler workspace dependencies (#28303)', () => {
  const originalSkipInstall = process.env.MASTRA_BUILD_SKIP_INSTALL;

  beforeEach(() => {
    process.env.MASTRA_BUILD_SKIP_INSTALL = 'true';
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalSkipInstall === undefined) {
      delete process.env.MASTRA_BUILD_SKIP_INSTALL;
    } else {
      process.env.MASTRA_BUILD_SKIP_INSTALL = originalSkipInstall;
    }
    await Promise.all(tempDirs.splice(0).map(dir => rm(dir, { recursive: true, force: true })));
  });

  it('installs externals and their workspace dependencies, but not workspace packages inlined into the bundle', async () => {
    const { tempDir, appDir, mastraEntryFile } = await createWorkspace();
    const packSpy = vi.spyOn(DepsService.prototype, 'pack').mockResolvedValue('');

    const originalCwd = process.cwd();
    process.chdir(tempDir);
    try {
      const bundler = new TestBundler('test-bundler');
      await bundler.prepare(join(appDir, '.mastra'));
      await bundler.bundleForTest(
        `import { mastra } from '#mastra';\nexport { mastra };\n`,
        mastraEntryFile,
        appDir,
        join(appDir, '.mastra'),
      );
    } finally {
      process.chdir(originalCwd);
    }

    const outputDir = join(appDir, '.mastra', 'output');
    const { dependencies } = JSON.parse(await readFile(join(outputDir, 'package.json'), 'utf-8'));

    // Inlined workspace packages and their workspace-only dependencies are not shipped
    expect(dependencies).not.toHaveProperty('@inner/inlined');
    expect(dependencies).not.toHaveProperty('@inner/inlined-only-dep');
    const bundledCode = await readFile(join(outputDir, 'mastra.mjs'), 'utf-8');
    expect(bundledCode).toContain('"inlined:" + npmDep');
    expect(bundledCode).not.toMatch(/from ["']@inner\/inlined["']/);

    // npm packages imported by inlined workspace code are still installed
    expect(dependencies['npm-dep']).toBe('2.3.4');
    expect(bundledCode).toMatch(/from ["']npm-dep["']/);

    // External workspace packages ship with their own workspace dependencies
    expect(dependencies['@inner/external']).toBe('file:./workspace-module/inner-external-1.0.0.tgz');
    expect(dependencies['@inner/external-dep']).toBe('file:./workspace-module/inner-external-dep-1.0.0.tgz');
    expect(packSpy.mock.calls.map(([options]) => options.sanitizedName).sort()).toEqual([
      'inner-external',
      'inner-external-dep',
    ]);
  }, 60000);
});
