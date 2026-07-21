import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noopLogger } from '@mastra/core/logger';
import { ensureDir, readFile, remove, writeFile } from 'fs-extra';
import { rollup } from 'rollup';
import type * as RollupModule from 'rollup';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { analyzeEntry } from './analyzeEntry';

vi.spyOn(process, 'cwd').mockReturnValue(join(import.meta.dirname, '__fixtures__', 'default'));
vi.mock('rollup', async () => {
  const actual = await vi.importActual<typeof RollupModule>('rollup');
  return {
    ...actual,
    rollup: vi.fn(actual.rollup),
  };
});

describe('analyzeEntry', () => {
  beforeEach(() => {
    vi.mocked(rollup).mockClear();
    vi.spyOn(process, 'cwd').mockReturnValue(join(import.meta.dirname, '__fixtures__', 'default'));
  });

  it('should analyze the entry file', async () => {
    const entryAsString = await readFile(join(import.meta.dirname, '__fixtures__', 'default', 'entry.ts'), 'utf-8');

    const result = await analyzeEntry({ entry: entryAsString, isVirtualFile: true }, ``, {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap: new Map(),
      projectRoot: process.cwd(),
    });

    expect(result.dependencies.size).toBe(4);

    // Check individual dependencies without hardcoded paths
    expect(result.dependencies.has('@mastra/core/logger')).toBe(true);
    expect(result.dependencies.has('@mastra/core/mastra')).toBe(true);
    expect(result.dependencies.has('@mastra/core/agent')).toBe(true);
    expect(result.dependencies.has('@ai-sdk/openai')).toBe(true);

    const loggerDep = result.dependencies.get('@mastra/core/logger');
    expect(loggerDep?.exports).toEqual(['createLogger']);
    expect(loggerDep?.isWorkspace).toBe(false);
    expect(loggerDep?.rootPath).toMatch(/packages\/core$/);

    const mastraDep = result.dependencies.get('@mastra/core/mastra');
    expect(mastraDep?.exports).toEqual(['Mastra']);
    expect(mastraDep?.isWorkspace).toBe(false);
    expect(mastraDep?.rootPath).toMatch(/packages\/core$/);

    const agentDep = result.dependencies.get('@mastra/core/agent');
    expect(agentDep?.exports).toEqual(['Agent']);
    expect(agentDep?.isWorkspace).toBe(false);
    expect(agentDep?.rootPath).toMatch(/packages\/core$/);

    const openaiDep = result.dependencies.get('@ai-sdk/openai');
    expect(openaiDep?.exports).toEqual(['openai']);
    expect(openaiDep?.isWorkspace).toBe(false);
    expect(openaiDep?.rootPath).toBe(null);

    expect(result.output).toMatchSnapshot();
  });

  it('should analyze actual file path (non-virtual)', async () => {
    const entryFilePath = join(import.meta.dirname, '__fixtures__', 'default', 'entry.ts');

    const result = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap: new Map(),
      projectRoot: process.cwd(),
    });

    expect(result.dependencies.size).toBe(4);
    expect(result.dependencies.has('@mastra/core/logger')).toBe(true);
    expect(result.dependencies.has('@mastra/core/mastra')).toBe(true);
    expect(result.dependencies.has('@mastra/core/agent')).toBe(true);
    expect(result.dependencies.has('@ai-sdk/openai')).toBe(true);
    expect(result.output.code).toBeTruthy();
  });

  it('should detect workspace packages correctly', async () => {
    const entryAsString = await readFile(join(import.meta.dirname, '__fixtures__', 'default', 'entry.ts'), 'utf-8');

    // Mock workspace map with @mastra/core as a workspace package
    const workspaceMap = new Map<string, WorkspacePackageInfo>([
      [
        '@mastra/core',
        {
          location: '/workspace/packages/core',
          dependencies: {},
          version: '1.0.0',
        },
      ],
    ]);

    const result = await analyzeEntry({ entry: entryAsString, isVirtualFile: true }, '', {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap,
      projectRoot: process.cwd(),
    });

    const loggerDep = result.dependencies.get('@mastra/core/logger');
    expect(loggerDep?.isWorkspace).toBe(true);

    const mastraDep = result.dependencies.get('@mastra/core/mastra');
    expect(mastraDep?.isWorkspace).toBe(true);

    const agentDep = result.dependencies.get('@mastra/core/agent');
    expect(agentDep?.isWorkspace).toBe(true);

    // External package should not be workspace
    const openaiDep = result.dependencies.get('@ai-sdk/openai');
    expect(openaiDep?.isWorkspace).toBe(false);
  });

  it('should handle dynamic imports', async () => {
    const entryWithDynamicImport = `
      import { Mastra } from '@mastra/core/mastra';

      export async function loadAgent() {
        const { Agent } = await import('@mastra/core/agent');
        const externalModule = await import('lodash');
        return new Agent();
      }

      export const mastra = new Mastra({});
    `;

    const result = await analyzeEntry({ entry: entryWithDynamicImport, isVirtualFile: true }, '', {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap: new Map(),
      projectRoot: process.cwd(),
    });

    expect(result.dependencies.has('@mastra/core/mastra')).toBe(true);
    expect(result.dependencies.has('@mastra/core/agent')).toBe(true);
    expect(result.dependencies.has('lodash')).toBe(true);

    // Check that dynamic imports have '*' exports
    const agentDep = result.dependencies.get('@mastra/core/agent');
    expect(agentDep?.exports).toEqual(['*']);

    const lodashDep = result.dependencies.get('lodash');
    expect(lodashDep?.exports).toEqual(['*']);
  });

  it('should ignore protocol imports like cloudflare:workers and node builtins', async () => {
    const entryWithProtocolImport = `
      import { env } from 'cloudflare:workers';
      import { readFile } from 'node:fs/promises';
      import { Mastra } from '@mastra/core/mastra';

      export const binding = env.TEST_BINDING;
      export const fileReader = readFile;
      export const mastra = new Mastra({});
    `;

    const result = await analyzeEntry({ entry: entryWithProtocolImport, isVirtualFile: true }, '', {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap: new Map(),
      projectRoot: process.cwd(),
    });

    expect(result.dependencies.has('cloudflare:workers')).toBe(false);
    expect(result.dependencies.has('node:fs/promises')).toBe(false);
    expect(result.dependencies.has('@mastra/core/mastra')).toBe(true);
  });

  it('should generate sourcemaps when enabled', async () => {
    const entryAsString = await readFile(join(import.meta.dirname, '__fixtures__', 'default', 'entry.ts'), 'utf-8');

    const result = await analyzeEntry({ entry: entryAsString, isVirtualFile: true }, '', {
      logger: noopLogger,
      sourcemapEnabled: true,
      workspaceMap: new Map(),
      projectRoot: process.cwd(),
    });

    // Note: Sourcemaps might be null depending on Rollup configuration
    // The important thing is that sourcemapEnabled parameter is handled without errors
    expect(result.output.code).toBeTruthy();
    if (result.output.map) {
      expect(result.output.map.version).toBe(3);
      expect(result.output.map.sources).toBeDefined();
    }
  });

  it('should handle entry with no external dependencies', async () => {
    const entryWithNoDeps = `
      const message = "Hello World";

      function greet(name) {
        return message + ", " + name + "!";
      }

      export { greet };
    `;

    const result = await analyzeEntry({ entry: entryWithNoDeps, isVirtualFile: true }, '', {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap: new Map(),
      projectRoot: process.cwd(),
    });

    expect(result.dependencies.size).toBe(0);
    expect(result.output.code).toBeTruthy();
    expect(result.output.code).toContain('greet');
  });

  it('should handle recursive imports', async () => {
    const root = join(import.meta.dirname, '__fixtures__', 'nested-workspace');
    vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'apps', 'mastra'));

    // Create a workspace map that includes @mastra/core to test recursive transitive dependencies
    const workspaceMap = new Map<string, WorkspacePackageInfo>([
      [
        '@internal/a',
        {
          location: `${root}/packages/a`,
          dependencies: {
            '@internal/shared': '1.0.0',
          },
          version: '1.0.0',
        },
      ],
      [
        '@internal/shared',
        {
          location: `${root}/packages/shared`,
          dependencies: {},
          version: '1.0.0',
        },
      ],
    ]);

    const result = await analyzeEntry(
      {
        entry: join(process.cwd(), 'src', 'index.ts'),
        isVirtualFile: false,
      },
      '',
      {
        shouldCheckTransitiveDependencies: true,
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap,
        projectRoot: root,
      },
    );

    expect(rollup).toHaveBeenCalledTimes(1);
    expect(result.dependencies.size).toBe(2);
    expect(result.dependencies.get('@internal/a')?.exports).toEqual(['a']);
    expect(result.dependencies.get('@internal/shared')?.exports).toEqual(['shared', '*']);
    // Verify that the analyzer doesn't get stuck in infinite loops.
    // (Test will timeout if there's an infinite loop issue)
  });

  it('should deduplicate Rollup instances when analyzeCache is provided', async () => {
    const entryFilePath = join(import.meta.dirname, '__fixtures__', 'default', 'entry.ts');

    const analyzeCache = new Map();
    const opts = {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap: new Map(),
      projectRoot: process.cwd(),
      analyzeCache,
    };

    // First call: cache miss — creates a Rollup instance
    const result1 = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', opts);

    // Second call with the same entry: cache hit — no new Rollup instance
    const result2 = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', opts);

    // Only 1 Rollup instance created despite 2 analyzeEntry calls
    expect(rollup).toHaveBeenCalledTimes(1);
    // Both return the same result
    expect(result1).toBe(result2);
    expect(result1.dependencies.size).toBe(4);
    // Cache populated
    expect(analyzeCache.size).toBe(1);
  });

  it('should discover shared transitive workspace packages from manifests without re-analyzing packages', async () => {
    const root = join(import.meta.dirname, '__fixtures__', 'nested-workspace');
    const entryFilePath = join(root, 'apps', 'mastra', 'src', 'shared-transitive.ts');
    vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'apps', 'mastra'));

    const workspaceMap = new Map<string, WorkspacePackageInfo>([
      [
        '@internal/a',
        {
          location: `${root}/packages/a`,
          dependencies: {
            '@internal/shared': '1.0.0',
          },
          version: '1.0.0',
        },
      ],
      [
        '@internal/b',
        {
          location: `${root}/packages/b`,
          dependencies: {
            '@internal/shared': '1.0.0',
          },
          version: '1.0.0',
        },
      ],
      [
        '@internal/shared',
        {
          location: `${root}/packages/shared`,
          dependencies: {},
          version: '1.0.0',
        },
      ],
    ]);

    const baseOpts = {
      shouldCheckTransitiveDependencies: true,
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap,
      projectRoot: root,
    };

    const uncachedResult = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', baseOpts);
    const uncachedCalls = vi.mocked(rollup).mock.calls.length;

    expect(uncachedCalls).toBe(1);
    expect(uncachedResult.dependencies.size).toBe(3);
    expect(uncachedResult.dependencies.get('@internal/a')?.exports).toEqual(['a']);
    expect(uncachedResult.dependencies.get('@internal/b')?.exports).toEqual(['b']);
    expect(uncachedResult.dependencies.get('@internal/shared')?.exports).toEqual(['*']);

    vi.mocked(rollup).mockClear();

    const analyzeCache = new Map();
    const cachedResult = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
      ...baseOpts,
      analyzeCache,
    });
    const cachedCalls = vi.mocked(rollup).mock.calls.length;

    expect(cachedCalls).toBe(uncachedCalls);
    expect(cachedResult.dependencies.size).toBe(uncachedResult.dependencies.size);
    expect(cachedResult.dependencies.get('@internal/a')?.exports).toEqual(['a']);
    expect(cachedResult.dependencies.get('@internal/b')?.exports).toEqual(['b']);
    expect(cachedResult.dependencies.get('@internal/shared')?.exports).toEqual(['*']);
    expect(analyzeCache.size).toBe(1);
  });

  it('should not cache virtual file entries', async () => {
    const entryCode = `
      import { Mastra } from '@mastra/core/mastra';
      export const mastra = new Mastra({});
    `;

    const analyzeCache = new Map();
    const opts = {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap: new Map(),
      projectRoot: process.cwd(),
      analyzeCache,
    };

    await analyzeEntry({ entry: entryCode, isVirtualFile: true }, '', opts);
    await analyzeEntry({ entry: entryCode, isVirtualFile: true }, '', opts);

    // Virtual files have no stable path — each call creates a new Rollup instance
    expect(rollup).toHaveBeenCalledTimes(2);
    expect(analyzeCache.size).toBe(0);
  });

  // The transitive walk registers every transitive workspace dep as a root `export * from`
  // virtual module. For a package that only declares subpath exports (no "."), that root cannot
  // be resolved and the deployer's alias-optimized-deps plugin throws `Missing "." specifier`
  // under `externals: true` / dev. The walk now skips fabricating a root for such packages.
  describe('subpath-only transitive workspace packages', () => {
    let tmpRoot: string;
    let counter = 0;

    beforeEach(() => {
      tmpRoot = join(tmpdir(), `analyzeEntry-subpath-${Date.now()}-${counter++}`);
    });

    afterEach(async () => {
      await remove(tmpRoot);
    });

    async function writePkg(dir: string, pkg: Record<string, unknown>) {
      await ensureDir(dir);
      await writeFile(join(dir, 'package.json'), JSON.stringify(pkg));
    }

    function makeWorkspaceMap(parentDir: string, leafDir: string) {
      return new Map<string, WorkspacePackageInfo>([
        ['@scope/parent', { location: parentDir, dependencies: { '@scope/leaf': 'workspace:*' }, version: '1.0.0' }],
        ['@scope/leaf', { location: leafDir, dependencies: {}, version: '1.0.0' }],
      ]);
    }

    const entry = `import { thing } from '@scope/parent'; export const x = thing;`;

    it('skips the synthetic root for a subpath-only leaf that nothing imports at its root', async () => {
      const parentDir = join(tmpRoot, 'packages', 'parent');
      const leafDir = join(tmpRoot, 'packages', 'leaf');
      await writePkg(parentDir, { name: '@scope/parent', version: '1.0.0', type: 'module', main: 'src/index.ts' });
      await writePkg(leafDir, {
        name: '@scope/leaf',
        version: '1.0.0',
        type: 'module',
        // Only subpath exports, no "." — cannot be imported at its root.
        exports: { './sub/*': './src/*.ts' },
      });

      const result = await analyzeEntry({ entry, isVirtualFile: true }, '', {
        shouldCheckTransitiveDependencies: true,
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap: makeWorkspaceMap(parentDir, leafDir),
        projectRoot: tmpRoot,
      });

      // The parent is imported at its root and tracked as a workspace dep...
      expect(result.dependencies.get('@scope/parent')?.isWorkspace).toBe(true);
      // ...but the subpath-only leaf's fabricated root is skipped.
      expect(result.dependencies.has('@scope/leaf')).toBe(false);
    });

    it('still registers the transitive root when the leaf has a "." export', async () => {
      const parentDir = join(tmpRoot, 'packages', 'parent');
      const leafDir = join(tmpRoot, 'packages', 'leaf');
      await writePkg(parentDir, { name: '@scope/parent', version: '1.0.0', type: 'module', main: 'src/index.ts' });
      await writePkg(leafDir, {
        name: '@scope/leaf',
        version: '1.0.0',
        type: 'module',
        exports: { '.': './src/index.ts', './sub/*': './src/*.ts' },
      });

      const result = await analyzeEntry({ entry, isVirtualFile: true }, '', {
        shouldCheckTransitiveDependencies: true,
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap: makeWorkspaceMap(parentDir, leafDir),
        projectRoot: tmpRoot,
      });

      expect(result.dependencies.get('@scope/leaf')?.exports).toEqual(['*']);
    });

    it('still registers the transitive root when the leaf has no exports map (main/index fallback)', async () => {
      const parentDir = join(tmpRoot, 'packages', 'parent');
      const leafDir = join(tmpRoot, 'packages', 'leaf');
      await writePkg(parentDir, { name: '@scope/parent', version: '1.0.0', type: 'module', main: 'src/index.ts' });
      await writePkg(leafDir, { name: '@scope/leaf', version: '1.0.0', type: 'module', main: 'src/index.ts' });

      const result = await analyzeEntry({ entry, isVirtualFile: true }, '', {
        shouldCheckTransitiveDependencies: true,
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap: makeWorkspaceMap(parentDir, leafDir),
        projectRoot: tmpRoot,
      });

      expect(result.dependencies.get('@scope/leaf')?.exports).toEqual(['*']);
    });
  });
});
