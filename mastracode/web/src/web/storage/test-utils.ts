/**
 * Test seams for suites exercising the app-table wrapper modules
 * (intake/audit/work-items stores) without a real Postgres: registers the
 * built-in domains on a fresh libsql `:memory:` `FactoryStorage` and seeds it
 * into the runtime-config registry the wrappers consult.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { onTestFinished } from 'vitest';

import { seedRuntimeConfig } from '../runtime-config';
import { AuditStorage } from './domains/audit/base';
import { ModelCredentialsStorage } from './domains/credentials/base';
import { IntakeStorage } from './domains/intake/base';
import { IntegrationStorage } from './domains/integrations/base';
import { QueueHealthStorage } from './domains/queue-health/base';
import { SourceControlStorage } from './domains/source-control/base';
import { WorkItemsStorage } from './domains/work-items/base';

export interface FactoryStorageTestSeed {
  storage: LibSQLFactoryStorage;
  intake: IntakeStorage;
  audit: AuditStorage;
  workItems: WorkItemsStorage;
  credentials: ModelCredentialsStorage;
  integrations: IntegrationStorage;
  sourceControl: SourceControlStorage;
  queueHealth: QueueHealthStorage;
}

/**
 * Seed runtime config with a fresh libsql `:memory:` database. Call in
 * `beforeEach` (state is per-instance). The backend closes automatically when
 * the current test finishes; callers should still reset runtime config.
 */
export async function seedFactoryStorageForTests(): Promise<FactoryStorageTestSeed> {
  const storage = new LibSQLFactoryStorage({ id: 'factory-test', url: ':memory:' });
  const intake = storage.registerDomain(new IntakeStorage());
  const audit = storage.registerDomain(new AuditStorage());
  const workItems = storage.registerDomain(new WorkItemsStorage());
  const credentials = storage.registerDomain(new ModelCredentialsStorage());
  const integrations = storage.registerDomain(new IntegrationStorage());
  const sourceControl = storage.registerDomain(new SourceControlStorage());
  const queueHealth = storage.registerDomain(new QueueHealthStorage());
  await storage.init();
  onTestFinished(() => storage.close());
  seedRuntimeConfig({ storage });
  return { storage, intake, audit, workItems, credentials, integrations, sourceControl, queueHealth };
}
