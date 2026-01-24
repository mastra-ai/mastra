import type { ChildProcess } from 'node:child_process';

import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { LogCollector } from '../types';
import { ProcessManager } from './manager';

// Mock tree-kill
vi.mock('tree-kill', () => ({
  default: vi.fn((pid: number, signal: string, callback: (err?: Error) => void) => {
    callback();
  }),
}));

describe('ProcessManager', () => {
  let manager: ProcessManager;
  let mockProcess: ChildProcess;
  let mockLogCollector: LogCollector;

  beforeEach(() => {
    manager = new ProcessManager();
    vi.clearAllMocks();

    // Create mock process
    mockProcess = {
      pid: 12345,
      killed: false,
      exitCode: null,
      on: vi.fn(),
    } as unknown as ChildProcess;

    // Create mock log collector
    mockLogCollector = {
      append: vi.fn(),
      getAll: vi.fn(() => ''),
      getTail: vi.fn(() => ''),
      getSince: vi.fn(() => ''),
      stream: vi.fn(() => () => {}),
      clear: vi.fn(),
    };
  });

  describe('track', () => {
    it('should track a new process', () => {
      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);

      const tracked = manager.get('server-1');
      expect(tracked).toBeDefined();
      expect(tracked?.serverId).toBe('server-1');
      expect(tracked?.deploymentId).toBe('deployment-1');
      expect(tracked?.port).toBe(4111);
      expect(tracked?.process).toBe(mockProcess);
      expect(tracked?.logCollector).toBe(mockLogCollector);
    });

    it('should set startedAt to current time', () => {
      const before = new Date();
      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);
      const after = new Date();

      const tracked = manager.get('server-1');
      expect(tracked?.startedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(tracked?.startedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });

    it('should set up exit handler to remove process', () => {
      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);

      // Verify exit handler was registered
      expect(mockProcess.on).toHaveBeenCalledWith('exit', expect.any(Function));

      // Simulate exit
      const exitHandler = (mockProcess.on as ReturnType<typeof vi.fn>).mock.calls.find(
        call => call[0] === 'exit',
      )?.[1];
      exitHandler?.();

      // Process should be removed
      expect(manager.get('server-1')).toBeUndefined();
    });
  });

  describe('get', () => {
    it('should return undefined for non-existent server', () => {
      expect(manager.get('non-existent')).toBeUndefined();
    });

    it('should return tracked process by server ID', () => {
      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);

      const tracked = manager.get('server-1');
      expect(tracked?.serverId).toBe('server-1');
    });
  });

  describe('getByDeploymentId', () => {
    it('should return undefined for non-existent deployment', () => {
      expect(manager.getByDeploymentId('non-existent')).toBeUndefined();
    });

    it('should return tracked process by deployment ID', () => {
      manager.track('server-1', 'deployment-123', mockProcess, 4111, mockLogCollector);

      const tracked = manager.getByDeploymentId('deployment-123');
      expect(tracked?.deploymentId).toBe('deployment-123');
      expect(tracked?.serverId).toBe('server-1');
    });

    it('should search through all processes', () => {
      const mockProcess2 = { ...mockProcess, pid: 12346, on: vi.fn() } as unknown as ChildProcess;

      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);
      manager.track('server-2', 'deployment-2', mockProcess2, 4112, mockLogCollector);

      expect(manager.getByDeploymentId('deployment-2')?.serverId).toBe('server-2');
    });
  });

  describe('kill', () => {
    it('should do nothing for non-existent server', async () => {
      await expect(manager.kill('non-existent')).resolves.toBeUndefined();
    });

    it('should remove process without pid', async () => {
      const noPidProcess = { pid: undefined, killed: false, exitCode: null, on: vi.fn() } as unknown as ChildProcess;
      manager.track('server-1', 'deployment-1', noPidProcess, 4111, mockLogCollector);

      await manager.kill('server-1');

      expect(manager.get('server-1')).toBeUndefined();
    });

    it('should kill process with tree-kill', async () => {
      const treeKill = (await import('tree-kill')).default;
      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);

      await manager.kill('server-1');

      expect(treeKill).toHaveBeenCalledWith(12345, 'SIGTERM', expect.any(Function));
      expect(manager.get('server-1')).toBeUndefined();
    });

    it('should try SIGKILL on SIGTERM failure', async () => {
      const treeKill = (await import('tree-kill')).default;
      let callCount = 0;
      (treeKill as ReturnType<typeof vi.fn>).mockImplementation(
        (pid: number, signal: string, callback: (err?: Error) => void) => {
          callCount++;
          if (callCount === 1) {
            // First call (SIGTERM) fails
            callback(new Error('SIGTERM failed'));
          } else {
            // Second call (SIGKILL) succeeds
            callback();
          }
        },
      );

      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);

      await manager.kill('server-1');

      expect(treeKill).toHaveBeenCalledWith(12345, 'SIGTERM', expect.any(Function));
      expect(treeKill).toHaveBeenCalledWith(12345, 'SIGKILL', expect.any(Function));
      expect(manager.get('server-1')).toBeUndefined();
    });
  });

  describe('isRunning', () => {
    it('should return false for non-existent server', () => {
      expect(manager.isRunning('non-existent')).toBe(false);
    });

    it('should return true for running process', () => {
      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);

      expect(manager.isRunning('server-1')).toBe(true);
    });

    it('should return false for killed process', () => {
      const killedProcess = { ...mockProcess, killed: true, on: vi.fn() } as unknown as ChildProcess;
      manager.track('server-1', 'deployment-1', killedProcess, 4111, mockLogCollector);

      expect(manager.isRunning('server-1')).toBe(false);
    });

    it('should return false for exited process', () => {
      const exitedProcess = { ...mockProcess, exitCode: 0, on: vi.fn() } as unknown as ChildProcess;
      manager.track('server-1', 'deployment-1', exitedProcess, 4111, mockLogCollector);

      expect(manager.isRunning('server-1')).toBe(false);
    });
  });

  describe('getAll', () => {
    it('should return empty array when no processes', () => {
      expect(manager.getAll()).toEqual([]);
    });

    it('should return all tracked processes', () => {
      const mockProcess2 = { ...mockProcess, pid: 12346, on: vi.fn() } as unknown as ChildProcess;

      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);
      manager.track('server-2', 'deployment-2', mockProcess2, 4112, mockLogCollector);

      const all = manager.getAll();
      expect(all).toHaveLength(2);
      expect(all.map(p => p.serverId)).toContain('server-1');
      expect(all.map(p => p.serverId)).toContain('server-2');
    });
  });

  describe('getRunningCount', () => {
    it('should return 0 when no processes', () => {
      expect(manager.getRunningCount()).toBe(0);
    });

    it('should count only running processes', () => {
      const runningProcess = { ...mockProcess, on: vi.fn() } as unknown as ChildProcess;
      const killedProcess = { ...mockProcess, pid: 12346, killed: true, on: vi.fn() } as unknown as ChildProcess;
      const exitedProcess = { ...mockProcess, pid: 12347, exitCode: 1, on: vi.fn() } as unknown as ChildProcess;

      manager.track('server-1', 'deployment-1', runningProcess, 4111, mockLogCollector);
      manager.track('server-2', 'deployment-2', killedProcess, 4112, mockLogCollector);
      manager.track('server-3', 'deployment-3', exitedProcess, 4113, mockLogCollector);

      expect(manager.getRunningCount()).toBe(1);
    });
  });

  describe('killAll', () => {
    it('should do nothing when no processes', async () => {
      await expect(manager.killAll()).resolves.toBeUndefined();
    });

    it('should kill all tracked processes', async () => {
      const mockProcess2 = { ...mockProcess, pid: 12346, on: vi.fn() } as unknown as ChildProcess;

      manager.track('server-1', 'deployment-1', mockProcess, 4111, mockLogCollector);
      manager.track('server-2', 'deployment-2', mockProcess2, 4112, mockLogCollector);

      await manager.killAll();

      expect(manager.getAll()).toHaveLength(0);
    });
  });
});
