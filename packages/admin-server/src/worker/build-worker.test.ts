/**
 * Unit tests for BuildWorker.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createMockMastraAdmin, createMockOrchestrator } from '../__tests__/test-utils';
import { BuildWorker } from './build-worker';

describe('BuildWorker', () => {
  let mockAdmin: ReturnType<typeof createMockMastraAdmin>;
  let mockOrchestrator: ReturnType<typeof createMockOrchestrator>;
  let worker: BuildWorker;

  beforeEach(() => {
    vi.useFakeTimers();
    mockAdmin = createMockMastraAdmin();
    mockOrchestrator = createMockOrchestrator();
    mockAdmin.getOrchestrator = vi.fn().mockReturnValue(mockOrchestrator);

    // Suppress console output
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(async () => {
    if (worker?.isRunning()) {
      worker['running'] = false; // Force stop for tests
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('constructor', () => {
    it('should create worker with default config', () => {
      worker = new BuildWorker({
        admin: mockAdmin,
      });

      expect(worker).toBeDefined();
      expect(worker.isRunning()).toBe(false);
    });

    it('should accept custom interval and max concurrent', () => {
      worker = new BuildWorker({
        admin: mockAdmin,
        intervalMs: 10000,
        maxConcurrent: 5,
      });

      expect(worker).toBeDefined();
    });
  });

  describe('start', () => {
    it('should start the worker', () => {
      worker = new BuildWorker({
        admin: mockAdmin,
        intervalMs: 1000,
      });

      worker.start();

      expect(worker.isRunning()).toBe(true);
    });

    it('should warn when already running', () => {
      const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      worker = new BuildWorker({
        admin: mockAdmin,
        logger: mockLogger,
      });

      worker.start();
      worker.start();

      expect(mockLogger.warn).toHaveBeenCalledWith('BuildWorker already running');
    });
  });

  describe('stop', () => {
    it('should stop the worker', async () => {
      worker = new BuildWorker({
        admin: mockAdmin,
        intervalMs: 1000,
      });

      worker.start();
      expect(worker.isRunning()).toBe(true);

      // Advance time and let the loop complete
      vi.advanceTimersByTime(100);

      const stopPromise = worker.stop();
      vi.advanceTimersByTime(1000);
      await stopPromise;

      expect(worker.isRunning()).toBe(false);
    });

    it('should do nothing when not running', async () => {
      worker = new BuildWorker({
        admin: mockAdmin,
      });

      await worker.stop();

      expect(worker.isRunning()).toBe(false);
    });
  });

  describe('getActiveBuildCount', () => {
    it('should return 0 initially', () => {
      worker = new BuildWorker({
        admin: mockAdmin,
      });

      expect(worker.getActiveBuildCount()).toBe(0);
    });
  });

  describe('getActiveBuilds', () => {
    it('should return empty array initially', () => {
      worker = new BuildWorker({
        admin: mockAdmin,
      });

      expect(worker.getActiveBuilds()).toEqual([]);
    });
  });

  describe('queue processing', () => {
    it('should process builds from queue', async () => {
      mockOrchestrator.getQueueStatus = vi.fn().mockReturnValue([{ buildId: 'build-1' }]);
      mockOrchestrator.processNextBuild = vi.fn().mockResolvedValue(true);

      worker = new BuildWorker({
        admin: mockAdmin,
        intervalMs: 100,
        maxConcurrent: 3,
      });

      worker.start();

      // Allow first iteration
      await vi.advanceTimersByTimeAsync(50);

      expect(mockOrchestrator.getQueueStatus).toHaveBeenCalled();
      expect(mockOrchestrator.processNextBuild).toHaveBeenCalled();
    });

    it('should not exceed max concurrent builds', async () => {
      mockOrchestrator.getQueueStatus = vi.fn().mockReturnValue([
        { buildId: 'build-1' },
        { buildId: 'build-2' },
        { buildId: 'build-3' },
        { buildId: 'build-4' },
      ]);
      mockOrchestrator.processNextBuild = vi.fn().mockResolvedValue(true);

      worker = new BuildWorker({
        admin: mockAdmin,
        intervalMs: 100,
        maxConcurrent: 2,
      });

      worker.start();

      // Allow first iteration
      await vi.advanceTimersByTimeAsync(50);

      // Should only process up to maxConcurrent builds
      expect(mockOrchestrator.processNextBuild).toHaveBeenCalledTimes(2);
    });

    it('should stop when queue is empty', async () => {
      mockOrchestrator.getQueueStatus = vi.fn().mockReturnValue([]);

      worker = new BuildWorker({
        admin: mockAdmin,
        intervalMs: 100,
      });

      worker.start();

      await vi.advanceTimersByTimeAsync(50);

      expect(mockOrchestrator.processNextBuild).not.toHaveBeenCalled();
    });

    it('should handle processNextBuild returning false', async () => {
      mockOrchestrator.getQueueStatus = vi
        .fn()
        .mockReturnValueOnce([{ buildId: 'build-1' }])
        .mockReturnValue([]);
      mockOrchestrator.processNextBuild = vi.fn().mockResolvedValue(false);

      worker = new BuildWorker({
        admin: mockAdmin,
        intervalMs: 100,
        maxConcurrent: 3,
      });

      worker.start();

      await vi.advanceTimersByTimeAsync(50);

      // Should stop trying after first false
      expect(mockOrchestrator.processNextBuild).toHaveBeenCalledTimes(1);
    });
  });

  describe('broadcastLog', () => {
    it('should broadcast log when wsServer is present', () => {
      const mockWsServer = {
        broadcastEvent: vi.fn(),
      };

      worker = new BuildWorker({
        admin: mockAdmin,
        wsServer: mockWsServer as unknown as Parameters<typeof BuildWorker.prototype['broadcastLog']> extends never[]
          ? never
          : never,
      });

      worker.broadcastLog('build-123', 'Build started', 'info');

      expect(mockWsServer.broadcastEvent).toHaveBeenCalledWith({
        type: 'build:log',
        payload: {
          buildId: 'build-123',
          line: 'Build started',
          timestamp: expect.any(String),
          level: 'info',
        },
      });
    });

    it('should not throw when wsServer is not present', () => {
      worker = new BuildWorker({
        admin: mockAdmin,
      });

      expect(() => {
        worker.broadcastLog('build-123', 'Build started');
      }).not.toThrow();
    });
  });

  describe('broadcastStatus', () => {
    it('should broadcast status when wsServer is present', () => {
      const mockWsServer = {
        broadcastEvent: vi.fn(),
      };

      worker = new BuildWorker({
        admin: mockAdmin,
        wsServer: mockWsServer as unknown as Parameters<typeof BuildWorker.prototype['broadcastStatus']> extends never[]
          ? never
          : never,
      });

      worker.broadcastStatus('build-123', 'building', 'Build in progress');

      expect(mockWsServer.broadcastEvent).toHaveBeenCalledWith({
        type: 'build:status',
        payload: {
          buildId: 'build-123',
          status: 'building',
          message: 'Build in progress',
        },
      });
    });

    it('should not throw when wsServer is not present', () => {
      worker = new BuildWorker({
        admin: mockAdmin,
      });

      expect(() => {
        worker.broadcastStatus('build-123', 'succeeded');
      }).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should continue processing after error', async () => {
      const mockLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() };
      mockOrchestrator.getQueueStatus = vi.fn().mockImplementation(() => {
        throw new Error('Queue error');
      });

      worker = new BuildWorker({
        admin: mockAdmin,
        intervalMs: 100,
        logger: mockLogger,
      });

      worker.start();

      await vi.advanceTimersByTimeAsync(150);

      expect(mockLogger.error).toHaveBeenCalledWith('Error processing build queue', expect.any(Object));
      expect(worker.isRunning()).toBe(true);
    });
  });
});
