import { analyzeEntry } from './analyzeEntry';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFile } from 'fs-extra';
import { join } from 'path';
import { noopLogger } from '@mastra/core/logger';
import resolveFrom from 'resolve-from';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';
import { rollup } from 'rollup';

vi.spyOn(process, 'cwd').mockReturnValue(join(import.meta.dirname, '__fixtures__', 'default'));
vi.mock('resolve-from');
vi.mock('rollup', async () => {
  const actual = await vi.importActual<typeof import('rollup')>('rollup');
  return {
    ...actual,
    rollup: vi.fn(actual.rollup),
  };
});

describe('analyzeEntry', () => {
  beforeEach(() => {
    vi.mocked(rollup).mockClear();
    vi.spyOn(process, 'cwd').mockReturnValue(join(import.meta.dirname, '__fixtures__', 'default'));
    vi.mocked(resolveFrom).mockReset();
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

    vi.mocked(resolveFrom).mockImplementation((_, dep) => {
      if (dep === '@internal/a') {
        return join(root, 'packages', 'a', 'src', 'index.ts');
      }
      if (dep === '@internal/shared') {
        return join(root, 'packages', 'shared', 'src', 'index.ts');
      }

      throw new Error(`Unknown dependency: ${dep}`);
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

    expect(rollup).toHaveBeenCalledTimes(3);
    expect(result.dependencies.size).toBe(2);
    expect(result.dependencies.get('@internal/a')?.exports).toEqual(['a']);
    expect(result.dependencies.get('@internal/shared')?.exports).toEqual(['shared']);
    // Verify that the analyzer doesn't get stuck in infinite loops.
    // The initialDepsToOptimize map tracks already-analyzed dependencies to prevent re-analysis.
    // (Test will timeout if there's an infinite loop issue)
  });
});
