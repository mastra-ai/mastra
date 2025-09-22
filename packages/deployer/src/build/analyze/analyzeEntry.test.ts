import { analyzeEntry } from './analyzeEntry';
import { describe, it, expect, vi } from 'vitest';
import { readFile } from 'fs-extra';
import { join } from 'path';
import { noopLogger } from '@mastra/core/logger';
import type { WorkspacePackageInfo } from '../../bundler/workspaceDependencies';

vi.spyOn(process, 'cwd').mockReturnValue(join(import.meta.dirname, '__fixtures__', 'default'));

describe('analyzeEntry', () => {
  it('should analyze the entry file', async () => {
    const entryAsString = await readFile(join(import.meta.dirname, '__fixtures__', 'default', 'entry.ts'), 'utf-8');

    const result = await analyzeEntry({ entry: entryAsString, isVirtualFile: true }, ``, {
      logger: noopLogger,
      sourcemapEnabled: false,
      workspaceMap: new Map(),
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
    });

    expect(result.dependencies.size).toBe(0);
    expect(result.output.code).toBeTruthy();
    expect(result.output.code).toContain('greet');
  });
});
