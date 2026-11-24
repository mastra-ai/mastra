import type { IMastraLogger } from '@mastra/core/logger';
import type { ObservabilityStorage } from '@mastra/core/storage';

/**
 * Check the resolved observability domain, not the composite store's default backend.
 * Older or custom adapters without location metadata retain opt-in compatibility.
 */
export function skipLocalStorageOnPlatform(storage: ObservabilityStorage, logger: IMastraLogger): boolean {
  if (!process.env.MASTRA_DEPLOYMENT_ID || storage.persistenceLocation !== 'local') return false;

  logger.warn(
    'Storage exporter disabled on Mastra Platform: local observability storage is not supported, even with retainStorageExporterOnPlatform: true. Use a remote observability storage provider.',
  );
  return true;
}
