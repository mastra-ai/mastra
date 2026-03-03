/**
 * Daytona Sandbox Types
 */

/**
 * Resource allocation for Daytona sandboxes.
 */
export interface DaytonaResources {
  /** CPU cores */
  cpu?: number;
  /** Memory in GiB */
  memory?: number;
  /** Disk in GiB */
  disk?: number;
}
