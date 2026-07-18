/**
 * Test seams for suites exercising the app-table wrapper modules
 * (intake/audit/work-items stores) without a real Postgres: registers the
 * built-in domains on a fresh `DomainRegistry` backed by a libsql `:memory:`
 * `FactoryStorage` and seeds it into the runtime-config registry the
 * wrappers consult.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';

import { seedRuntimeConfig } from '../runtime-config';
import { DomainRegistry } from './domain-registry';
import { AuditStorage } from './domains/audit/base';
import { ModelCredentialsStorage } from './domains/credentials/base';
import { IntakeStorage } from './domains/intake/base';
import { IntegrationStorage } from './domains/integrations/base';
import { WorkItemsStorage } from './domains/work-items/base';

export interface FactoryStorageTestSeed {
  registry: DomainRegistry;
  storage: LibSQLFactoryStorage;
  intake: IntakeStorage;
  audit: AuditStorage;
  workItems: WorkItemsStorage;
  credentials: ModelCredentialsStorage;
  integrations: IntegrationStorage;
}

/**
 * Seed the runtime config with a `DomainRegistry` backed by a fresh libsql
 * `:memory:` database. Call in `beforeEach` (state is per-instance) and pair
 * with `__resetRuntimeConfigForTests()` in cleanup.
 */
export async function seedFactoryStorageForTests(): Promise<FactoryStorageTestSeed> {
  const storage = new LibSQLFactoryStorage({ id: 'factory-test', url: ':memory:' });
  await storage.init();
  const registry = new DomainRegistry();
  const intake = new IntakeStorage();
  const audit = new AuditStorage();
  const workItems = new WorkItemsStorage();
  const credentials = new ModelCredentialsStorage();
  const integrations = new IntegrationStorage();
  registry.register(intake);
  registry.register(audit);
  registry.register(workItems);
  registry.register(credentials);
  registry.register(integrations);
  await registry.init({ storage });
  seedRuntimeConfig({ storage, domainRegistry: registry });
  return { registry, storage, intake, audit, workItems, credentials, integrations };
}
