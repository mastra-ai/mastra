import type { GlobalSetupContext } from 'vitest/node';

import { type Registry } from './_shared/setup/registry.js';
import {
  cleanupActiveLock,
  doSetup,
  getE2ETag,
  guardActiveLock,
  isRegistryAlive,
  registerCleanupHandlers,
  removeLock,
} from './setup.utils.js';

// In-memory state for this process
let registry: Registry | null = null;
let cleanupSnapshot: (() => Promise<void>) | null = null;
let isSetupOwner = false;

// Register signal handlers immediately when this module is loaded
registerCleanupHandlers();

/**
 * Global setup for all e2e tests.
 *
 * Uses file-based locking to ensure setup only runs once even when
 * multiple workspace projects call globalSetup in different processes.
 *
 * This runs ONCE before all tests and:
 * 1. Starts a single verdaccio registry
 * 2. Prepares snapshot versions of all packages
 * 3. Publishes all packages to the registry
 * 4. Provides the registry URL to all tests via context
 */
export default async function globalSetup(context: GlobalSetupContext) {
  // Check if another process already did setup
  const existingLock = guardActiveLock();

  if (existingLock) {
    // Lock exists and is less than 1 hour old - verify registry is actually running
    const alive = await isRegistryAlive(existingLock.registryUrl);

    if (alive) {
      console.log(`[E2E Global Setup] Reusing existing registry at ${existingLock.registryUrl}`);
      context.provide('registryUrl', existingLock.registryUrl);
      context.provide('e2eTag', getE2ETag());

      // Not the owner, so no cleanup responsibility
      return async () => {};
    } else {
      cleanupActiveLock();
    }
  }

  // We're the first - do the actual setup
  isSetupOwner = true;
  const registryUrl = await doSetup();

  context.provide('registryUrl', registryUrl);
  context.provide('e2eTag', getE2ETag());

  // Return teardown - only the owner cleans up
  return async () => {
    if (isSetupOwner) {
      console.log('\n[E2E Global Teardown] Cleaning up...');
      registry?.shutdown();
      await cleanupSnapshot?.();
      removeLock();
      console.log('[E2E Global Teardown] Complete!\n');

      registry = null;
      cleanupSnapshot = null;
      isSetupOwner = false;
    }
  };
}

// Type augmentation for vitest context
declare module 'vitest' {
  export interface ProvidedContext {
    registryUrl: string;
    e2eTag: string;
  }
}
