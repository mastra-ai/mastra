import pidusage from 'pidusage';

export interface ResourceUsage {
  memoryUsageMb: number | null;
  cpuPercent: number | null;
}

/**
 * Get resource usage for a process.
 */
export async function getProcessResourceUsage(pid: number): Promise<ResourceUsage> {
  try {
    const stats = await pidusage(pid);

    return {
      memoryUsageMb: stats.memory ? Math.round(stats.memory / 1024 / 1024) : null,
      cpuPercent: stats.cpu !== undefined ? Math.round(stats.cpu * 100) / 100 : null,
    };
  } catch {
    return {
      memoryUsageMb: null,
      cpuPercent: null,
    };
  }
}

/**
 * Cleanup pidusage monitoring.
 */
export function cleanupResourceMonitor(): void {
  pidusage.clear();
}
