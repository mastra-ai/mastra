import { describe, it, expect, vi } from 'vitest';

import { isMountPoint, getActiveFuseMounts, unmountFuse, findTool, getInstallInstructions } from './platform';
import type { LocalMountContext } from './types';

function createMockContext(
  platform: NodeJS.Platform = 'linux',
  runResults: Record<string, { stdout: string; stderr: string; exitCode: number }> = {},
): { ctx: LocalMountContext; runFn: ReturnType<typeof vi.fn> } {
  const runFn = vi.fn(async (command: string, args: string[]) => {
    const key = `${command} ${args.join(' ')}`.trim();
    // Check for exact match first
    if (runResults[key]) return runResults[key];
    // Check for partial matches
    for (const [pattern, result] of Object.entries(runResults)) {
      if (key.startsWith(pattern) || key.includes(pattern)) return result;
    }
    return { stdout: '', stderr: '', exitCode: 1 };
  });

  return {
    ctx: {
      run: runFn,
      platform,
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      },
    },
    runFn,
  };
}

describe('platform utilities', () => {
  // ===========================================================================
  // isMountPoint
  // ===========================================================================
  describe('isMountPoint', () => {
    it('should use mountpoint on Linux', async () => {
      const { ctx, runFn } = createMockContext('linux', {
        'mountpoint -q /mnt/data': { stdout: '', stderr: '', exitCode: 0 },
      });

      const result = await isMountPoint('/mnt/data', ctx);
      expect(result).toBe(true);
      expect(runFn).toHaveBeenCalledWith('mountpoint', ['-q', '/mnt/data']);
    });

    it('should return false when mountpoint fails on Linux', async () => {
      const { ctx } = createMockContext('linux', {
        'mountpoint -q /mnt/data': { stdout: '', stderr: '', exitCode: 1 },
      });

      const result = await isMountPoint('/mnt/data', ctx);
      expect(result).toBe(false);
    });

    it('should parse mount output on macOS', async () => {
      const { ctx, runFn } = createMockContext('darwin', {
        mount: {
          stdout: 's3fs on /mnt/data (macfuse, nodev, nosuid, synchronous, mounted by user)\n',
          stderr: '',
          exitCode: 0,
        },
      });

      const result = await isMountPoint('/mnt/data', ctx);
      expect(result).toBe(true);
      expect(runFn).toHaveBeenCalledWith('mount', []);
    });

    it('should return false when path not in mount output on macOS', async () => {
      const { ctx } = createMockContext('darwin', {
        mount: {
          stdout: '/dev/disk1s1 on / (apfs, sealed, local, read-only, journaled)\n',
          stderr: '',
          exitCode: 0,
        },
      });

      const result = await isMountPoint('/mnt/data', ctx);
      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      const { ctx } = createMockContext('linux');
      const result = await isMountPoint('/mnt/data', ctx);
      expect(result).toBe(false);
    });
  });

  // ===========================================================================
  // getActiveFuseMounts
  // ===========================================================================
  describe('getActiveFuseMounts', () => {
    it('should parse /proc/mounts on Linux', async () => {
      const { ctx } = createMockContext('linux', {
        'sh -c': {
          stdout: '/mnt/s3-bucket\n/mnt/gcs-bucket\n',
          stderr: '',
          exitCode: 0,
        },
      });

      const result = await getActiveFuseMounts(ctx);
      expect(result).toEqual(['/mnt/s3-bucket', '/mnt/gcs-bucket']);
    });

    it('should return empty array when no FUSE mounts on Linux', async () => {
      const { ctx } = createMockContext('linux', {
        'sh -c': { stdout: '', stderr: '', exitCode: 1 },
      });

      const result = await getActiveFuseMounts(ctx);
      expect(result).toEqual([]);
    });

    it('should parse mount output on macOS', async () => {
      const { ctx } = createMockContext('darwin', {
        mount: {
          stdout: [
            '/dev/disk1s1 on / (apfs, sealed)',
            's3fs on /mnt/s3-bucket (macfuse, nodev)',
            'gcsfuse on /mnt/gcs-data (macfuse, nodev)',
          ].join('\n'),
          stderr: '',
          exitCode: 0,
        },
      });

      const result = await getActiveFuseMounts(ctx);
      expect(result).toEqual(['/mnt/s3-bucket', '/mnt/gcs-data']);
    });

    it('should return empty array on error', async () => {
      const { ctx } = createMockContext('linux');
      const result = await getActiveFuseMounts(ctx);
      expect(result).toEqual([]);
    });
  });

  // ===========================================================================
  // unmountFuse
  // ===========================================================================
  describe('unmountFuse', () => {
    it('should use fusermount on Linux', async () => {
      const { ctx, runFn } = createMockContext('linux', {
        'fusermount -u /mnt/data': { stdout: '', stderr: '', exitCode: 0 },
      });

      await unmountFuse('/mnt/data', ctx);
      expect(runFn).toHaveBeenCalledWith('fusermount', ['-u', '/mnt/data']);
    });

    it('should fallback to umount on Linux when fusermount fails', async () => {
      const { ctx, runFn } = createMockContext('linux', {
        'fusermount -u /mnt/data': { stdout: '', stderr: 'not found', exitCode: 1 },
        'umount /mnt/data': { stdout: '', stderr: '', exitCode: 0 },
      });

      await unmountFuse('/mnt/data', ctx);
      expect(runFn).toHaveBeenCalledWith('fusermount', ['-u', '/mnt/data']);
      expect(runFn).toHaveBeenCalledWith('umount', ['/mnt/data']);
    });

    it('should fallback to lazy umount on Linux', async () => {
      const { ctx, runFn } = createMockContext('linux', {
        'fusermount -u /mnt/data': { stdout: '', stderr: 'not found', exitCode: 1 },
        'umount /mnt/data': { stdout: '', stderr: 'busy', exitCode: 1 },
        'umount -l /mnt/data': { stdout: '', stderr: '', exitCode: 0 },
      });

      await unmountFuse('/mnt/data', ctx);
      expect(runFn).toHaveBeenCalledWith('umount', ['-l', '/mnt/data']);
    });

    it('should throw when all unmount methods fail on Linux', async () => {
      const { ctx } = createMockContext('linux', {
        'fusermount -u /mnt/data': { stdout: '', stderr: 'error', exitCode: 1 },
        'umount /mnt/data': { stdout: '', stderr: 'error', exitCode: 1 },
        'umount -l /mnt/data': { stdout: '', stderr: 'still error', exitCode: 1 },
      });

      await expect(unmountFuse('/mnt/data', ctx)).rejects.toThrow('Failed to unmount');
    });

    it('should use umount on macOS', async () => {
      const { ctx, runFn } = createMockContext('darwin', {
        'umount /mnt/data': { stdout: '', stderr: '', exitCode: 0 },
      });

      await unmountFuse('/mnt/data', ctx);
      expect(runFn).toHaveBeenCalledWith('umount', ['/mnt/data']);
    });

    it('should fallback to diskutil on macOS', async () => {
      const { ctx, runFn } = createMockContext('darwin', {
        'umount /mnt/data': { stdout: '', stderr: 'busy', exitCode: 1 },
        'diskutil unmount /mnt/data': { stdout: '', stderr: '', exitCode: 0 },
      });

      await unmountFuse('/mnt/data', ctx);
      expect(runFn).toHaveBeenCalledWith('diskutil', ['unmount', '/mnt/data']);
    });
  });

  // ===========================================================================
  // findTool
  // ===========================================================================
  describe('findTool', () => {
    it('should return path when tool is found', async () => {
      const { ctx } = createMockContext('linux', {
        'which s3fs': { stdout: '/usr/bin/s3fs\n', stderr: '', exitCode: 0 },
      });

      const result = await findTool('s3fs', ctx);
      expect(result).toBe('/usr/bin/s3fs');
    });

    it('should return null when tool is not found', async () => {
      const { ctx } = createMockContext('linux', {
        'which s3fs': { stdout: '', stderr: '', exitCode: 1 },
      });

      const result = await findTool('s3fs', ctx);
      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      const { ctx } = createMockContext('linux');
      const result = await findTool('nonexistent', ctx);
      expect(result).toBeNull();
    });
  });

  // ===========================================================================
  // getInstallInstructions
  // ===========================================================================
  describe('getInstallInstructions', () => {
    it('should return brew instructions for macOS s3fs', () => {
      const instructions = getInstallInstructions('s3fs', 'darwin');
      expect(instructions).toContain('brew');
      expect(instructions).toContain('s3fs');
    });

    it('should return apt instructions for Linux s3fs', () => {
      const instructions = getInstallInstructions('s3fs', 'linux');
      expect(instructions).toContain('apt');
      expect(instructions).toContain('s3fs');
    });

    it('should return brew instructions for macOS gcsfuse', () => {
      const instructions = getInstallInstructions('gcsfuse', 'darwin');
      expect(instructions).toContain('brew');
      expect(instructions).toContain('gcsfuse');
    });

    it('should return macfuse instructions for macOS', () => {
      const instructions = getInstallInstructions('macfuse', 'darwin');
      expect(instructions).toContain('macfuse');
    });

    it('should return generic instructions for unknown platform', () => {
      const instructions = getInstallInstructions('s3fs', 'win32' as NodeJS.Platform);
      expect(instructions).toContain('s3fs');
    });
  });
});
