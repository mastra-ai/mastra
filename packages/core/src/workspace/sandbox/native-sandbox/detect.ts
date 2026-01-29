/**
 * Platform Detection
 *
 * Detects available sandboxing backends for the current platform.
 */

import { execFileSync } from 'node:child_process';
import os from 'node:os';

import type { IsolationBackend, SandboxDetectionResult } from './types';

/**
 * Check if a command exists on the system.
 */
function commandExists(command: string): boolean {
  try {
    // Use 'which' on Unix-like systems
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if seatbelt (sandbox-exec) is available.
 * This is built-in on macOS.
 */
export function isSeatbeltAvailable(): boolean {
  if (os.platform() !== 'darwin') {
    return false;
  }
  return commandExists('sandbox-exec');
}

/**
 * Check if bubblewrap (bwrap) is available.
 * This must be installed on Linux systems.
 */
export function isBwrapAvailable(): boolean {
  if (os.platform() !== 'linux') {
    return false;
  }
  return commandExists('bwrap');
}

/**
 * Detect the best available isolation backend for the current platform.
 *
 * @returns The recommended isolation backend and availability info
 *
 * @example
 * ```typescript
 * const result = detectIsolation();
 * if (result.available) {
 *   console.log(`Using ${result.backend} for sandboxing`);
 * } else {
 *   console.warn(result.message);
 * }
 * ```
 */
export function detectIsolation(): SandboxDetectionResult {
  const platform = os.platform();

  if (platform === 'darwin') {
    const available = isSeatbeltAvailable();
    return {
      backend: 'seatbelt',
      available,
      message: available
        ? 'macOS seatbelt (sandbox-exec) is available'
        : 'macOS seatbelt (sandbox-exec) not found - this is unexpected on macOS',
    };
  }

  if (platform === 'linux') {
    const available = isBwrapAvailable();
    return {
      backend: 'bwrap',
      available,
      message: available
        ? 'Linux bubblewrap (bwrap) is available'
        : 'Linux bubblewrap (bwrap) not found. Install with: apt install bubblewrap (Debian/Ubuntu) or dnf install bubblewrap (Fedora)',
    };
  }

  // Windows or other platforms
  return {
    backend: 'none',
    available: false,
    message: `Native sandboxing is not supported on ${platform}. Commands will run without isolation.`,
  };
}

/**
 * Check if a specific isolation backend is available.
 *
 * @param backend - The isolation backend to check
 * @returns Whether the backend is available on this system
 */
export function isIsolationAvailable(backend: IsolationBackend): boolean {
  switch (backend) {
    case 'seatbelt':
      return isSeatbeltAvailable();
    case 'bwrap':
      return isBwrapAvailable();
    case 'none':
      return true;
    default:
      return false;
  }
}

/**
 * Get the recommended isolation backend for this platform.
 * Returns 'none' if no sandboxing is available.
 */
export function getRecommendedIsolation(): IsolationBackend {
  const result = detectIsolation();
  return result.available ? result.backend : 'none';
}
