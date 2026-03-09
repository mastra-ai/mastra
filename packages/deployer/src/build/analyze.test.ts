import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import type { IMastraLogger } from '@mastra/core/logger';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeBundle } from './analyze';
import { slash } from './utils';

const { analyzeEntryMock, bundleExternalsMock, getWorkspaceInformationMock } = vi.hoisted(() => ({
  analyzeEntryMock: vi.fn(),
  bundleExternalsMock: vi.fn(),
  getWorkspaceInformationMock: vi.fn(),
}));

vi.mock('./analyze/analyzeEntry', () => ({
  analyzeEntry: analyzeEntryMock,
}));

vi.mock('./analyze/bundleExternals', () => ({
  bundleExternals: bundleExternalsMock,
}));

vi.mock('../bundler/workspaceDependencies', () => ({
  getWorkspaceInformation: getWorkspaceInformationMock,
}));

describe('workspace path normalization (issue #13022)', () => {
  it('should normalize backslashes so startsWith matches rollup imports', () => {
    const rollupImport = 'apps/@agents/devstudio/.mastra/.build/chunk-ILQXPZCD.mjs';
    const windowsPath = 'apps\\@agents\\devstudio';

    expect(rollupImport.startsWith(windowsPath)).toBe(false);
    expect(rollupImport.startsWith(slash(windowsPath))).toBe(true);
  });
});

describe('dependency optimization cache (issue #13379)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should skip expensive dependency optimization on repeated build runs with unchanged inputs', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'mastra-analyze-cache-'));

    try {
      const entryFile = join(testRoot, 'src', 'entry.ts');
      const mastraEntry = join(testRoot, 'src', 'mastra.ts');
      const outputDir = join(testRoot, '.mastra', '.build');

      await mkdir(dirname(entryFile), { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(entryFile, 'export const value = 1;');
      await writeFile(mastraEntry, 'export const mastra = {};');

      getWorkspaceInformationMock.mockResolvedValue({
        workspaceMap: new Map(),
        workspaceRoot: undefined,
      });

      analyzeEntryMock.mockResolvedValue({
        output: { code: 'export const analyzed = true;' },
        dependencies: new Map([
          [
            'lodash',
            {
              exports: ['map'],
              rootPath: '/node_modules/lodash',
              isWorkspace: false,
              version: '4.17.21',
            },
          ],
        ]),
      });

      bundleExternalsMock.mockImplementation(
        async (_depsToOptimize: Map<string, unknown>, _outDir: string, options) => {
          const optimizedFile = '.mastra/.build/lodash.mjs';
          const optimizedEntryName = '.mastra/.build/lodash';
          await mkdir(join(options.projectRoot, '.mastra', '.build'), { recursive: true });
          await writeFile(join(options.projectRoot, optimizedFile), 'export const map = () => {};');

          return {
            output: [
              {
                type: 'chunk',
                isEntry: true,
                isDynamicEntry: true,
                name: optimizedEntryName,
                fileName: optimizedFile,
                imports: [],
              },
            ],
            fileNameToDependencyMap: new Map([[optimizedEntryName, 'lodash']]),
            usedExternals: {},
          };
        },
      );

      const logger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as IMastraLogger;

      const firstRun = await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot: testRoot,
          platform: 'node',
        },
        logger,
      );

      const secondRun = await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot: testRoot,
          platform: 'node',
        },
        logger,
      );

      expect(bundleExternalsMock).toHaveBeenCalledTimes(1);
      expect(firstRun.dependencies.get('lodash')).toBe('.mastra/.build/lodash.mjs');
      expect(secondRun.dependencies.get('lodash')).toBe('.mastra/.build/lodash.mjs');
      expect(logger.info).toHaveBeenCalledWith('Optimizing dependencies... (cache hit)');
    } finally {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  it('should detect cached optimized files correctly when workspaceRoot differs from projectRoot', async () => {
    const workspaceRoot = await mkdtemp(join(tmpdir(), 'mastra-analyze-workspace-cache-'));

    try {
      const projectRoot = join(workspaceRoot, 'apps', 'api');
      const entryFile = join(projectRoot, 'src', 'entry.ts');
      const mastraEntry = join(projectRoot, 'src', 'mastra.ts');
      const outputDir = join(projectRoot, '.mastra', '.build');

      await mkdir(dirname(entryFile), { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(entryFile, 'export const value = 1;');
      await writeFile(mastraEntry, 'export const mastra = {};');

      getWorkspaceInformationMock.mockResolvedValue({
        workspaceMap: new Map(),
        workspaceRoot,
      });

      analyzeEntryMock.mockResolvedValue({
        output: { code: 'export const analyzed = true;' },
        dependencies: new Map([
          [
            'lodash',
            {
              exports: ['map'],
              rootPath: '/node_modules/lodash',
              isWorkspace: false,
              version: '4.17.21',
            },
          ],
        ]),
      });

      bundleExternalsMock.mockImplementation(async () => {
        const optimizedFile = 'apps/api/.mastra/.build/lodash.mjs';
        const optimizedEntryName = 'apps/api/.mastra/.build/lodash';
        await mkdir(join(workspaceRoot, 'apps', 'api', '.mastra', '.build'), { recursive: true });
        await writeFile(join(workspaceRoot, optimizedFile), 'export const map = () => {};');

        return {
          output: [
            {
              type: 'chunk',
              isEntry: true,
              isDynamicEntry: true,
              name: optimizedEntryName,
              fileName: optimizedFile,
              imports: [],
            },
          ],
          fileNameToDependencyMap: new Map([[optimizedEntryName, 'lodash']]),
          usedExternals: {},
        };
      });

      const logger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as IMastraLogger;

      await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot,
          platform: 'node',
        },
        logger,
      );

      await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot,
          platform: 'node',
        },
        logger,
      );

      expect(bundleExternalsMock).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith('Optimizing dependencies... (cache hit)');
    } finally {
      await rm(workspaceRoot, { recursive: true, force: true });
    }
  });

  it('should invalidate cache when enableSourcemap changes', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'mastra-analyze-sourcemap-cache-'));

    try {
      const entryFile = join(testRoot, 'src', 'entry.ts');
      const mastraEntry = join(testRoot, 'src', 'mastra.ts');
      const outputDir = join(testRoot, '.mastra', '.build');

      await mkdir(dirname(entryFile), { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(entryFile, 'export const value = 1;');
      await writeFile(mastraEntry, 'export const mastra = {};');

      getWorkspaceInformationMock.mockResolvedValue({
        workspaceMap: new Map(),
        workspaceRoot: undefined,
      });

      analyzeEntryMock.mockResolvedValue({
        output: { code: 'export const analyzed = true;' },
        dependencies: new Map([
          [
            'lodash',
            {
              exports: ['map'],
              rootPath: '/node_modules/lodash',
              isWorkspace: false,
              version: '4.17.21',
            },
          ],
        ]),
      });

      bundleExternalsMock.mockImplementation(
        async (_depsToOptimize: Map<string, unknown>, _outDir: string, options) => {
          const optimizedFile = '.mastra/.build/lodash.mjs';
          const optimizedEntryName = '.mastra/.build/lodash';
          await mkdir(join(options.projectRoot, '.mastra', '.build'), { recursive: true });
          await writeFile(join(options.projectRoot, optimizedFile), 'export const map = () => {};');

          return {
            output: [
              {
                type: 'chunk',
                isEntry: true,
                isDynamicEntry: true,
                name: optimizedEntryName,
                fileName: optimizedFile,
                imports: [],
              },
            ],
            fileNameToDependencyMap: new Map([[optimizedEntryName, 'lodash']]),
            usedExternals: {},
          };
        },
      );

      const logger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as IMastraLogger;

      await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot: testRoot,
          platform: 'node',
          bundlerOptions: {
            externals: false,
            enableSourcemap: false,
          },
        },
        logger,
      );

      await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot: testRoot,
          platform: 'node',
          bundlerOptions: {
            externals: false,
            enableSourcemap: true,
          },
        },
        logger,
      );

      expect(bundleExternalsMock).toHaveBeenCalledTimes(2);
    } finally {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  it('should invalidate cache when optimized dependency version changes', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'mastra-analyze-dep-version-cache-'));

    try {
      const entryFile = join(testRoot, 'src', 'entry.ts');
      const mastraEntry = join(testRoot, 'src', 'mastra.ts');
      const outputDir = join(testRoot, '.mastra', '.build');

      await mkdir(dirname(entryFile), { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(entryFile, 'export const value = 1;');
      await writeFile(mastraEntry, 'export const mastra = {};');

      getWorkspaceInformationMock.mockResolvedValue({
        workspaceMap: new Map(),
        workspaceRoot: undefined,
      });

      analyzeEntryMock
        .mockResolvedValueOnce({
          output: { code: 'export const analyzed = true;' },
          dependencies: new Map([
            [
              'lodash',
              {
                exports: ['map'],
                rootPath: '/node_modules/lodash',
                isWorkspace: false,
                version: '4.17.20',
              },
            ],
          ]),
        })
        .mockResolvedValueOnce({
          output: { code: 'export const analyzed = true;' },
          dependencies: new Map([
            [
              'lodash',
              {
                exports: ['map'],
                rootPath: '/node_modules/lodash',
                isWorkspace: false,
                version: '4.17.21',
              },
            ],
          ]),
        });

      bundleExternalsMock.mockImplementation(
        async (_depsToOptimize: Map<string, unknown>, _outDir: string, options) => {
          const optimizedFile = '.mastra/.build/lodash.mjs';
          const optimizedEntryName = '.mastra/.build/lodash';
          await mkdir(join(options.projectRoot, '.mastra', '.build'), { recursive: true });
          await writeFile(join(options.projectRoot, optimizedFile), 'export const map = () => {};');

          return {
            output: [
              {
                type: 'chunk',
                isEntry: true,
                isDynamicEntry: true,
                name: optimizedEntryName,
                fileName: optimizedFile,
                imports: [],
              },
            ],
            fileNameToDependencyMap: new Map([[optimizedEntryName, 'lodash']]),
            usedExternals: {},
          };
        },
      );

      const logger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as IMastraLogger;

      await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot: testRoot,
          platform: 'node',
        },
        logger,
      );

      await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot: testRoot,
          platform: 'node',
        },
        logger,
      );

      expect(bundleExternalsMock).toHaveBeenCalledTimes(2);
      expect(logger.info).not.toHaveBeenCalledWith('Optimizing dependencies... (cache hit)');
    } finally {
      await rm(testRoot, { recursive: true, force: true });
    }
  });

  it('should invalidate cache when external dependency version changes', async () => {
    const testRoot = await mkdtemp(join(tmpdir(), 'mastra-analyze-external-version-cache-'));

    try {
      const entryFile = join(testRoot, 'src', 'entry.ts');
      const mastraEntry = join(testRoot, 'src', 'mastra.ts');
      const outputDir = join(testRoot, '.mastra', '.build');

      await mkdir(dirname(entryFile), { recursive: true });
      await mkdir(outputDir, { recursive: true });
      await writeFile(entryFile, 'export const value = 1;');
      await writeFile(mastraEntry, 'export const mastra = {};');

      getWorkspaceInformationMock.mockResolvedValue({
        workspaceMap: new Map(),
        workspaceRoot: undefined,
      });

      analyzeEntryMock
        .mockResolvedValueOnce({
          output: { code: 'export const analyzed = true;' },
          dependencies: new Map([
            [
              'lodash',
              {
                exports: ['map'],
                rootPath: '/node_modules/lodash',
                isWorkspace: false,
                version: '4.17.21',
              },
            ],
            [
              'external-lib',
              {
                exports: ['*'],
                rootPath: '/node_modules/external-lib',
                isWorkspace: false,
                version: '1.0.0',
              },
            ],
          ]),
        })
        .mockResolvedValueOnce({
          output: { code: 'export const analyzed = true;' },
          dependencies: new Map([
            [
              'lodash',
              {
                exports: ['map'],
                rootPath: '/node_modules/lodash',
                isWorkspace: false,
                version: '4.17.21',
              },
            ],
            [
              'external-lib',
              {
                exports: ['*'],
                rootPath: '/node_modules/external-lib',
                isWorkspace: false,
                version: '2.0.0',
              },
            ],
          ]),
        });

      bundleExternalsMock.mockImplementation(
        async (_depsToOptimize: Map<string, unknown>, _outDir: string, options) => {
          const optimizedFile = '.mastra/.build/lodash.mjs';
          const optimizedEntryName = '.mastra/.build/lodash';
          await mkdir(join(options.projectRoot, '.mastra', '.build'), { recursive: true });
          await writeFile(join(options.projectRoot, optimizedFile), 'export const map = () => {};');

          return {
            output: [
              {
                type: 'chunk',
                isEntry: true,
                isDynamicEntry: true,
                name: optimizedEntryName,
                fileName: optimizedFile,
                imports: [],
              },
            ],
            fileNameToDependencyMap: new Map([[optimizedEntryName, 'lodash']]),
            usedExternals: {},
          };
        },
      );

      const logger = {
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as unknown as IMastraLogger;

      await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot: testRoot,
          platform: 'node',
          bundlerOptions: {
            externals: ['external-lib'],
            enableSourcemap: false,
          },
        },
        logger,
      );

      await analyzeBundle(
        [entryFile],
        mastraEntry,
        {
          outputDir,
          projectRoot: testRoot,
          platform: 'node',
          bundlerOptions: {
            externals: ['external-lib'],
            enableSourcemap: false,
          },
        },
        logger,
      );

      expect(bundleExternalsMock).toHaveBeenCalledTimes(2);
    } finally {
      await rm(testRoot, { recursive: true, force: true });
    }
  });
});
