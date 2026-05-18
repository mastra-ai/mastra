/**
 * Gateway sync utility for keeping the model registry up to date.
 *
 * This is a thin wrapper around `@mastra/core/llm`'s `GatewayRegistry` so
 * mastracode and `mastra dev` share a single implementation for fetching
 * providers, generating types, and writing to the global cache. Keep this
 * file small — provider/registry logic belongs in `@mastra/core`.
 */

import { GatewayRegistry } from '@mastra/core/llm';

const DEFAULT_SYNC_INTERVAL_MS = 5 * 60 * 1000;

let syncInterval: NodeJS.Timeout | null = null;
let isSyncing = false;

function getRegistry(): GatewayRegistry {
  return GatewayRegistry.getInstance({ useDynamicLoading: true });
}

/**
 * Sync gateways and update the global cache via `@mastra/core`'s registry.
 *
 * Skips the sync if the global cache was refreshed within the last
 * `DEFAULT_SYNC_INTERVAL_MS`, unless `force` is set. Multiple calls in
 * the same process coalesce while a sync is in flight.
 */
export async function syncGateways(force = false): Promise<void> {
  if (isSyncing && !force) {
    return;
  }

  if (!force) {
    const lastSync = getRegistry().getLastRefreshTime();
    if (lastSync && Date.now() - lastSync.getTime() < DEFAULT_SYNC_INTERVAL_MS) {
      return;
    }
  }

  isSyncing = true;
  try {
    await getRegistry().syncGateways(true);
  } catch (error) {
    console.error('[GatewaySync] Sync failed:', error);
  } finally {
    isSyncing = false;
  }
}

/**
 * Start periodic gateway sync.
 * @param intervalMs Sync interval in milliseconds (default: 5 minutes)
 */
export function startGatewaySync(intervalMs = DEFAULT_SYNC_INTERVAL_MS): void {
  if (syncInterval) {
    return;
  }

  // Do an initial sync (will skip if recently synced)
  syncGateways().catch(error => {
    console.error('[GatewaySync] Initial sync failed:', error);
  });

  // Set up periodic sync
  syncInterval = setInterval(() => {
    syncGateways().catch(error => {
      console.error('[GatewaySync] Periodic sync failed:', error);
    });
  }, intervalMs);

  // Don't prevent process exit
  syncInterval.unref();
}

/**
 * Stop periodic gateway sync.
 */
export function stopGatewaySync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}
