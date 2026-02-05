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

  constructor() {
    super({ name: 'MountableSandbox' });
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
      await sandbox.start();

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
    it('start() sets status to running', async () => {
      const sandbox = new MountableSandbox();

      expect(sandbox.status).toBe('pending');

      await sandbox.start();

      expect(sandbox.status).toBe('running');
    });

    it('start() processes pending mounts after startup', async () => {
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

      await sandbox.start();

      // After start, mount should be processed
      expect(sandbox.mounts.get('/data')?.state).toBe('mounted');
    });

    it('stop() sets status to stopped', async () => {
      const sandbox = new MountableSandbox();
      await sandbox.start();

      expect(sandbox.status).toBe('running');

      await sandbox.stop();

      expect(sandbox.status).toBe('stopped');
    });

    it('destroy() sets status to destroyed', async () => {
      const sandbox = new MountableSandbox();
      await sandbox.start();

      await sandbox.destroy();

      expect(sandbox.status).toBe('destroyed');
    });
  });
});
