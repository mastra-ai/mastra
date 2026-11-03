import { join } from 'node:path';
import { remove } from 'fs-extra/esm';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DevBundler } from './DevBundler';

// Mock process.exit and process.argv to avoid CLI triggering
const mockExit = vi.hoisted(() => vi.fn());
vi.stubGlobal('process', {
  ...process,
  exit: mockExit,
  argv: ['node', 'test'], // Override command line args
});

// Mock commander to prevent CLI from running
vi.mock('commander', () => {
  // Use a class for the Command constructor mock (Vitest v4 requirement)
  class CommandMock {
    name: any;
    version: any;
    addHelpText: any;
    action: any;
    argument: any;
    addArgument: any;
    command: any;
    alias: any;
    description: any;
    option: any;
    requiredOption: any;
    parseAsync: any;
    help: any;

    constructor() {
      this.name = vi.fn().mockReturnThis();
      this.version = vi.fn().mockReturnThis();
      this.addHelpText = vi.fn().mockReturnThis();
      this.action = vi.fn().mockReturnThis();
      this.argument = vi.fn().mockReturnThis();
      this.addArgument = vi.fn().mockReturnThis();
      this.command = vi.fn().mockReturnThis();
      this.alias = vi.fn().mockReturnThis();
      this.description = vi.fn().mockReturnThis();
      this.option = vi.fn().mockReturnThis();
      this.addOption = vi.fn().mockReturnThis();
      this.requiredOption = vi.fn().mockReturnThis();
      this.parseAsync = vi.fn().mockResolvedValue(undefined);
      this.help = vi.fn();
    }
  }

  class ArgumentMock {
    choices = vi.fn().mockReturnThis();
    default = vi.fn().mockReturnThis();
  }

  class OptionMock {
    hideHelp = vi.fn().mockReturnThis();
  }

  return {
    Command: CommandMock,
    Argument: ArgumentMock,
    Option: OptionMock,
  };
});
const getExistingFiles = vi.hoisted(() => vi.fn((files: string[]) => files));

vi.mock('@mastra/deployer/build', () => {
  return {
    createWatcher: vi.fn().mockResolvedValue({
      on: vi.fn().mockImplementation((event, cb) => {
        if (event === 'event') {
          setTimeout(() => cb({ code: 'BUNDLE_END' }), 0);
        }
      }),
      off: vi.fn(),
    }),
    discoverFsAgents: vi.fn().mockResolvedValue([]),
    getWatcherInputOptions: vi.fn().mockResolvedValue({ plugins: [] }),
    prepareFsAgentsEntry: vi.fn(),
    writeFsAgentsEntry: vi.fn(),
    FileService: class {
      getExistingFiles = getExistingFiles;
    },
  };
});

vi.mock('@mastra/deployer', () => ({
  FileService: class {
    getExistingFiles = getExistingFiles;
  },
}));

vi.mock('fs-extra', () => {
  return {
    pathExists: vi.fn().mockResolvedValue(false),
    copy: vi.fn().mockResolvedValue(undefined),
    emptyDir: vi.fn().mockResolvedValue(undefined),
    ensureDir: vi.fn().mockResolvedValue(undefined),
  };
});

// Import DevBundler after mocks

describe('DevBundler', () => {
  const originalEnv = process.env.NODE_ENV;
  const originalExit = process.exit;

  beforeEach(() => {
    vi.clearAllMocks();
    getExistingFiles.mockImplementation((files: string[]) => files);
    // Mock process.exit to prevent it from actually exiting during tests
    process.exit = vi.fn() as any;
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    process.exit = originalExit;
  });

  describe('prepare', () => {
    it('preserves dev.lock across emptyDir', async () => {
      const { writeFile, readFile, mkdir, rm } = await import('node:fs/promises');
      const { join } = await import('node:path');

      const tmpDir = '.test-tmp-prepare-dev';
      const lockPath = join(tmpDir, 'dev.lock');
      const lockData = JSON.stringify({ pid: 12345, host: 'localhost', port: 4111 });

      try {
        await mkdir(tmpDir, { recursive: true });
        await writeFile(lockPath, lockData, 'utf-8');

        const devBundler = new DevBundler();
        await devBundler.prepare(tmpDir);

        // The lock file still exists with the same contents after prepare()
        const restored = await readFile(lockPath, 'utf-8');
        expect(restored).toBe(lockData);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('works when no dev.lock exists', async () => {
      const { rm } = await import('node:fs/promises');
      const devBundler = new DevBundler();
      const tmpDir = '.test-tmp-prepare-nolock-dev';

      try {
        await devBundler.prepare(tmpDir);
        // Should not throw even without a lock file
        expect(true).toBe(true);
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('copies Studio assets in non-Factory mode', async () => {
      const fsExtra = await import('fs-extra');
      const devBundler = new DevBundler();
      const tmpDir = '.test-tmp-prepare-studio-copy';

      try {
        await devBundler.prepare(tmpDir);
        expect(fsExtra.copy).toHaveBeenCalledWith(
          expect.stringContaining('studio'),
          expect.stringContaining('studio'),
          expect.any(Object),
        );
      } finally {
        const { rm } = await import('node:fs/promises');
        await rm(tmpDir, { recursive: true, force: true });
      }
    });

    it('skips Studio assets in Factory mode', async () => {
      const fsExtra = await import('fs-extra');
      const devBundler = new DevBundler(undefined, true);
      const tmpDir = '.test-tmp-prepare-studio-skip';

      try {
        await devBundler.prepare(tmpDir);
        expect(fsExtra.copy).not.toHaveBeenCalled();
      } finally {
        const { rm } = await import('node:fs/promises');
        await rm(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('getEnvFiles', () => {
    it('layers default dotenv files from base to development override', async () => {
      const bundler = new DevBundler();

      await expect(bundler.getEnvFiles()).resolves.toEqual(['.env', '.env.local', '.env.development']);
    });

    it('uses only an explicit env file', async () => {
      const bundler = new DevBundler('.env.custom');

      await expect(bundler.getEnvFiles()).resolves.toEqual(['.env.custom']);
    });

    it('falls back to layered defaults when an explicit env file does not exist', async () => {
      getExistingFiles.mockImplementation((files: string[]) => (files[0] === '.env.custom' ? [] : files));
      const bundler = new DevBundler('.env.custom');

      await expect(bundler.getEnvFiles()).resolves.toEqual(['.env', '.env.local', '.env.development']);
    });
  });

  describe('watch', () => {
    it('should use NODE_ENV from environment when available', async () => {
      // Arrange
      process.env.NODE_ENV = 'test-env';
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      const tmpDir = '.test-tmp';
      try {
        // Act
        await devBundler.watch('test-entry.js', tmpDir, []);

        // Assert
        expect(getWatcherInputOptions).toHaveBeenCalledWith(
          'test-entry.js',
          'node',
          {
            'process.env.NODE_ENV': JSON.stringify('test-env'),
          },
          expect.objectContaining({ sourcemap: false }),
        );
      } finally {
        await remove(tmpDir);
      }
    });

    it('should default to development when NODE_ENV is not set', async () => {
      // Arrange
      delete process.env.NODE_ENV;
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      // Act
      const tmpDir = '.test-tmp';
      await devBundler.watch('test-entry.js', tmpDir, []);
      try {
        // Assert
        expect(getWatcherInputOptions).toHaveBeenCalledWith(
          'test-entry.js',
          'node',
          {
            'process.env.NODE_ENV': JSON.stringify('development'),
          },
          expect.objectContaining({ sourcemap: false }),
        );
      } finally {
        await remove(tmpDir);
      }
    });

    it('writes analysis output under the provided output directory, not the cwd', async () => {
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');

      const tmpDir = '.test-tmp-root/.mastra';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

        const options = vi.mocked(getWatcherInputOptions).mock.lastCall?.[3];
        expect(options?.outputDir).toBe(join(tmpDir, '.build'));
      } finally {
        await remove('.test-tmp-root');
      }
    });

    // `mastra dev` reads the server config alongside the analysis. A failed read must not leave a watcher running
    // (it would keep the process alive), and the build must not write the output directory the read imports from.
    it('creates the watcher only after startAfter settles, and not at all when it fails', async () => {
      const devBundler = new DevBundler();
      const { createWatcher, getWatcherInputOptions } = await import('@mastra/deployer/build');
      const configError = new Error('server config failed');
      let rejectStartAfter!: (error: Error) => void;
      const startAfter = new Promise<void>((_resolve, reject) => (rejectStartAfter = reject));

      const tmpDir = '.test-tmp-start-after';
      try {
        const watching = devBundler.watch('test-entry.js', tmpDir, [], undefined, { startAfter });
        await vi.waitFor(() => expect(getWatcherInputOptions).toHaveBeenCalled());
        expect(createWatcher).not.toHaveBeenCalled();

        rejectStartAfter(configError);
        await expect(watching).rejects.toBe(configError);
        expect(createWatcher).not.toHaveBeenCalled();

        await devBundler.watch('test-entry.js', tmpDir, [], undefined, { startAfter: Promise.resolve() });
        expect(createWatcher).toHaveBeenCalledTimes(1);
      } finally {
        await remove(tmpDir);
      }
    });

    it('reports failed workspace package checks without failing the watch', async () => {
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');
      const { devLogger } = await import('../../utils/dev-logger.js');
      const errorSpy = vi.spyOn(devLogger, 'error').mockImplementation(() => {});

      const tmpDir = '.test-tmp-validation';
      try {
        await devBundler.watch('test-entry.js', tmpDir, []);

        const { onValidationError } = vi.mocked(getWatcherInputOptions).mock.lastCall![3]!;
        onValidationError!(new Error('We found an error in the @internal/broken workspace package.'));
        expect(errorSpy).toHaveBeenCalledWith('We found an error in the @internal/broken workspace package.');
      } finally {
        errorSpy.mockRestore();
        await remove(tmpDir);
      }
    });

    it('analyzes tool files so workspace packages keep exports only tools import', async () => {
      const devBundler = new DevBundler();
      const { getWatcherInputOptions } = await import('@mastra/deployer/build');
      vi.spyOn(devBundler, 'listToolsInputOptions').mockResolvedValue({
        'tools/abc': '/project/src/mastra/tools/weather.ts',
      });

      const tmpDir = '.test-tmp';
      try {
        await devBundler.watch('test-entry.js', tmpDir, ['/project/src/mastra/tools/**']);

        const options = vi.mocked(getWatcherInputOptions).mock.lastCall?.[3];
        expect(options?.analysisEntries).toEqual(
          expect.arrayContaining(['test-entry.js', '/project/src/mastra/tools/weather.ts']),
        );
      } finally {
        await remove(tmpDir);
      }
    });

    it('watches file-based agent instructions and regenerates the wrapper when source changes before rebuilds', async () => {
      const devBundler = new DevBundler();
      const { createWatcher, discoverFsAgents, prepareFsAgentsEntry, writeFsAgentsEntry } =
        await import('@mastra/deployer/build');
      vi.mocked(discoverFsAgents).mockResolvedValue([
        {
          name: 'weather',
          configPath: '/project/src/mastra/agents/weather/config.ts',
          instructionsPath: '/project/src/mastra/agents/weather/instructions.md',
          workspacePath: undefined,
          workspaceSeedDir: undefined,
          memoryPath: undefined,
          tools: [],
          skills: [],
          inputProcessors: [],
          outputProcessors: [],
          scorers: [],
          subagents: [],
        },
      ] as any);
      const nextEntry = {
        entryFile: '/project/.mastra/.mastra-fs-agents-entry.mjs',
        standalone: false,
        toolPaths: [],
        agentCount: 1,
        workflowCount: 0,
        hasStorage: false,
        hasObservability: false,
        hasLogger: false,
        hasServer: false,
        hasStudio: false,
        moduleSource: 'next source',
      };
      vi.mocked(prepareFsAgentsEntry).mockResolvedValue(nextEntry);

      const tmpDir = '.test-tmp';
      await devBundler.watch('test-entry.js', tmpDir, [], {
        mastraDir: '/project/src/mastra',
        userEntryFile: '/project/src/mastra/index.ts',
        outputDirectory: '/project/.mastra',
        preparedEntry: {
          ...nextEntry,
          moduleSource: 'old source',
        },
      });

      try {
        const input = vi.mocked(createWatcher).mock.calls[0]![0] as any;
        const plugin = input.plugins.find((candidate: any) => candidate?.name === 'fs-routing-watcher');
        const addWatchFile = vi.fn();

        await plugin.buildStart.call({ addWatchFile });

        expect(addWatchFile).toHaveBeenCalledWith('/project/src/mastra/agents/weather/instructions.md');
        expect(prepareFsAgentsEntry).toHaveBeenCalledWith(
          '/project/src/mastra',
          '/project/src/mastra/index.ts',
          '/project/.mastra',
        );
        expect(writeFsAgentsEntry).toHaveBeenCalledWith(nextEntry);
      } finally {
        await remove(tmpDir);
      }
    });

    it('selects dev.entry.js template in non-Factory mode', async () => {
      const devBundler = new DevBundler();
      const { createWatcher } = await import('@mastra/deployer/build');
      const tmpDir = '.test-tmp';

      try {
        await devBundler.watch('test-entry.js', tmpDir, []);
        const input = vi.mocked(createWatcher).mock.calls[0]![0] as any;
        expect(input.input.index).toContain('dev.entry.js');
        expect(input.input.index).not.toContain('factory-dev');
      } finally {
        await remove(tmpDir);
      }
    });

    it('enables circular dependency checks and only reports cycles that involve user code', async () => {
      const devBundler = new DevBundler();
      const { createWatcher } = await import('@mastra/deployer/build');
      const warn = vi.spyOn((devBundler as any).logger, 'warn').mockImplementation(() => {});
      const tmpDir = '.test-tmp';

      try {
        await devBundler.watch('test-entry.js', tmpDir, []);
        const input = vi.mocked(createWatcher).mock.calls[0]![0] as any;
        expect(input.checks).toEqual(expect.objectContaining({ circularDependency: true }));

        const defaultHandler = vi.fn();
        const userA = join(process.cwd(), 'src', 'a.ts');
        const userB = join(process.cwd(), 'src', 'b.ts');
        input.onLog(
          'warn',
          {
            code: 'CIRCULAR_DEPENDENCY',
            message: '\u001b[33m[CIRCULAR_DEPENDENCY] \u001b[0mCircular dependency: a.ts -> b.ts -> a.ts.\n',
            ids: [userA, userB, userA],
          },
          defaultHandler,
        );
        expect(warn).toHaveBeenCalledWith('Circular dependency found', {
          dependency: [join('src', 'a.ts'), join('src', 'b.ts'), join('src', 'a.ts')].join(' -> '),
        });

        warn.mockClear();
        input.onLog(
          'warn',
          {
            code: 'CIRCULAR_DEPENDENCY',
            message: 'Circular dependency',
            ids: ['/project/node_modules/x/a.js', '/project/node_modules/x/b.js', '/project/node_modules/x/a.js'],
          },
          defaultHandler,
        );
        input.onLog('warn', { code: 'EVAL', message: 'eval' }, defaultHandler);
        expect(warn).not.toHaveBeenCalled();
        expect(defaultHandler).not.toHaveBeenCalled();

        const infoLog = { code: 'SOMETHING', message: 'info' };
        input.onLog('info', infoLog, defaultHandler);
        expect(defaultHandler).toHaveBeenCalledWith('info', infoLog);
      } finally {
        await remove(tmpDir);
      }
    });

    it('does not make rolldown skip listeners registered after the initial bundle listener', async () => {
      const { createWatcher } = await import('@mastra/deployer/build');
      // Mirrors rolldown's WatcherEmitter: listeners are awaited in order and off() splices the array.
      const listeners: Array<(event: { code: string }) => unknown> = [];
      const watcher = {
        on: vi.fn((_event: string, cb: (event: { code: string }) => unknown) => {
          listeners.push(cb);
          return watcher;
        }),
        off: vi.fn((_event: string, cb: (event: { code: string }) => unknown) => {
          const index = listeners.indexOf(cb);
          if (index !== -1) listeners.splice(index, 1);
          return watcher;
        }),
      };
      vi.mocked(createWatcher).mockResolvedValueOnce(watcher as any);
      const emit = async (event: { code: string }) => {
        for (const listener of listeners) await listener(event);
      };

      const devBundler = new DevBundler();
      const tmpDir = '.test-tmp';
      try {
        const watchPromise = devBundler.watch('test-entry.js', tmpDir, []);
        await vi.waitFor(() => expect(listeners).toHaveLength(1));

        const laterListener = vi.fn();
        listeners.push(laterListener);
        await emit({ code: 'BUNDLE_END' });

        await expect(watchPromise).resolves.toBe(watcher);
        expect(laterListener).toHaveBeenCalledWith({ code: 'BUNDLE_END' });
        await vi.waitFor(() => expect(listeners).toEqual([laterListener]));
      } finally {
        await remove(tmpDir);
      }
    });

    it('selects factory-dev.entry.js template in Factory mode', async () => {
      const devBundler = new DevBundler(undefined, true);
      const { createWatcher } = await import('@mastra/deployer/build');
      const tmpDir = '.test-tmp';

      try {
        await devBundler.watch('test-entry.js', tmpDir, []);
        const input = vi.mocked(createWatcher).mock.calls[0]![0] as any;
        expect(input.input.index).toContain('factory-dev.entry.js');
      } finally {
        await remove(tmpDir);
      }
    });
  });

  describe('entry templates', () => {
    async function readTemplate(name: string): Promise<string> {
      const { readFile } = await import('node:fs/promises');
      const { join, dirname } = await import('node:path');
      const { fileURLToPath } = await import('node:url');
      const testDir = dirname(fileURLToPath(import.meta.url));
      return readFile(join(testDir, '..', '..', 'public', 'templates', name), 'utf-8');
    }

    it('factory-dev.entry.js passes studio: false to createNodeServer', async () => {
      const content = await readTemplate('factory-dev.entry.js');
      expect(content).toContain('studio: false');
      expect(content).not.toMatch(/studio:\s*true/);
    });

    it('dev.entry.js passes studio: true to createNodeServer', async () => {
      const content = await readTemplate('dev.entry.js');
      expect(content).toContain('studio: true');
    });
  });
});
