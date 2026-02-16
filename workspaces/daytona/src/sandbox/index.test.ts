/**
 * Daytona Sandbox Provider Tests
 *
 * Tests Daytona-specific functionality including:
 * - Constructor options and ID generation
 * - Race condition prevention in start()
 * - Environment variable handling
 * - Command execution
 * - Lifecycle operations
 * - Error handling and retry logic
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { createSandboxLifecycleTests } from '@internal/workspace-test-utils';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';

import { DaytonaSandbox } from './index';

// Use vi.hoisted to define mocks before vi.mock is hoisted
const { mockSandbox, mockDaytona, resetMockDefaults, DaytonaNotFoundError } = vi.hoisted(() => {
  const mockSandbox = {
    id: 'mock-sandbox-id',
    state: 'started',
    process: {
      executeCommand: vi.fn().mockResolvedValue({ exitCode: 0, result: '', artifacts: { stdout: '' } }),
      codeRun: vi.fn().mockResolvedValue({ exitCode: 0, result: '', artifacts: { stdout: '' } }),
    },
    fs: {
      uploadFile: vi.fn().mockResolvedValue(undefined),
      downloadFile: vi.fn().mockResolvedValue(Buffer.from('')),
    },
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };

  const mockDaytona = {
    create: vi.fn().mockResolvedValue(mockSandbox),
    get: vi.fn().mockResolvedValue(mockSandbox),
    delete: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ items: [], total: 0 }),
  };

  const resetMockDefaults = () => {
    mockDaytona.create.mockResolvedValue(mockSandbox);
    mockDaytona.get.mockResolvedValue(mockSandbox);
    mockDaytona.delete.mockResolvedValue(undefined);
    mockDaytona.stop.mockResolvedValue(undefined);
    mockDaytona.start.mockResolvedValue(undefined);
    mockDaytona.list.mockResolvedValue({ items: [], total: 0 });
    mockSandbox.process.executeCommand.mockResolvedValue({ exitCode: 0, result: '', artifacts: { stdout: '' } });
    mockSandbox.start.mockResolvedValue(undefined);
    mockSandbox.stop.mockResolvedValue(undefined);
    mockSandbox.delete.mockResolvedValue(undefined);
  };

  class DaytonaNotFoundError extends Error {
    constructor(message?: string) {
      super(message ?? 'Not found');
      this.name = 'DaytonaNotFoundError';
    }
  }

  return { mockSandbox, mockDaytona, resetMockDefaults, DaytonaNotFoundError };
});

// Mock the Daytona SDK — must use `function` (not arrow) so `new Daytona()` works
vi.mock('@daytonaio/sdk', () => ({
  Daytona: vi.fn().mockImplementation(function () {
    return mockDaytona;
  }),
  DaytonaNotFoundError,
}));

describe('DaytonaSandbox', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetMockDefaults();
  });

  describe('Constructor & Options', () => {
    it('generates unique id if not provided', () => {
      const sandbox1 = new DaytonaSandbox();
      const sandbox2 = new DaytonaSandbox();

      expect(sandbox1.id).toMatch(/^daytona-sandbox-/);
      expect(sandbox2.id).toMatch(/^daytona-sandbox-/);
      expect(sandbox1.id).not.toBe(sandbox2.id);
    });

    it('uses provided id', () => {
      const sandbox = new DaytonaSandbox({ id: 'my-sandbox' });

      expect(sandbox.id).toBe('my-sandbox');
    });

    it('default timeout is 5 minutes', () => {
      const sandbox = new DaytonaSandbox();

      expect((sandbox as any).timeout).toBe(300_000);
    });

    it('has correct provider and name', () => {
      const sandbox = new DaytonaSandbox();

      expect(sandbox.provider).toBe('daytona');
      expect(sandbox.name).toBe('DaytonaSandbox');
    });

    it('default language is typescript', () => {
      const sandbox = new DaytonaSandbox();

      expect((sandbox as any).language).toBe('typescript');
    });

    it('accepts custom language', () => {
      const sandbox = new DaytonaSandbox({ language: 'python' });

      expect((sandbox as any).language).toBe('python');
    });

    it('stores resources config', () => {
      const sandbox = new DaytonaSandbox({
        resources: { cpu: 2, memory: 4, disk: 20, gpu: 1 },
      });

      expect((sandbox as any).resources).toEqual({ cpu: 2, memory: 4, disk: 20, gpu: 1 });
    });

    it('stores volume configs', () => {
      const sandbox = new DaytonaSandbox({
        volumes: [{ volumeId: 'vol-123', mountPath: '/data' }],
      });

      expect((sandbox as any).volumeConfigs).toEqual([{ volumeId: 'vol-123', mountPath: '/data' }]);
    });

    it('default ephemeral is false', () => {
      const sandbox = new DaytonaSandbox();

      expect((sandbox as any).ephemeral).toBe(false);
    });

    it('default autoStopInterval is 15', () => {
      const sandbox = new DaytonaSandbox();

      expect((sandbox as any).autoStopInterval).toBe(15);
    });

    it('stores connection options', () => {
      const sandbox = new DaytonaSandbox({
        apiKey: 'test-key',
        apiUrl: 'https://custom.api.io',
        target: 'us-east',
      });

      expect((sandbox as any).connectionOpts).toEqual({
        apiKey: 'test-key',
        apiUrl: 'https://custom.api.io',
        target: 'us-east',
      });
    });
  });

  describe('Start - Race Condition Prevention', () => {
    it('concurrent start() calls only create one sandbox', async () => {
      const sandbox = new DaytonaSandbox();

      // Fire two concurrent starts — only one should create a sandbox
      await Promise.all([sandbox._start(), sandbox._start()]);

      expect(mockDaytona.create).toHaveBeenCalledTimes(1);
    });

    it('start() is idempotent when already running', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      expect(mockDaytona.create).toHaveBeenCalledTimes(1);

      await sandbox._start();
      expect(mockDaytona.create).toHaveBeenCalledTimes(1);
    });

    it('status transitions through starting to running', async () => {
      const sandbox = new DaytonaSandbox();

      expect(sandbox.status).toBe('pending');

      await sandbox._start();

      expect(sandbox.status).toBe('running');
    });
  });

  describe('Start - Sandbox Creation', () => {
    it('creates new sandbox with correct params', async () => {
      const sandbox = new DaytonaSandbox({
        language: 'python',
        env: { FOO: 'bar' },
        labels: { team: 'ai' },
        ephemeral: true,
        autoStopInterval: 30,
      });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'python',
          envVars: { FOO: 'bar' },
          labels: expect.objectContaining({
            team: 'ai',
            'mastra-sandbox-id': sandbox.id,
          }),
          ephemeral: true,
          autoStopInterval: 30,
        }),
      );
    });

    it('passes snapshot when provided', async () => {
      const sandbox = new DaytonaSandbox({ snapshot: 'my-snapshot' });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          snapshot: 'my-snapshot',
        }),
      );
    });

    it('passes volumes when provided', async () => {
      const sandbox = new DaytonaSandbox({
        volumes: [{ volumeId: 'vol-1', mountPath: '/data' }],
      });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          volumes: [{ volumeId: 'vol-1', mountPath: '/data' }],
        }),
      );
    });

    it('passes resources when provided', async () => {
      const sandbox = new DaytonaSandbox({
        resources: { cpu: 4, memory: 8 },
      });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          resources: { cpu: 4, memory: 8 },
        }),
      );
    });

    it('passes autoArchiveInterval when provided', async () => {
      const sandbox = new DaytonaSandbox({ autoArchiveInterval: 60 });

      await sandbox._start();

      expect(mockDaytona.create).toHaveBeenCalledWith(
        expect.objectContaining({
          autoArchiveInterval: 60,
        }),
      );
    });

    it('creates Daytona client with connection opts', async () => {
      const { Daytona } = await import('@daytonaio/sdk');
      const sandbox = new DaytonaSandbox({
        apiKey: 'key-123',
        apiUrl: 'https://custom.api',
        target: 'eu-west',
      });

      await sandbox._start();

      expect(Daytona).toHaveBeenCalledWith({
        apiKey: 'key-123',
        apiUrl: 'https://custom.api',
        target: 'eu-west',
      });
    });
  });

  describe('Environment Variables', () => {
    it('merges sandbox env with per-command env', async () => {
      const sandbox = new DaytonaSandbox({
        env: { BASE: 'value', OVERRIDE: 'original' },
      });

      await sandbox._start();
      await sandbox.executeCommand('echo', ['test'], { env: { OVERRIDE: 'new', EXTRA: 'added' } });

      expect(mockSandbox.process.executeCommand).toHaveBeenCalledWith(
        'echo test',
        undefined,
        { BASE: 'value', OVERRIDE: 'new', EXTRA: 'added' },
        300, // default 300_000ms -> 300s
      );
    });

    it('per-command env overrides sandbox env', async () => {
      const sandbox = new DaytonaSandbox({
        env: { KEY: 'sandbox-value' },
      });

      await sandbox._start();
      await sandbox.executeCommand('echo', [], { env: { KEY: 'command-value' } });

      expect(mockSandbox.process.executeCommand).toHaveBeenCalledWith(
        'echo',
        undefined,
        { KEY: 'command-value' },
        300, // default 300_000ms -> 300s
      );
    });

    it('filters out undefined env values', async () => {
      const sandbox = new DaytonaSandbox({
        env: { KEEP: 'yes' },
      });

      await sandbox._start();
      await sandbox.executeCommand('echo', [], { env: { KEEP: 'yes', REMOVE: undefined } as any });

      const passedEnv = mockSandbox.process.executeCommand.mock.calls[0]![2];
      expect(passedEnv).toEqual({ KEEP: 'yes' });
    });
  });

  describe('Stop & Destroy', () => {
    it('stop calls daytona.stop()', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._stop();

      expect(mockDaytona.stop).toHaveBeenCalledWith(mockSandbox);
      expect(sandbox.status).toBe('stopped');
    });

    it('destroy calls daytona.delete()', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._destroy();

      expect(mockDaytona.delete).toHaveBeenCalledWith(mockSandbox);
      expect(sandbox.status).toBe('destroyed');
    });

    it('destroy clears internal state', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._destroy();

      expect((sandbox as any)._sandbox).toBeNull();
      expect((sandbox as any)._daytona).toBeNull();
    });

    it('stop handles errors gracefully', async () => {
      mockDaytona.stop.mockRejectedValue(new Error('Already stopped'));
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      // Should not throw
      await sandbox._stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('destroy handles errors gracefully', async () => {
      mockDaytona.delete.mockRejectedValue(new Error('Already deleted'));
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._destroy();

      expect(sandbox.status).toBe('destroyed');
    });
  });

  describe('getInfo()', () => {
    it('returns correct sandbox info', async () => {
      const sandbox = new DaytonaSandbox({
        id: 'test-info',
        language: 'python',
        resources: { cpu: 2, memory: 4 },
      });

      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.id).toBe('test-info');
      expect(info.name).toBe('DaytonaSandbox');
      expect(info.provider).toBe('daytona');
      expect(info.status).toBe('running');
      expect(info.createdAt).toBeInstanceOf(Date);
      expect(info.metadata).toEqual(
        expect.objectContaining({
          language: 'python',
          resources: { cpu: 2, memory: 4 },
        }),
      );
    });

    it('includes snapshot in metadata when set', async () => {
      const sandbox = new DaytonaSandbox({ snapshot: 'snap-123' });

      await sandbox._start();
      const info = await sandbox.getInfo();

      expect(info.metadata?.snapshot).toBe('snap-123');
    });
  });

  describe('getInstructions()', () => {
    it('returns description string', () => {
      const sandbox = new DaytonaSandbox();
      const instructions = sandbox.getInstructions();

      expect(typeof instructions).toBe('string');
      expect(instructions).toContain('Cloud sandbox');
    });

    it('includes language info for non-typescript', () => {
      const sandbox = new DaytonaSandbox({ language: 'python' });
      const instructions = sandbox.getInstructions();

      expect(instructions).toContain('python');
    });

    it('includes volume count when volumes attached', () => {
      const sandbox = new DaytonaSandbox({
        volumes: [
          { volumeId: 'v1', mountPath: '/a' },
          { volumeId: 'v2', mountPath: '/b' },
        ],
      });
      const instructions = sandbox.getInstructions();

      expect(instructions).toContain('2 volume(s)');
    });
  });

  describe('isReady()', () => {
    it('returns false when not started', async () => {
      const sandbox = new DaytonaSandbox();

      expect(await sandbox.isReady()).toBe(false);
    });

    it('returns true when running', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();

      expect(await sandbox.isReady()).toBe(true);
    });

    it('returns false after stop', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();
      await sandbox._stop();

      expect(await sandbox.isReady()).toBe(false);
    });
  });

  describe('instance accessor', () => {
    it('throws SandboxNotReadyError when not started', () => {
      const sandbox = new DaytonaSandbox();

      expect(() => sandbox.instance).toThrow('Sandbox is not ready');
    });

    it('returns sandbox when started', async () => {
      const sandbox = new DaytonaSandbox();

      await sandbox._start();

      expect(sandbox.instance).toBe(mockSandbox);
    });
  });

  describe('Command Execution', () => {
    it('executes command and returns result', async () => {
      mockSandbox.process.executeCommand.mockResolvedValue({
        exitCode: 0,
        result: 'hello world',
        artifacts: { stdout: 'hello world' },
      });

      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const result = await sandbox.executeCommand('echo', ['hello', 'world']);

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toBe('hello world');
      expect(result.command).toBe('echo');
      expect(result.args).toEqual(['hello', 'world']);
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('handles non-zero exit code', async () => {
      mockSandbox.process.executeCommand.mockResolvedValue({
        exitCode: 1,
        result: '',
        artifacts: { stdout: '' },
      });

      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      const result = await sandbox.executeCommand('false');

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(1);
    });

    it('passes working directory', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      await sandbox.executeCommand('ls', [], { cwd: '/tmp' });

      expect(mockSandbox.process.executeCommand).toHaveBeenCalledWith(
        'ls',
        '/tmp',
        expect.any(Object),
        300, // default 300_000ms -> 300s
      );
    });

    it('converts timeout from ms to seconds', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      await sandbox.executeCommand('sleep', ['10'], { timeout: 5000 });

      expect(mockSandbox.process.executeCommand).toHaveBeenCalledWith(
        'sleep 10',
        undefined,
        expect.any(Object),
        5, // 5000ms -> 5s
      );
    });

    it('quotes args with special characters', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      await sandbox.executeCommand('echo', ['hello world', "it's"]);

      const calledCommand = mockSandbox.process.executeCommand.mock.calls[0]![0];
      expect(calledCommand).toBe("echo 'hello world' 'it'\\''s'");
    });

    it('auto-starts sandbox if not running', async () => {
      const sandbox = new DaytonaSandbox();

      // executeCommand should trigger start
      await sandbox.executeCommand('echo', ['test']);

      expect(mockDaytona.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Handling & Retry', () => {
    it('retries once on sandbox-dead error', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      // First call: sandbox dead error
      mockSandbox.process.executeCommand
        .mockRejectedValueOnce(new Error('sandbox was not found'))
        .mockResolvedValueOnce({ exitCode: 0, result: 'success', artifacts: { stdout: 'success' } });

      const result = await sandbox.executeCommand('echo', ['test']);

      expect(result.success).toBe(true);
      expect(result.stdout).toBe('success');
      // create called twice: initial + retry
      expect(mockDaytona.create).toHaveBeenCalledTimes(2);
    });

    it('does not retry infinitely', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      // Both calls fail with sandbox dead
      mockSandbox.process.executeCommand.mockRejectedValue(new Error('sandbox was not found'));

      const result = await sandbox.executeCommand('echo', ['test']);

      // Should fail after one retry
      expect(result.success).toBe(false);
      expect(result.stderr).toContain('sandbox was not found');
    });

    it('does not retry on regular execution errors', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      mockSandbox.process.executeCommand.mockRejectedValue(new Error('command failed'));

      const result = await sandbox.executeCommand('bad-command');

      expect(result.success).toBe(false);
      expect(mockDaytona.create).toHaveBeenCalledTimes(1); // No retry
    });

    it('isSandboxDeadError detects known patterns', () => {
      const sandbox = new DaytonaSandbox();

      // SDK error class (preferred detection)
      expect((sandbox as any).isSandboxDeadError(new DaytonaNotFoundError('gone'))).toBe(true);
      // String-based fallbacks
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox was not found'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('Sandbox not found'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox is not running'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('Sandbox not running'))).toBe(true);
      expect((sandbox as any).isSandboxDeadError(new Error('sandbox has been deleted'))).toBe(true);
      // Non-dead errors
      expect((sandbox as any).isSandboxDeadError(new Error('timeout'))).toBe(false);
      expect((sandbox as any).isSandboxDeadError(null)).toBe(false);
    });

    it('handleSandboxTimeout clears state', async () => {
      const sandbox = new DaytonaSandbox();
      await sandbox._start();

      (sandbox as any).handleSandboxTimeout();

      expect((sandbox as any)._sandbox).toBeNull();
      expect(sandbox.status).toBe('stopped');
    });
  });

  describe('Shared Conformance', () => {
    let conformanceSandbox: DaytonaSandbox;

    beforeAll(async () => {
      conformanceSandbox = new DaytonaSandbox({ id: `conformance-${Date.now()}` });
      await conformanceSandbox._start();
    });

    afterAll(async () => {
      if (conformanceSandbox) await conformanceSandbox._destroy();
    });

    createSandboxLifecycleTests(() => ({
      sandbox: conformanceSandbox as any,
      capabilities: {
        supportsMounting: false,
        supportsReconnection: false,
        supportsConcurrency: false,
        supportsEnvVars: true,
        supportsWorkingDirectory: true,
        supportsTimeout: true,
        defaultCommandTimeout: 300000,
        supportsStreaming: false,
      },
      testTimeout: 30000,
      fastOnly: true,
      createSandbox: () => new DaytonaSandbox(),
    }));
  });
});
