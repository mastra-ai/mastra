/**
 * Shared types for E2B mount operations.
 */

import type { Sandbox } from 'e2b';

export const LOG_PREFIX = '[@mastra/e2b]';

import type { E2BGCSMountConfig } from './gcs';
import type { E2BS3MountConfig } from './s3';

/**
 * Union of mount configs supported by E2B sandbox.
 */
export type E2BMountConfig = E2BS3MountConfig | E2BGCSMountConfig;

/**
 * Context for mount operations.
 */
export interface MountContext {
  sandbox: Sandbox;
  logger: {
    debug: (message: string, ...args: unknown[]) => void;
    info: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
    error: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Result of a mount operation.
 */
export interface MountOperationResult {
  success: boolean;
  error?: string;
}
