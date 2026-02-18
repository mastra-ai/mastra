/**
 * MountManager unit tests.
 *
 * Tests the mount state management, config hashing, and processing logic.
 * Based on the Workspace Filesystem & Sandbox Test Plan.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

import type { WorkspaceFilesystem } from '../filesystem/filesystem';
import type { FilesystemMountConfig } from '../filesystem/mount';

import { MountManager } from './mount-manager';
import type { OnMountHook } from './mount-manager';

/**
 * Create a mock filesystem for testing.
 */
function createMockFilesystem(
  overrides: Partial<WorkspaceFilesystem> & { getMountConfig?: () => FilesystemMountConfig } = {},
): WorkspaceFilesystem {
  return {
    id: `mock-fs-${Date.now()}`,
    name: 'MockFilesystem',
    provider: 'mock',
    status: 'ready',
    readFile: vi.fn(),
    writeFile: vi.fn(),
    appendFile: vi.fn(),
    deleteFile: vi.fn(),
    copyFile: vi.fn(),
    moveFile: vi.fn(),
    mkdir: vi.fn(),
    rmdir: vi.fn(),
    readdir: vi.fn(),
    exists: vi.fn(),
    stat: vi.fn(),
    ...overrides,
  } as unknown as WorkspaceFilesystem;
}

/**
 * Create a mock logger for testing.
 */
function createMockLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('MountManager', () => {
  let mountManager: MountManager;
  let mockMountFn: ReturnType<typeof vi.fn>;
  let mockLogger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    mockMountFn = vi.fn().mockResolvedValue({ success: true, mountPath: '/test' });
    mockLogger = createMockLogger();
    mountManager = new MountManager({
      mount: mockMountFn,
      logger: mockLogger as any,
    });
  });

  describe('Entry Management', () => {
    it('add() creates pending entries for filesystems', () => {
      const fs1 = createMockFilesystem({ id: 'fs-1' });
      const fs2 = createMockFilesystem({ id: 'fs-2' });

      mountManager.add({
        '/data': fs1,
        '/config': fs2,
      });

      expect(mountManager.has('/data')).toBe(true);
      expect(mountManager.has('/config')).toBe(true);
      expect(mountManager.get('/data')?.state).toBe('pending');
      expect(mountManager.get('/config')?.state).toBe('pending');
    });

    it('set() updates existing entry state', () => {
      const fs = createMockFilesystem();
      mountManager.add({ '/data': fs });

      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      mountManager.set('/data', { state: 'mounted', config });

      const entry = mountManager.get('/data');
      expect(entry?.state).toBe('mounted');
      expect(entry?.config).toEqual(config);
      expect(entry?.configHash).toBeDefined();
    });

    it('set() creates new entry if filesystem provided', () => {
      const fs = createMockFilesystem({ id: 'new-fs' });
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };

      mountManager.set('/new-path', {
        filesystem: fs,
        state: 'mounting',
        config,
      });

      expect(mountManager.has('/new-path')).toBe(true);
      expect(mountManager.get('/new-path')?.state).toBe('mounting');
    });

    it('get() returns entry by path', () => {
      const fs = createMockFilesystem({ id: 'get-test' });
      mountManager.add({ '/data': fs });

      const entry = mountManager.get('/data');
      expect(entry).toBeDefined();
      expect(entry?.filesystem.id).toBe('get-test');
    });

    it('has() checks entry existence', () => {
      const fs = createMockFilesystem();
      mountManager.add({ '/data': fs });

      expect(mountManager.has('/data')).toBe(true);
      expect(mountManager.has('/other')).toBe(false);
    });

    it('delete() removes entry', () => {
      const fs = createMockFilesystem();
      mountManager.add({ '/data': fs });

      expect(mountManager.has('/data')).toBe(true);
      mountManager.delete('/data');
      expect(mountManager.has('/data')).toBe(false);
    });

    it('clear() removes all entries', () => {
      const fs1 = createMockFilesystem();
      const fs2 = createMockFilesystem();
      mountManager.add({ '/data': fs1, '/config': fs2 });

      expect(mountManager.entries.size).toBe(2);
      mountManager.clear();
      expect(mountManager.entries.size).toBe(0);
    });
  });

  describe('Config Hashing', () => {
    it('hashConfig produces consistent hash for same config', () => {
      const fs = createMockFilesystem();
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test', region: 'us-east-1' };

      mountManager.add({ '/data': fs });
      mountManager.set('/data', { state: 'mounted', config });
      const hash1 = mountManager.get('/data')?.configHash;

      // Create new manager and set same config
      const mountManager2 = new MountManager({ mount: mockMountFn, logger: mockLogger as any });
      mountManager2.add({ '/data': fs });
      mountManager2.set('/data', { state: 'mounted', config });
      const hash2 = mountManager2.get('/data')?.configHash;

      expect(hash1).toBe(hash2);
    });

    it('hashConfig changes when any field changes', () => {
      const fs = createMockFilesystem();
      const config1: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const config2: FilesystemMountConfig = { type: 's3', bucket: 'different' };
      const config3: FilesystemMountConfig = { type: 'gcs', bucket: 'test' };

      mountManager.add({ '/path1': fs, '/path2': fs, '/path3': fs });
      mountManager.set('/path1', { state: 'mounted', config: config1 });
      mountManager.set('/path2', { state: 'mounted', config: config2 });
      mountManager.set('/path3', { state: 'mounted', config: config3 });

      const hash1 = mountManager.get('/path1')?.configHash;
      const hash2 = mountManager.get('/path2')?.configHash;
      const hash3 = mountManager.get('/path3')?.configHash;

      expect(hash1).not.toBe(hash2); // Different bucket
      expect(hash1).not.toBe(hash3); // Different type
    });

    it('hashConfig changes when credentials change', () => {
      const fs = createMockFilesystem();
      const configNoCreds: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const configWithCreds: FilesystemMountConfig = {
        type: 's3',
        bucket: 'test',
        accessKeyId: 'AKIA',
        secretAccessKey: 'secret',
      } as FilesystemMountConfig;

      mountManager.add({ '/path1': fs, '/path2': fs });
      mountManager.set('/path1', { state: 'mounted', config: configNoCreds });
      mountManager.set('/path2', { state: 'mounted', config: configWithCreds });

      expect(mountManager.get('/path1')?.configHash).not.toBe(mountManager.get('/path2')?.configHash);
    });

    it('hashConfig changes when readOnly changes', () => {
      const fs = createMockFilesystem();
      const configWritable: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const configReadOnly: FilesystemMountConfig = {
        type: 's3',
        bucket: 'test',
        readOnly: true,
      } as FilesystemMountConfig;

      mountManager.add({ '/path1': fs, '/path2': fs });
      mountManager.set('/path1', { state: 'mounted', config: configWritable });
      mountManager.set('/path2', { state: 'mounted', config: configReadOnly });

      expect(mountManager.get('/path1')?.configHash).not.toBe(mountManager.get('/path2')?.configHash);
    });

    it('hashConfig is order-independent for object keys', () => {
      const fs = createMockFilesystem();
      const config1 = { type: 's3', bucket: 'test', region: 'us-east-1' } as FilesystemMountConfig;
      const config2 = { region: 'us-east-1', type: 's3', bucket: 'test' } as FilesystemMountConfig;

      mountManager.add({ '/path1': fs, '/path2': fs });
      mountManager.set('/path1', { state: 'mounted', config: config1 });
      mountManager.set('/path2', { state: 'mounted', config: config2 });

      const hash1 = mountManager.get('/path1')?.configHash;
      const hash2 = mountManager.get('/path2')?.configHash;

      expect(hash1).toBe(hash2);
    });
  });

  describe('Processing Pending Mounts', () => {
    it('processPending() calls mount for each pending entry', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs1 = createMockFilesystem({ getMountConfig: () => config });
      const fs2 = createMockFilesystem({ getMountConfig: () => config });
      const fs3 = createMockFilesystem({ getMountConfig: () => config });

      mountManager.add({ '/path1': fs1, '/path2': fs2, '/path3': fs3 });

      await mountManager.processPending();

      expect(mockMountFn).toHaveBeenCalledTimes(3);
    });

    it('processPending() skips non-pending entries', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs1 = createMockFilesystem({ getMountConfig: () => config });
      const fs2 = createMockFilesystem({ getMountConfig: () => config });
      const fs3 = createMockFilesystem({ getMountConfig: () => config });

      mountManager.add({ '/path1': fs1, '/path2': fs2, '/path3': fs3 });
      mountManager.set('/path2', { state: 'mounted', config });
      mountManager.set('/path3', { state: 'error', error: 'test error' });

      await mountManager.processPending();

      // Only fs1 should be mounted (pending), fs2 and fs3 are not pending
      expect(mockMountFn).toHaveBeenCalledTimes(1);
    });

    it('processPending() skips filesystems without getMountConfig', async () => {
      const fs = createMockFilesystem(); // No getMountConfig

      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mockMountFn).not.toHaveBeenCalled();
      expect(mountManager.get('/path')?.state).toBe('unsupported');
      expect(mountManager.get('/path')?.error).toBe('Filesystem does not support mounting');
    });

    it('processPending() handles mount errors gracefully', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs1 = createMockFilesystem({ getMountConfig: () => config });
      const fs2 = createMockFilesystem({ getMountConfig: () => config });

      mountManager.add({ '/path1': fs1, '/path2': fs2 });

      // First mount fails, second succeeds
      mockMountFn
        .mockResolvedValueOnce({ success: false, error: 'Mount failed' })
        .mockResolvedValueOnce({ success: true, mountPath: '/path2' });

      await mountManager.processPending();

      expect(mountManager.get('/path1')?.state).toBe('error');
      expect(mountManager.get('/path1')?.error).toBe('Mount failed');
      expect(mountManager.get('/path2')?.state).toBe('mounted');
    });

    it('processPending() sets state to mounting before mount call', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      let stateWhileMounting: string | undefined;
      mockMountFn.mockImplementation(async () => {
        stateWhileMounting = mountManager.get('/path')?.state;
        return { success: true, mountPath: '/path' };
      });

      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(stateWhileMounting).toBe('mounting');
    });

    it('processPending() sets state to mounted on success', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      mockMountFn.mockResolvedValue({ success: true, mountPath: '/path' });

      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mountManager.get('/path')?.state).toBe('mounted');
    });

    it('processPending() sets state to error on failure', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      mockMountFn.mockResolvedValue({ success: false, error: 'Test error' });

      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mountManager.get('/path')?.state).toBe('error');
      expect(mountManager.get('/path')?.error).toBe('Test error');
    });
  });

  describe('onMount Hook Integration', () => {
    it('onMount hook is called before default mount with correct arguments', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      const hookOrder: string[] = [];
      const onMount: OnMountHook = vi.fn(_args => {
        hookOrder.push('hook');
        return undefined; // Continue to default
      });

      mockMountFn.mockImplementation(async () => {
        hookOrder.push('mount');
        return { success: true, mountPath: '/path' };
      });

      mountManager.setOnMount(onMount);
      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(hookOrder).toEqual(['hook', 'mount']);

      // Verify hook received correct arguments
      expect(onMount).toHaveBeenCalledWith(
        expect.objectContaining({
          filesystem: fs,
          mountPath: '/path',
          config,
        }),
      );
    });

    it('onMount hook returning false skips mount entirely', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      const onMount: OnMountHook = () => false;

      mountManager.setOnMount(onMount);
      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mockMountFn).not.toHaveBeenCalled();
      expect(mountManager.get('/path')?.state).toBe('unsupported');
      expect(mountManager.get('/path')?.error).toBe('Skipped by onMount hook');
    });

    it('onMount hook returning { success: true } marks as mounted', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      const onMount: OnMountHook = () => ({ success: true });

      mountManager.setOnMount(onMount);
      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mockMountFn).not.toHaveBeenCalled();
      expect(mountManager.get('/path')?.state).toBe('mounted');
    });

    it('onMount hook returning { success: false, error } marks as error', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      const onMount: OnMountHook = () => ({ success: false, error: 'custom error' });

      mountManager.setOnMount(onMount);
      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mockMountFn).not.toHaveBeenCalled();
      expect(mountManager.get('/path')?.state).toBe('error');
      expect(mountManager.get('/path')?.error).toBe('custom error');
    });

    it('onMount hook returning void/undefined continues to default', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      const onMount: OnMountHook = () => undefined;

      mountManager.setOnMount(onMount);
      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mockMountFn).toHaveBeenCalled();
    });

    it('onMount hook errors are caught and reported', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      const onMount: OnMountHook = () => {
        throw new Error('hook failed');
      };

      mountManager.setOnMount(onMount);
      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mockMountFn).not.toHaveBeenCalled();
      expect(mountManager.get('/path')?.state).toBe('error');
      expect(mountManager.get('/path')?.error).toContain('hook failed');
    });
  });

  describe('Logger Integration', () => {
    it('__setLogger updates internal logger', () => {
      const newLogger = createMockLogger();
      mountManager.__setLogger(newLogger as any);

      const fs = createMockFilesystem();
      mountManager.add({ '/path': fs });

      expect(newLogger.debug).toHaveBeenCalled();
    });

    it('logs debug message when adding mounts', () => {
      const fs = createMockFilesystem();
      mountManager.add({ '/path1': fs, '/path2': fs });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Adding 2 pending mount(s)'),
        expect.objectContaining({ paths: ['/path1', '/path2'] }),
      );
    });

    it('logs debug message when processing pending', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });
      mountManager.add({ '/path': fs });

      await mountManager.processPending();

      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('Processing 1 pending mount(s)'));
    });

    it('logs info on successful mount', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      mockMountFn.mockResolvedValue({ success: true, mountPath: '/path' });

      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mockLogger.info).toHaveBeenCalledWith(expect.stringContaining('successful'), expect.any(Object));
    });

    it('logs error on failed mount', async () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      mockMountFn.mockResolvedValue({ success: false, error: 'Test error' });

      mountManager.add({ '/path': fs });
      await mountManager.processPending();

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('failed'), expect.any(Object));
    });
  });

  describe('Marker File Helpers', () => {
    it('markerFilename generates consistent filename for path', () => {
      const filename1 = mountManager.markerFilename('/data/bucket-1');
      const filename2 = mountManager.markerFilename('/data/bucket-1');

      expect(filename1).toBe(filename2);
      expect(filename1).toMatch(/^mount-[a-z0-9]+$/);
    });

    it('markerFilename generates different filenames for different paths', () => {
      const filename1 = mountManager.markerFilename('/data/bucket-1');
      const filename2 = mountManager.markerFilename('/data/bucket-2');

      expect(filename1).not.toBe(filename2);
    });

    it('getMarkerContent returns path|configHash format', () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      mountManager.add({ '/data': fs });
      mountManager.set('/data', { state: 'mounted', config });

      const content = mountManager.getMarkerContent('/data');

      expect(content).toMatch(/^\/data\|[a-f0-9]+$/);
    });

    it('getMarkerContent returns null if no config hash', () => {
      const fs = createMockFilesystem();
      mountManager.add({ '/data': fs });

      const content = mountManager.getMarkerContent('/data');

      expect(content).toBeNull();
    });

    it('parseMarkerContent extracts path and configHash', () => {
      const parsed = mountManager.parseMarkerContent('/data/path|abc123def');

      expect(parsed).toEqual({
        path: '/data/path',
        configHash: 'abc123def',
      });
    });

    it('parseMarkerContent returns null for invalid format', () => {
      expect(mountManager.parseMarkerContent('invalid')).toBeNull();
      expect(mountManager.parseMarkerContent('/path')).toBeNull();
      expect(mountManager.parseMarkerContent('')).toBeNull();
    });

    it('isConfigMatching compares current config hash with stored', () => {
      const config: FilesystemMountConfig = { type: 's3', bucket: 'test' };
      const fs = createMockFilesystem({ getMountConfig: () => config });

      mountManager.add({ '/data': fs });
      mountManager.set('/data', { state: 'mounted', config });

      const hash = mountManager.get('/data')!.configHash!;

      expect(mountManager.isConfigMatching('/data', hash)).toBe(true);
      expect(mountManager.isConfigMatching('/data', 'different-hash')).toBe(false);
    });
  });
});
