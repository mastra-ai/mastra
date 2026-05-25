import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock v8.writeHeapSnapshot so tests don't actually write snapshot files
vi.mock('node:v8', () => ({
  default: {
    writeHeapSnapshot: vi.fn().mockReturnValue('/tmp/mock-snapshot.heapsnapshot'),
  },
  writeHeapSnapshot: vi.fn().mockReturnValue('/tmp/mock-snapshot.heapsnapshot'),
}));

// Mock project so getAppDataDir returns a temp dir
vi.mock('../project.js', () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'mc-profile-test-'));
  return {
    getAppDataDir: () => tmpDir,
  };
});

import { writeHeapSnapshot } from 'node:v8';
import { MemoryProfiler, isProfileEnabled, resolveProfileDir } from '../memory-profiler.js';

describe('MemoryProfiler', () => {
  let tmpDir: string;

  beforeEach(() => {
    // Reset env vars
    delete process.env.MASTRACODE_PROFILE;
    delete process.env.MASTRACODE_PROFILE_DIR;
    delete process.env.MASTRACODE_PROFILE_INTERVAL_MS;
    delete process.env.MASTRACODE_PROFILE_HEAP_MB;
    delete process.env.MASTRACODE_PROFILE_RSS_MB;
    delete process.env.MASTRACODE_PROFILE_MAX_SNAPSHOTS;

    vi.clearAllMocks();
  });

  describe('constructor defaults', () => {
    it('uses default interval and max snapshots', () => {
      const p = new MemoryProfiler();
      expect(p.intervalMs).toBe(10000);
      expect(p.maxSnapshots).toBe(3);
      expect(p.outDir).toMatch(/profiles\/\d+-\d+$/);
    });

    it('respects options over defaults', () => {
      const p = new MemoryProfiler({
        intervalMs: 5000,
        maxSnapshots: 5,
        outDir: '/tmp/test-profile',
      });
      expect(p.intervalMs).toBe(5000);
      expect(p.maxSnapshots).toBe(5);
      expect(p.outDir).toBe('/tmp/test-profile');
    });

    it('parses env var INTERVAL_MS', () => {
      process.env.MASTRACODE_PROFILE_INTERVAL_MS = '3000';
      const p = new MemoryProfiler();
      expect(p.intervalMs).toBe(3000);
    });

    it('parses heap threshold from env MB', () => {
      process.env.MASTRACODE_PROFILE_HEAP_MB = '200';
      const p = new MemoryProfiler();
      expect(p.heapThresholdBytes).toBe(200 * 1024 * 1024);
    });

    it('ignores invalid heap threshold env', () => {
      process.env.MASTRACODE_PROFILE_HEAP_MB = 'not-a-number';
      const p = new MemoryProfiler();
      expect(p.heapThresholdBytes).toBeUndefined();
    });

    it('parses RSS threshold from env MB', () => {
      process.env.MASTRACODE_PROFILE_RSS_MB = '500';
      const p = new MemoryProfiler();
      expect(p.rssThresholdBytes).toBe(500 * 1024 * 1024);
    });
  });

  describe('start / stop lifecycle', () => {
    it('starts sampling and writes samples.jsonl', () => {
      const p = new MemoryProfiler({
        intervalMs: 50000, // long interval so no second sample
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
      });
      p.start();

      const status = p.status();
      expect(status.running).toBe(true);
      expect(status.sampleCount).toBe(1); // baseline sample
      expect(existsSync(join(p.outDir, 'samples.jsonl'))).toBe(true);

      p.stop();
    });

    it('is a no-op to start when already running', () => {
      const p = new MemoryProfiler({
        intervalMs: 50000,
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
      });
      p.start();
      const countA = p.status().sampleCount;
      p.start(); // no-op
      const countB = p.status().sampleCount;
      expect(countA).toBe(countB);
      p.stop();
    });

    it('is safe to call stop when not running', () => {
      const p = new MemoryProfiler();
      expect(() => p.stop()).not.toThrow();
    });

    it('records metadata getters in samples', () => {
      const p = new MemoryProfiler({
        intervalMs: 50000,
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
        getMode: () => 'build',
        getThreadId: () => 'thread-xyz',
        getResourceId: () => 'resource-abc',
        getModelId: () => 'claude-opus-4',
      });
      p.start();

      const s = p.status();
      expect(s.latestSample?.mode).toBe('build');
      expect(s.latestSample?.threadId).toBe('thread-xyz');
      expect(s.latestSample?.resourceId).toBe('resource-abc');
      expect(s.latestSample?.modelId).toBe('claude-opus-4');

      p.stop();
    });
  });

  describe('status', () => {
    it('returns enabled/running/sampleCount/snapshotCount', () => {
      const p = new MemoryProfiler({
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
        intervalMs: 50000,
      });
      const before = p.status();
      expect(before.running).toBe(false);
      expect(before.sampleCount).toBe(0);
      expect(before.snapshotCount).toBe(0);

      p.start();
      const after = p.status();
      expect(after.running).toBe(true);
      expect(after.sampleCount).toBe(1);
      expect(after.outDir).toBeDefined();

      p.stop();
    });
  });

  describe('manual snapshot', () => {
    it('writes a heap snapshot via v8.writeHeapSnapshot', () => {
      const p = new MemoryProfiler({
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
      });
      const path = p.snapshot('test-reason');
      expect(writeHeapSnapshot).toHaveBeenCalledTimes(1);
      expect(path).toBeTruthy();

      const status = p.status();
      expect(status.snapshotCount).toBe(1);
    });

    it('handles snapshot failure gracefully (v8 throws)', () => {
      vi.mocked(writeHeapSnapshot).mockImplementationOnce(() => {
        throw new Error('OOM');
      });

      const p = new MemoryProfiler({
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
      });
      const path = p.snapshot('test-fail');
      expect(path).toBeNull();
    });
  });

  describe('threshold-based snapshots', () => {
    it('triggers snapshot when heapUsed exceeds heapThresholdBytes', () => {
      const p = new MemoryProfiler({
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
        heapThresholdBytes: 1, // 1 byte — always exceeded
        maxSnapshots: 2,
        intervalMs: 50000,
      });

      // start triggers baseline sample + threshold check
      p.start();
      expect(writeHeapSnapshot).toHaveBeenCalled();
      expect(p.status().snapshotCount).toBe(1);

      // Manually trigger _takeSample again
      // We can't access private method, but we can check stop() writes final sample
      p.stop();
      expect(p.status().snapshotCount).toBeGreaterThanOrEqual(1);

      p.stop(); // no-op
    });

    it('triggers snapshot when RSS exceeds rssThresholdBytes', () => {
      const p = new MemoryProfiler({
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
        rssThresholdBytes: 1,
        maxSnapshots: 2,
        intervalMs: 50000,
      });
      p.start();

      expect(writeHeapSnapshot).toHaveBeenCalled();
      expect(p.status().snapshotCount).toBeGreaterThanOrEqual(1);
      p.stop();
    });

    it('caps automatic snapshots at maxSnapshots', () => {
      const p = new MemoryProfiler({
        outDir: mkdtempSync(join(tmpdir(), 'mc-test-')),
        heapThresholdBytes: 1,
        maxSnapshots: 2,
        intervalMs: 50000,
      });

      // Each start/stop cycle triggers threshold check
      p.start();
      p.stop();
      const countAfterFirst = p.status().snapshotCount;

      // Start again — should not exceed maxSnapshots
      p.start();
      p.stop();
      const countAfterSecond = p.status().snapshotCount;

      expect(countAfterFirst).toBeLessThanOrEqual(2);
      expect(countAfterSecond).toBeLessThanOrEqual(2);
    });
  });

  describe('env config', () => {
    it('resolves profile dir from env', () => {
      process.env.MASTRACODE_PROFILE_DIR = '/custom/profile/path';
      expect(resolveProfileDir()).toBe('/custom/profile/path');
    });

    it('resolves profile dir from argument over env', () => {
      process.env.MASTRACODE_PROFILE_DIR = '/env/path';
      expect(resolveProfileDir('/arg/path')).toBe('/arg/path');
    });

    it('isProfileEnabled returns true when MASTRACODE_PROFILE=1', () => {
      process.env.MASTRACODE_PROFILE = '1';
      expect(isProfileEnabled()).toBe(true);
    });

    it('isProfileEnabled returns false when not set', () => {
      expect(isProfileEnabled()).toBe(false);
    });

    it('isProfileEnabled returns false for other values', () => {
      process.env.MASTRACODE_PROFILE = '0';
      expect(isProfileEnabled()).toBe(false);
    });
  });
});
