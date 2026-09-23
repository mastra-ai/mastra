import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { noopLogger } from '@mastra/core/logger';
import { readFile } from 'fs-extra';
import { resolveModule } from 'local-pkg';
import { rollup } from 'rollup';
import type * as RollupModule from 'rollup';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

vi.mock('local-pkg', async importOriginal => {
  const actual = await importOriginal<typeof import('local-pkg')>();
  return {
    ...actual,
    resolveModule: vi.fn(actual.resolveModule),
  };
});

describe('analyzeEntry', () => {
  beforeEach(() => {
    vi.mocked(rollup).mockClear();
    vi.mocked(resolveModule).mockClear();
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

  it('should transpile imported TypeScript files', async () => {
    const tempDir = await mkdtemp(join(import.meta.dirname, '__fixtures__', 'typescript-import-'));
    const entryFilePath = join(tempDir, 'entry.ts');
    await writeFile(entryFilePath, `import { value } from './dependency';\nconsole.log(value);`);
    await writeFile(join(tempDir, 'dependency.ts'), `export const value = process.env.NODE_ENV!;`);

    try {
      const result = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap: new Map(),
        projectRoot: process.cwd(),
      });

      expect(result.output.code).toContain('production');
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it.each([
    {
      name: 'production by default',
      env: undefined,
      includedDependency: '@mastra/core/logger',
      excludedDependency: '@mastra/core/agent',
    },
    {
      name: 'the provided environment',
      env: { 'process.env.NODE_ENV': JSON.stringify('development') },
      includedDependency: '@mastra/core/agent',
      excludedDependency: '@mastra/core/logger',
    },
  ])('should analyze only the $name branch', async ({ env, includedDependency, excludedDependency }) => {
    const tempDir = await mkdtemp(join(import.meta.dirname, '__fixtures__', 'node-env-'));
    const entryFilePath = join(tempDir, 'entry.ts');
    await writeFile(
      entryFilePath,
      `
        if (process.env.NODE_ENV === 'development') {
          await import('@mastra/core/agent');
        } else {
          await import('@mastra/core/logger');
        }
      `,
    );

    try {
      const result = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap: new Map(),
        projectRoot: process.cwd(),
        env,
      });

      expect(result.dependencies.has(includedDependency)).toBe(true);
      expect(result.dependencies.has(excludedDependency)).toBe(false);
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should not analyze explicitly externalized dependencies', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-analyze-external-'));
    const packageDir = join(root, 'node_modules', 'analysis-unsafe');
    const entryFilePath = join(root, 'entry.ts');

    try {
      await mkdir(packageDir, { recursive: true });
      await Promise.all([
        writeFile(
          join(packageDir, 'package.json'),
          JSON.stringify({
            name: 'analysis-unsafe',
            version: '1.0.0',
            type: 'module',
            exports: { './subpath': './subpath.js' },
          }),
        ),
        writeFile(join(packageDir, 'subpath.js'), 'export const broken = ;'),
        writeFile(entryFilePath, `import { broken } from 'analysis-unsafe/subpath';\nexport { broken };\n`),
      ]);

      const result = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap: new Map(),
        projectRoot: root,
        externals: ['analysis-unsafe'],
      });

      expect(result.dependencies.get('analysis-unsafe/subpath')?.exports).toEqual(['broken']);
      expect(result.output.code).toContain(`from 'analysis-unsafe/subpath'`);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('should resolve tsconfig aliases before applying the externals preset', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-analyze-tsconfig-alias-'));
    const srcDir = join(root, 'src');
    const entryFilePath = join(srcDir, 'entry.ts');

    try {
      await mkdir(srcDir, { recursive: true });
      await Promise.all([
        writeFile(join(root, 'tsconfig.json'), JSON.stringify({ compilerOptions: { paths: { '~/*': ['src/*'] } } })),
        writeFile(join(srcDir, 'value.ts'), 'export const value = 42;'),
        writeFile(entryFilePath, `import { value } from '~/value.js';\nexport { value };\n`),
      ]);

      const result = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap: new Map(),
        projectRoot: root,
        externalsPreset: true,
      });

      expect(result.dependencies.has('~')).toBe(false);
      expect(result.output.code).not.toContain('~/value.js');
      expect(result.output.code).toContain('42');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
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
    const actualLocalPkg = await vi.importActual<typeof import('local-pkg')>('local-pkg');

    vi.mocked(resolveModule).mockImplementation((id, options) => {
      if (id === '@internal/a') {
        return join(root, 'packages', 'a', 'src', 'index.ts');
      }
      if (id === '@internal/shared') {
        return join(root, 'packages', 'shared', 'src', 'index.ts');
      }
      return actualLocalPkg.resolveModule(id, options);
    });

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

    try {
      const analyzeCache = new Map();
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
          analyzeCache,
          externals: ['@internal/a'],
        },
      );

      expect(rollup).toHaveBeenCalledTimes(3);
      expect(result.dependencies.size).toBe(2);
      expect(result.dependencies.get('@internal/a')?.exports).toEqual(['a']);
      expect(result.dependencies.get('@internal/shared')?.exports).toEqual(['shared', 'shared2']);
      expect(analyzeCache.size).toBe(3);
    } finally {
      vi.mocked(resolveModule).mockImplementation(actualLocalPkg.resolveModule);
    }
  });

  it('should not re-analyze an entry that is active in the current dependency path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mastra-analyze-cycle-'));
    const entryFilePath = join(root, 'app.ts');
    const circularPackagePath = join(root, 'circular-a.ts');
    const actualLocalPkg = await vi.importActual<typeof import('local-pkg')>('local-pkg');

    await Promise.all([
      writeFile(
        entryFilePath,
        `import { circularA } from '@internal/circular-a';\nexport const circularApp = circularA;\n`,
      ),
      writeFile(
        circularPackagePath,
        `import { circularApp } from 'apps-mastra';\nexport const circularA = circularApp;\n`,
      ),
    ]);

    vi.mocked(resolveModule).mockImplementation((id, options) => {
      if (id === '@internal/circular-a') {
        return circularPackagePath;
      }
      if (id === 'apps-mastra') {
        return entryFilePath;
      }
      return actualLocalPkg.resolveModule(id, options);
    });

    const workspaceMap = new Map<string, WorkspacePackageInfo>([
      [
        '@internal/circular-a',
        {
          location: join(root, 'packages', 'a'),
          dependencies: { 'apps-mastra': '1.0.0' },
          version: '1.0.0',
        },
      ],
      [
        'apps-mastra',
        {
          location: join(root, 'apps', 'mastra'),
          dependencies: { '@internal/circular-a': '1.0.0' },
          version: '1.0.0',
        },
      ],
    ]);
    const analyzeCache = new Map();

    try {
      const result = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
        shouldCheckTransitiveDependencies: true,
        logger: noopLogger,
        sourcemapEnabled: false,
        workspaceMap,
        projectRoot: root,
        analyzeCache,
      });

      expect(result.dependencies.has('@internal/circular-a')).toBe(true);
      expect(result.dependencies.has('apps-mastra')).toBe(true);
      expect(rollup).toHaveBeenCalledTimes(2);
      expect(analyzeCache.size).toBe(2);
    } finally {
      vi.mocked(resolveModule).mockImplementation(actualLocalPkg.resolveModule);
      await rm(root, { recursive: true, force: true });
    }
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

  it('should cache direct and transitive analysis separately', async () => {
    const root = join(import.meta.dirname, '__fixtures__', 'nested-workspace');
    const entryFilePath = join(root, 'apps', 'mastra', 'src', 'shared-transitive.ts');
    const actualLocalPkg = await vi.importActual<typeof import('local-pkg')>('local-pkg');

    vi.mocked(resolveModule).mockImplementation((id, options) => {
      if (id === '@internal/a') {
        return join(root, 'packages', 'a', 'src', 'index.ts');
      }
      if (id === '@internal/b') {
        return join(root, 'packages', 'b', 'src', 'index.ts');
      }
      if (id === '@internal/shared') {
        return join(root, 'packages', 'shared', 'src', 'index.ts');
      }
      return actualLocalPkg.resolveModule(id, options);
    });

    const workspaceMap = new Map<string, WorkspacePackageInfo>([
      [
        '@internal/a',
        {
          location: join(root, 'packages', 'a'),
          dependencies: { '@internal/shared': '1.0.0' },
          version: '1.0.0',
        },
      ],
      [
        '@internal/b',
        {
          location: join(root, 'packages', 'b'),
          dependencies: { '@internal/shared': '1.0.0' },
          version: '1.0.0',
        },
      ],
      [
        '@internal/shared',
        {
          location: join(root, 'packages', 'shared'),
          dependencies: {},
          version: '1.0.0',
        },
      ],
    ]);
    const analyzeCache = new Map();
    const opts = {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap,
      projectRoot: root,
      analyzeCache,
    };

    try {
      const directResult = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', opts);
      const transitiveResult = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
        ...opts,
        shouldCheckTransitiveDependencies: true,
      });

      expect(directResult.dependencies.has('@internal/shared')).toBe(false);
      expect(transitiveResult.dependencies.get('@internal/shared')?.exports).toEqual(['shared', 'shared2']);
      expect(rollup).toHaveBeenCalledTimes(5);
      expect(analyzeCache.size).toBe(5);
    } finally {
      vi.mocked(resolveModule).mockImplementation(actualLocalPkg.resolveModule);
    }
  });

  it('should preserve actual subpath metadata without adding root or subpath facades for subpath-only transitive workspace packages', async () => {
    const root = join(import.meta.dirname, '__fixtures__', 'nested-workspace');
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
        '@internal/shared',
        {
          location: `${root}/packages/shared`,
          dependencies: {},
          version: '1.0.0',
          exports: {
            './value': './src/index.ts',
          },
        },
      ],
    ]);

    const result = await analyzeEntry(
      {
        entry: `
          import { a } from '@internal/a';
          import { shared } from '@internal/shared/value';

          export const value = a + ' ' + shared;
        `,
        isVirtualFile: true,
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

    expect(result.dependencies.get('@internal/a')?.exports).toEqual(['a']);
    expect(result.dependencies.get('@internal/shared/value')?.exports).toEqual(['shared']);
    expect(result.dependencies.has('@internal/shared')).toBe(false);
  });

  it('should discover shared transitive workspace packages without re-analyzing packages', async () => {
    const root = join(import.meta.dirname, '__fixtures__', 'nested-workspace');
    const entryFilePath = join(root, 'apps', 'mastra', 'src', 'shared-transitive.ts');
    vi.spyOn(process, 'cwd').mockReturnValue(join(root, 'apps', 'mastra'));
    const actualLocalPkg = await vi.importActual<typeof import('local-pkg')>('local-pkg');

    vi.mocked(resolveModule).mockImplementation((id, options) => {
      if (id === '@internal/a') {
        return join(root, 'packages', 'a', 'src', 'index.ts');
      }
      if (id === '@internal/b') {
        return join(root, 'packages', 'b', 'src', 'index.ts');
      }
      if (id === '@internal/shared') {
        return join(root, 'packages', 'shared', 'src', 'index.ts');
      }
      return actualLocalPkg.resolveModule(id, options);
    });

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

    try {
      const uncachedResult = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', baseOpts);
      const uncachedCalls = vi.mocked(rollup).mock.calls.length;

      expect(uncachedCalls).toBe(4);
      expect(uncachedResult.dependencies.size).toBe(3);
      expect(uncachedResult.dependencies.get('@internal/a')?.exports).toEqual(['a']);
      expect(uncachedResult.dependencies.get('@internal/b')?.exports).toEqual(['b']);
      expect(uncachedResult.dependencies.get('@internal/shared')?.exports).toEqual(['shared', 'shared2']);

      vi.mocked(rollup).mockClear();

      const analyzeCache = new Map();
      const cachedResult = await analyzeEntry({ entry: entryFilePath, isVirtualFile: false }, '', {
        ...baseOpts,
        analyzeCache,
      });
      const cachedCalls = vi.mocked(rollup).mock.calls.length;

      expect(cachedCalls).toBe(4);
      expect(cachedResult.dependencies.size).toBe(uncachedResult.dependencies.size);
      expect(cachedResult.dependencies.get('@internal/a')?.exports).toEqual(['a']);
      expect(cachedResult.dependencies.get('@internal/b')?.exports).toEqual(['b']);
      expect(cachedResult.dependencies.get('@internal/shared')?.exports).toEqual(['shared', 'shared2']);
      expect(analyzeCache.size).toBe(4);
    } finally {
      vi.mocked(resolveModule).mockImplementation(actualLocalPkg.resolveModule);
    }
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
});
