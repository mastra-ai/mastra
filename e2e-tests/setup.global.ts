import type { GlobalSetupContext } from 'vitest/node';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import getPort from 'get-port';
import { startRegistry, type Registry } from './_shared/setup/registry.js';
import {
  prepareSnapshotVersions,
  publishPackages,
  restoreGitFiles,
  hasSnapshotChanges,
} from './_shared/setup/snapshot.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// File-based lock to ensure setup only runs once across all worker processes
const LOCK_FILE = join(__dirname, '.e2e-setup-lock.json');

// In-memory state for this process
let registry: Registry | null = null;
let cleanupSnapshot: (() => Promise<void>) | null = null;
let isSetupOwner = false;
let signalHandlersRegistered = false;

/**
 * Core packages needed by e2e tests.
 * Only these packages get versioned in the changeset.
 * This is much faster than versioning all 100+ packages.
 *
 * Include both the packages tests use AND their workspace dependencies.
 */
const E2E_PACKAGES = [
  // Core and its deps
  '@mastra/core',
  '@mastra/schema-compat',

  // CLI and its deps
  'mastra',
  'create-mastra',
  '@mastra/deployer',
  '@mastra/server',
  '@mastra/hono',

  // Loggers
  '@mastra/loggers',

  // Storage
  '@mastra/libsql',
  '@mastra/pg',

  // Memory
  '@mastra/memory',

  // Deployers
  '@mastra/deployer-cloudflare',
  '@mastra/deployer-vercel',
  '@mastra/deployer-netlify',

  // Playground and UI
  '@mastra/playground-ui',

  // MCP
  '@mastra/mcp',

  // Evals and Observability
  '@mastra/evals',
  '@mastra/observability',
];

/**
 * pnpm filter arguments for publishing.
 * Uses ^... to include dependencies.
 */
const PUBLISH_FILTERS = E2E_PACKAGES.flatMap(pkg => [`--filter="${pkg}^..."`, `--filter="${pkg}"`]);

const E2E_TAG = 'e2e-test';

interface LockData {
  registryUrl: string;
  pid: number;
  timestamp: number;
}

function readLock(): LockData | null {
  try {
    if (existsSync(LOCK_FILE)) {
      return JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    }
  } catch {
    // Lock file might be corrupted or being written
  }
  return null;
}

function writeLock(data: LockData): void {
  writeFileSync(LOCK_FILE, JSON.stringify(data));
}

function removeLock(): void {
  try {
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE);
    }
  } catch {
    // File might already be deleted
  }
}

// Root directory for git operations - set early so signal handlers can use it
const ROOT_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function registerCleanupHandlers(): void {
  if (signalHandlersRegistered) return;

  const cleanup = () => {
    console.log('\n[E2E Global Setup] Interrupted! Cleaning up...');
    try {
      registry?.shutdown();
    } catch {}
    try {
      restoreGitFiles(ROOT_DIR);
    } catch (e) {
      console.error('[E2E Global Setup] Failed to restore files:', e);
    }
    removeLock();
    process.exit(1);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
  process.on('uncaughtException', err => {
    console.error('[E2E Global Setup] Uncaught exception:', err);
    cleanup();
  });

  signalHandlersRegistered = true;
}

// Register signal handlers immediately when this module is loaded
registerCleanupHandlers();

async function doSetup(): Promise<string> {
  console.log('\n[E2E Global Setup] Starting...\n');

  // 0. Check for and restore any leftover changes from previous interrupted runs
  if (hasSnapshotChanges(ROOT_DIR)) {
    console.log('[E2E Global Setup] Detected leftover changes from previous run, restoring...');
    restoreGitFiles(ROOT_DIR);
  }

  // 1. Start registry
  console.log('[E2E Global Setup] Starting local npm registry...');
  const port = await getPort();
  registry = await startRegistry(port);
  console.log(`[E2E Global Setup] Registry started at ${registry.url}`);

  // 2. Prepare snapshot versions
  console.log('[E2E Global Setup] Preparing snapshot versions...');
  const result = await prepareSnapshotVersions({ rootDir: ROOT_DIR, tag: E2E_TAG }, E2E_PACKAGES);
  cleanupSnapshot = result.cleanup;

  // 3. Publish packages
  console.log('[E2E Global Setup] Publishing packages to local registry...');
  publishPackages(PUBLISH_FILTERS, E2E_TAG, ROOT_DIR, registry.url);
  console.log('[E2E Global Setup] All packages published successfully');

  // Write lock file for other projects to find
  writeLock({
    registryUrl: registry.url,
    pid: process.pid,
    timestamp: Date.now(),
  });

  console.log('\n[E2E Global Setup] Complete!\n');
  return registry.url;
}

/**
 * Check if a registry URL is actually responding
 */
async function isRegistryAlive(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return response.ok;
  } catch {
    return false;
  }
}

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
  const existingLock = readLock();

  if (existingLock && Date.now() - existingLock.timestamp < 60 * 60 * 1000) {
    // Lock exists and is less than 1 hour old - verify registry is actually running
    const alive = await isRegistryAlive(existingLock.registryUrl);
    if (alive) {
      console.log(`[E2E Global Setup] Reusing existing registry at ${existingLock.registryUrl}`);
      context.provide('registryUrl', existingLock.registryUrl);
      context.provide('e2eTag', E2E_TAG);

      // Not the owner, so no cleanup responsibility
      return async () => {};
    } else {
      console.log('[E2E Global Setup] Stale lock file found (registry not responding), cleaning up...');
      removeLock();
      restoreGitFiles(ROOT_DIR);
    }
  }

  // We're the first - do the actual setup
  isSetupOwner = true;
  const registryUrl = await doSetup();

  context.provide('registryUrl', registryUrl);
  context.provide('e2eTag', E2E_TAG);

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
