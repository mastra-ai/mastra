import { createClient, type Client } from '@libsql/client';
import type { DuckDBInstance } from '@duckdb/node-api';
import { LibSQLStore } from '@mastra/libsql';

import type { AppConfig } from '../config/load-config.js';
import { backfillLegacyAnalyticsCaseFacts } from './analytics-case-backfill.js';
import { initializeAnalyticsDatabase } from './analytics.js';
import { initializeOperationalDatabase } from './operational.js';
import { KycObservabilityLibSQL } from './observability-discovery.js';
import { ensureParentDirectory } from './paths.js';
import { kycRetentionConfig, runBoundedRetentionPrune } from './retention.js';

export type FoundationStorage = Readonly<{
  operational: Client;
  analytics: DuckDBInstance;
  mastra: LibSQLStore;
  checkReadiness: () => Promise<boolean>;
  close: () => void;
}>;

export type InitializeStorageOptions = Readonly<{ pruneOnStartup?: boolean }>;

export const initializeStorage = async (
  config: AppConfig,
  options: InitializeStorageOptions = {},
): Promise<FoundationStorage> => {
  await ensureParentDirectory(config.storage.mastraUrl.slice('file:'.length));
  const operational = await initializeOperationalDatabase(config.storage.operationalUrl);
  const analytics = await initializeAnalyticsDatabase(config.storage.analyticsPath);
  try {
    await backfillLegacyAnalyticsCaseFacts(operational, analytics);
  } catch (error) {
    operational.close();
    analytics.closeSync();
    throw error;
  }
  const mastra = new LibSQLStore({
    id: 'mastra-kyc-foundation',
    url: config.storage.mastraUrl,
    retention: kycRetentionConfig,
  });
  const observabilityDiscoveryClient = createClient({
    url: config.storage.mastraUrl,
    timeout: 5_000,
  });
  const observability = new KycObservabilityLibSQL(observabilityDiscoveryClient);
  mastra.stores.observability = observability;
  await mastra.init();
  if (options.pruneOnStartup !== false) await runBoundedRetentionPrune(mastra);

  return Object.freeze({
    operational,
    analytics,
    mastra,
    checkReadiness: async () => {
      await operational.execute('SELECT 1');
      const connection = await analytics.connect();
      await connection.run('SELECT 1');
      connection.closeSync();
      return true;
    },
    close: () => {
      observability.close();
      void mastra.close();
      operational.close();
      analytics.closeSync();
    },
  });
};
