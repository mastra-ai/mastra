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
    command: any;
    description: any;
    option: any;
    requiredOption: any;
    parse: any;
    help: any;

    constructor() {
      this.name = vi.fn().mockReturnThis();
      this.version = vi.fn().mockReturnThis();
      this.addHelpText = vi.fn().mockReturnThis();
      this.action = vi.fn().mockReturnThis();
      this.argument = vi.fn().mockReturnThis();
      this.command = vi.fn().mockReturnThis();
      this.description = vi.fn().mockReturnThis();
      this.option = vi.fn().mockReturnThis();
      this.requiredOption = vi.fn().mockReturnThis();
      this.parse = vi.fn();
      this.help = vi.fn();
    }
  }

  return {
    Command: CommandMock,
  };
});
// Don't reference top-level variables in mock definitions
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
  };
});

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
