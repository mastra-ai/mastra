/**
 * MastraSandbox Base Class Tests
 *
 * Tests the abstract base class functionality including:
 * - MountManager creation based on mount() implementation
 * - Logger propagation to MountManager
 *
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { describe, it, expect, vi } from 'vitest';

import type { IMastraLogger } from '../../logger';
import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { MountResult } from '../filesystem/mount';
import type { ProviderStatus } from '../lifecycle';

import { MastraSandbox } from './mastra-sandbox';
import type { MastraSandboxOptions } from './mastra-sandbox';
import type { MountManager } from './mount-manager';

/**
 * Concrete implementation of MastraSandbox WITH mount() method.
 */
class MountableSandbox extends MastraSandbox {
  // Declare mounts as non-optional for this class
  declare readonly mounts: MountManager;

  readonly id = 'test-mountable-sandbox';
  readonly name = 'MountableSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  /** Track lifecycle calls for ordering verification */
  readonly calls: string[] = [];

  constructor(options?: MastraSandboxOptions) {
    super({ ...options, name: 'MountableSandbox' });
  }

  async start(): Promise<void> {
    this.calls.push('start');
  }

  async stop(): Promise<void> {
    this.calls.push('stop');
  }

  async destroy(): Promise<void> {
    this.calls.push('destroy');
  }

  async mount(_filesystem: WorkspaceFilesystem, mountPath: string): Promise<MountResult> {
    return { success: true, mountPath };
  }

  async unmount(_mountPath: string): Promise<void> {
    // no-op
  }

  async executeCommand(
    command: string,
    args?: string[],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return { exitCode: 0, stdout: `${command} ${args?.join(' ') || ''}`, stderr: '' };
  }
}

/**
 * Concrete implementation of MastraSandbox WITHOUT mount() method.
 */
class NonMountableSandbox extends MastraSandbox {
  readonly id = 'test-non-mountable-sandbox';
  readonly name = 'NonMountableSandbox';
  readonly provider = 'test';
  status: ProviderStatus = 'pending';

  constructor() {
    super({ name: 'NonMountableSandbox' });
  }

  async executeCommand(
    command: string,
    args?: string[],
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return { exitCode: 0, stdout: `${command} ${args?.join(' ') || ''}`, stderr: '' };
  }
}

/**
 * Create a mock logger for testing.
 */
function createMockLogger(): IMastraLogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  } as unknown as IMastraLogger;
}

describe('MastraSandbox Base Class', () => {
  describe('MountManager Creation', () => {
    it('constructor creates MountManager if mount() implemented', () => {
      const sandbox = new MountableSandbox();

      expect(sandbox.mounts).toBeDefined();
      expect(sandbox.mounts.entries).toBeInstanceOf(Map);
    });

    it('constructor does not create MountManager if mount() not implemented', () => {
      const sandbox = new NonMountableSandbox();

      expect(sandbox.mounts).toBeUndefined();
    });

    it('MountManager receives mount function bound to sandbox', async () => {
      const sandbox = new MountableSandbox();

      // Create a mock filesystem with getMountConfig
      const mockFilesystem = {
        id: 'test-fs',
        name: 'TestFS',
        provider: 'test',
        status: 'ready',
        getMountConfig: () => ({ type: 's3', bucket: 'test' }),
      } as unknown as WorkspaceFilesystem;

      // Add filesystem to mounts
      sandbox.mounts.add({ '/test': mockFilesystem });

      // Start sandbox to trigger processPending
      await sandbox._start();

      // The mount should have been processed
      expect(sandbox.mounts.get('/test')?.state).toBe('mounted');
    });
  });

  describe('Logger Propagation', () => {
    it('__setLogger propagates to MountManager', () => {
      const sandbox = new MountableSandbox();
      const mockLogger = createMockLogger();

      // Spy on MountManager's __setLogger
      const setLoggerSpy = vi.spyOn(sandbox.mounts, '__setLogger');

      sandbox.__setLogger(mockLogger);

      expect(setLoggerSpy).toHaveBeenCalledWith(mockLogger);
    });

    it('__setLogger does not error when mounts is undefined', () => {
      const sandbox = new NonMountableSandbox();
      const mockLogger = createMockLogger();

      // Should not throw
      expect(() => sandbox.__setLogger(mockLogger)).not.toThrow();
    });

    it('logger is available in subclass after __setLogger', () => {
      const sandbox = new MountableSandbox();
      const mockLogger = createMockLogger();

      sandbox.__setLogger(mockLogger);

      // Access the logger via a method that uses it
      // The sandbox's internal logger should now be the mock
      expect(sandbox['logger']).toBeDefined();
    });
  });

  describe('Lifecycle Methods', () => {
    it('_start() sets status to running', async () => {
      const sandbox = new MountableSandbox();

      expect(sandbox.status).toBe('pending');

      await sandbox._start();

      expect(sandbox.status).toBe('running');
    });

    it('_start() processes pending mounts after startup', async () => {
      const sandbox = new MountableSandbox();
      const mockFilesystem = {
        id: 'test-fs',
        name: 'TestFS',
        provider: 'test',
        status: 'ready',
        getMountConfig: () => ({ type: 's3', bucket: 'test' }),
      } as unknown as WorkspaceFilesystem;

      // Add pending mount before start
      sandbox.mounts.add({ '/data': mockFilesystem });

      expect(sandbox.mounts.get('/data')?.state).toBe('pending');

      await sandbox._start();

      // After start, mount should be processed
      expect(sandbox.mounts.get('/data')?.state).toBe('mounted');
    });

    it('_stop() sets status to stopped', async () => {
      const sandbox = new MountableSandbox();
      await sandbox._start();

      expect(sandbox.status).toBe('running');

      await sandbox._stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('_destroy() sets status to destroyed', async () => {
      const sandbox = new MountableSandbox();
      await sandbox._start();

      await sandbox._destroy();

      expect(sandbox.status).toBe('destroyed');
    });

    it('_start() on destroyed sandbox throws', async () => {
      const sandbox = new MountableSandbox();
      await sandbox._start();
      await sandbox._destroy();

      await expect(sandbox._start()).rejects.toThrow(/destroyed/);
    });
  });

  describe('Lifecycle Hooks', () => {
    it('onStart fires after sandbox is running', async () => {
      let statusDuringHook: ProviderStatus | undefined;

      const sandbox = new MountableSandbox({
        onStart: ({ sandbox: s }) => {
          statusDuringHook = s.status;
        },
      });

      await sandbox._start();

      expect(statusDuringHook).toBe('running');
    });

    it('onStart fires after start() but before mount processing', async () => {
      const sandbox = new MountableSandbox({
        onStart: () => {
          sandbox.calls.push('onStart');
        },
      });

      const processPendingSpy = vi.spyOn(sandbox.mounts, 'processPending').mockImplementation(async () => {
        sandbox.calls.push('processPending');
      });

      await sandbox._start();

      expect(sandbox.calls).toEqual(['start', 'onStart', 'processPending']);

      processPendingSpy.mockRestore();
    });

    it('onStop fires before stop()', async () => {
      const sandbox = new MountableSandbox({
        onStop: () => {
          sandbox.calls.push('onStop');
        },
      });

      await sandbox._start();
      sandbox.calls.length = 0; // reset after start

      await sandbox._stop();

      expect(sandbox.calls).toEqual(['onStop', 'stop']);
    });

    it('onDestroy fires before destroy()', async () => {
      const sandbox = new MountableSandbox({
        onDestroy: () => {
          sandbox.calls.push('onDestroy');
        },
      });

      await sandbox._start();
      sandbox.calls.length = 0;

      await sandbox._destroy();

      expect(sandbox.calls).toEqual(['onDestroy', 'destroy']);
    });

    it('hooks receive { sandbox } arg referencing the sandbox instance', async () => {
      let receivedArg: unknown;

      const sandbox = new MountableSandbox({
        onStart: arg => {
          receivedArg = arg;
        },
      });

      await sandbox._start();

      expect(receivedArg).toEqual({ sandbox });
    });

    it('async hooks are awaited before continuing', async () => {
      let sideEffect = false;

      const sandbox = new MountableSandbox({
        onStart: async () => {
          await new Promise(resolve => setTimeout(resolve, 50));
          sideEffect = true;
        },
      });

      await sandbox._start();

      expect(sideEffect).toBe(true);
    });

    it('onStart error is non-fatal (logged as warning)', async () => {
      const mockLogger = createMockLogger();
      const sandbox = new MountableSandbox({
        onStart: () => {
          throw new Error('onStart boom');
        },
      });
      sandbox.__setLogger(mockLogger);

      // onStart errors are caught and logged — they don't fail _start()
      await sandbox._start();
      expect(sandbox.status).toBe('running');
      expect(mockLogger.warn).toHaveBeenCalledWith('onStart callback failed', expect.any(Object));
    });

    it('onStop error sets status to error and propagates', async () => {
      const sandbox = new MountableSandbox({
        onStop: () => {
          throw new Error('onStop boom');
        },
      });

      await sandbox._start();
      await expect(sandbox._stop()).rejects.toThrow('onStop boom');
      expect(sandbox.status).toBe('error');
    });

    it('onDestroy error sets status to error and propagates', async () => {
      const sandbox = new MountableSandbox({
        onDestroy: () => {
          throw new Error('onDestroy boom');
        },
      });

      await sandbox._start();
      await expect(sandbox._destroy()).rejects.toThrow('onDestroy boom');
      expect(sandbox.status).toBe('error');
    });

    it('lifecycle methods work without hooks', async () => {
      const sandbox = new MountableSandbox(); // no hooks

      await sandbox._start();
      expect(sandbox.status).toBe('running');

      await sandbox._stop();
      expect(sandbox.status).toBe('stopped');
    });

    it('onStart hook can call sandbox methods', async () => {
      let commandResult: { exitCode: number; stdout: string } | undefined;

      const sandbox = new MountableSandbox({
        onStart: async ({ sandbox: s }) => {
          commandResult = await s.executeCommand!('echo', ['hello']);
        },
      });

      await sandbox._start();

      expect(commandResult).toBeDefined();
      expect(commandResult!.exitCode).toBe(0);
      expect(commandResult!.stdout).toContain('hello');
    });

    it('concurrent _start() calls only fire onStart once', async () => {
      let callCount = 0;

      const sandbox = new MountableSandbox({
        onStart: async () => {
          callCount++;
          // Simulate async work so both callers overlap
          await new Promise(resolve => setTimeout(resolve, 20));
        },
      });

      // Fire two concurrent _start() calls
      await Promise.all([sandbox._start(), sandbox._start()]);

      expect(callCount).toBe(1);
      expect(sandbox.status).toBe('running');
    });
  });
});
