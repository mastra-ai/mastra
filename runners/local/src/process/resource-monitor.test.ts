import { describe, it, expect, vi, afterEach } from 'vitest';
import { getProcessResourceUsage, cleanupResourceMonitor } from './resource-monitor';

// Mock pidusage
vi.mock('pidusage', () => ({
  default: vi.fn(),
}));

describe('resource-monitor', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getProcessResourceUsage', () => {
    it('should return resource usage for a valid process', async () => {
      const pidusage = (await import('pidusage')).default;
      (pidusage as ReturnType<typeof vi.fn>).mockResolvedValue({
        memory: 104857600, // 100 MB
        cpu: 25.5,
      });

      const result = await getProcessResourceUsage(12345);

      expect(pidusage).toHaveBeenCalledWith(12345);
      expect(result.memoryUsageMb).toBe(100);
      expect(result.cpuPercent).toBe(25.5);
    });

    it('should round memory usage to nearest MB', async () => {
      const pidusage = (await import('pidusage')).default;
      (pidusage as ReturnType<typeof vi.fn>).mockResolvedValue({
        memory: 157286400, // ~150 MB
        cpu: 10,
      });

      const result = await getProcessResourceUsage(12345);

      expect(result.memoryUsageMb).toBe(150);
    });

    it('should round CPU to 2 decimal places', async () => {
      const pidusage = (await import('pidusage')).default;
      (pidusage as ReturnType<typeof vi.fn>).mockResolvedValue({
        memory: 1048576,
        cpu: 33.3333333,
      });

      const result = await getProcessResourceUsage(12345);

      expect(result.cpuPercent).toBe(33.33);
    });

    it('should return null values when memory is not available', async () => {
      const pidusage = (await import('pidusage')).default;
      (pidusage as ReturnType<typeof vi.fn>).mockResolvedValue({
        memory: 0,
        cpu: 10,
      });

      const result = await getProcessResourceUsage(12345);

      expect(result.memoryUsageMb).toBeNull();
      expect(result.cpuPercent).toBe(10);
    });

    it('should handle CPU being exactly 0', async () => {
      const pidusage = (await import('pidusage')).default;
      (pidusage as ReturnType<typeof vi.fn>).mockResolvedValue({
        memory: 1048576,
        cpu: 0,
      });

      const result = await getProcessResourceUsage(12345);

      expect(result.cpuPercent).toBe(0);
    });

    it('should return null values on error', async () => {
      const pidusage = (await import('pidusage')).default;
      (pidusage as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('Process not found'));

      const result = await getProcessResourceUsage(12345);

      expect(result.memoryUsageMb).toBeNull();
      expect(result.cpuPercent).toBeNull();
    });

    it('should handle undefined cpu value', async () => {
      const pidusage = (await import('pidusage')).default;
      (pidusage as ReturnType<typeof vi.fn>).mockResolvedValue({
        memory: 1048576,
        cpu: undefined,
      });

      const result = await getProcessResourceUsage(12345);

      expect(result.memoryUsageMb).toBe(1);
      expect(result.cpuPercent).toBeNull();
    });
  });

  describe('cleanupResourceMonitor', () => {
    it('should call pidusage.clear()', async () => {
      const pidusage = (await import('pidusage')).default;
      (pidusage as ReturnType<typeof vi.fn> & { clear: ReturnType<typeof vi.fn> }).clear = vi.fn();

      cleanupResourceMonitor();

      expect(
        (pidusage as ReturnType<typeof vi.fn> & { clear: ReturnType<typeof vi.fn> }).clear,
      ).toHaveBeenCalled();
    });
  });
});
