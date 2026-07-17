/**
 * Test seams for suites exercising the app-table wrapper modules
 * (intake/audit/work-items stores) without a real Postgres: registers the
 * in-memory domain implementations on a fresh `FactoryStore` and seeds it
 * into the runtime-config registry the wrappers consult.
 */

import { seedRuntimeConfig } from '../runtime-config';
import type { FactoryStorageContext } from './domain';
import { AuditStorageInMemory } from './domains/audit/inmemory';
import { ModelCredentialsStorageInMemory } from './domains/credentials/inmemory';
import { IntakeStorageInMemory } from './domains/intake/inmemory';
import { WorkItemsStorageInMemory } from './domains/work-items/inmemory';
import { FactoryStore } from './factory-store';

export interface InMemoryFactoryStoreSeed {
  factoryStore: FactoryStore;
  intake: IntakeStorageInMemory;
  audit: AuditStorageInMemory;
  workItems: WorkItemsStorageInMemory;
  credentials: ModelCredentialsStorageInMemory;
}

/**
 * Seed the runtime config with a `FactoryStore` backed by in-memory domains.
 * Call in `beforeEach` (state is per-instance) and pair with
 * `__resetRuntimeConfigForTests()` in cleanup.
 */
export async function seedInMemoryFactoryStoreForTests(): Promise<InMemoryFactoryStoreSeed> {
  const factoryStore = new FactoryStore();
  const intake = new IntakeStorageInMemory();
  const audit = new AuditStorageInMemory();
  const workItems = new WorkItemsStorageInMemory();
  const credentials = new ModelCredentialsStorageInMemory();
  factoryStore.register(intake);
  factoryStore.register(audit);
  factoryStore.register(workItems);
  factoryStore.register(credentials);
  // In-memory domains never touch the connection handle.
  await factoryStore.init({} as FactoryStorageContext);
  seedRuntimeConfig({ factoryStore });
  return { factoryStore, intake, audit, workItems, credentials };
}
