import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import getPort from 'get-port';
import {
  prepareSnapshotVersions,
  publishPackages,
  restoreGitFiles,
  hasSnapshotChanges,
} from './_shared/setup/snapshot.js';
import { startRegistry, type Registry } from './_shared/setup/registry.js';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';

interface LockData {
  registryUrl: string;
  pid: number;
  timestamp: number;
}

/**
 * All packages that might be needed by any e2e test.
 * This ensures we publish everything once, rather than per-test-suite.
 */
const PACKAGES_TO_PUBLISH = [
  // Core packages (dependencies of everything)
  '--filter="@mastra/core^..."',
  '--filter="@mastra/core"',

  // CLI and tools
  '--filter="mastra^..."',
  '--filter="mastra"',
  '--filter="create-mastra^..."',
  '--filter="create-mastra"',

  // Loggers (many things depend on this)
  '--filter="@mastra/loggers^..."',
  '--filter="@mastra/loggers"',

  // Storage
  '--filter="@mastra/libsql^..."',
  '--filter="@mastra/libsql"',
  '--filter="@mastra/pg^..."',
  '--filter="@mastra/pg"',

  // Memory
  '--filter="@mastra/memory^..."',
  '--filter="@mastra/memory"',

  // Deployers
  '--filter="@mastra/deployer-cloudflare^..."',
  '--filter="@mastra/deployer-cloudflare"',
  '--filter="@mastra/deployer-vercel^..."',
  '--filter="@mastra/deployer-vercel"',
  '--filter="@mastra/deployer-netlify^..."',
  '--filter="@mastra/deployer-netlify"',

  // Playground and UI
  '--filter="@mastra/playground-ui^..."',
  '--filter="@mastra/playground-ui"',

  // MCP
  '--filter="@mastra/mcp^..."',
  '--filter="@mastra/mcp"',

  // Evals
  '--filter="@mastra/evals^..."',
  '--filter="@mastra/evals"',

  // Observability
  '--filter="@mastra/observability^..."',
  '--filter="@mastra/observability"',
];

// In-memory state for this process
let registry: Registry | null = null;
let cleanupSnapshot: (() => Promise<void>) | null = null;
let isSetupOwner = false;
let signalHandlersRegistered = false;

export async function doSetup(): Promise<string> {
  const ROOT_DIR = getRootDir();
  const E2E_TAG = getE2ETag();
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
  const result = await prepareSnapshotVersions({ rootDir: ROOT_DIR, tag: E2E_TAG }, PACKAGES_TO_PUBLISH);
  cleanupSnapshot = result.cleanup;

  // 3. Publish packages
  console.log('[E2E Global Setup] Publishing packages to local registry...');
  publishPackages(PACKAGES_TO_PUBLISH, E2E_TAG, ROOT_DIR, registry.url);
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

// Root directory for git operations - set early so signal handlers can use it
function getRootDir() {
  return join(dirname(fileURLToPath(import.meta.url)), '..');
}

// File-based lock to ensure setup only runs once across all worker processes
export function getLockFile() {
  return join(__dirname, '.e2e-setup-lock.json');
}

function writeLock(data: LockData): void {
  writeFileSync(getLockFile(), JSON.stringify(data));
}

export function removeLock(): void {
  const LOCK_FILE = getLockFile();

  try {
    if (existsSync(LOCK_FILE)) {
      unlinkSync(LOCK_FILE);
    }
  } catch {
    // File might already be deleted
  }
}

export function readLock(): LockData | null {
  const LOCK_FILE = getLockFile();
  try {
    if (existsSync(LOCK_FILE)) {
      return JSON.parse(readFileSync(LOCK_FILE, 'utf8'));
    }
  } catch {
    // Lock file might be corrupted or being written
  }
  return null;
}

export function getE2ETag() {
  return 'e2e-test';
}

export function registerCleanupHandlers(): void {
  if (signalHandlersRegistered) return;
  const ROOT_DIR = getRootDir();

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

/**
 * Check if a registry URL is actually responding
 */
export async function isRegistryAlive(url: string): Promise<boolean> {
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

export function guardActiveLock(): LockData | null {
  const existingLock = readLock();

  if (existingLock && Date.now() - existingLock.timestamp < 60 * 60 * 1000) {
    return existingLock;
  }

  return null;
}

export function cleanupActiveLock(): void {
  console.log('[E2E Global Setup] Stale lock file found (registry not responding), cleaning up...');
  removeLock();
  restoreGitFiles(getRootDir());
}
