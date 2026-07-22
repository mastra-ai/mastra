/**
 * Test seam for suites exercising the factory storage domains without a real
 * Postgres: registers the built-in domains on a fresh libsql `:memory:`
 * `FactoryStorage` and returns the typed domain handles.
 */

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { onTestFinished } from 'vitest';

import { AuditStorage } from './domains/audit/base.js';
import { ModelCredentialsStorage } from './domains/credentials/base.js';
import { CustomProvidersStorage } from './domains/custom-providers/base.js';
import { IntakeStorage } from './domains/intake/base.js';
import { IntegrationStorage } from './domains/integrations/base.js';
import { MemorySettingsStorage } from './domains/memory-settings/base.js';
import { ModelPacksStorage } from './domains/model-packs/base.js';
import { FactoryProjectsStorage } from './domains/projects/base.js';
import { QueueHealthStorage } from './domains/queue-health/base.js';
import { SourceControlStorage } from './domains/source-control/base.js';
import { WorkItemsStorage } from './domains/work-items/base.js';

export interface FactoryStorageTestSeed {
  storage: LibSQLFactoryStorage;
  intake: IntakeStorage;
  audit: AuditStorage;
  workItems: WorkItemsStorage;
  credentials: ModelCredentialsStorage;
  integrations: IntegrationStorage;
  projects: FactoryProjectsStorage;
  sourceControl: SourceControlStorage;
  modelPacks: ModelPacksStorage;
  memorySettings: MemorySettingsStorage;
  customProviders: CustomProvidersStorage;
  queueHealth: QueueHealthStorage;
}

/**
 * Create a fresh libsql `:memory:` `FactoryStorage` with every built-in domain
 * registered. Call per test (state is per-instance). The backend closes
 * automatically when the current test finishes.
 */
export async function createFactoryStorageForTests(): Promise<FactoryStorageTestSeed> {
  const storage = new LibSQLFactoryStorage({ id: 'factory-test', url: ':memory:' });
  const intake = storage.registerDomain(new IntakeStorage());
  const audit = storage.registerDomain(new AuditStorage());
  const workItems = storage.registerDomain(new WorkItemsStorage());
  const credentials = storage.registerDomain(new ModelCredentialsStorage());
  const integrations = storage.registerDomain(new IntegrationStorage());
  const projects = storage.registerDomain(new FactoryProjectsStorage());
  const sourceControl = storage.registerDomain(new SourceControlStorage());
  const modelPacks = storage.registerDomain(new ModelPacksStorage());
  const memorySettings = storage.registerDomain(new MemorySettingsStorage());
  const customProviders = storage.registerDomain(new CustomProvidersStorage());
  const queueHealth = storage.registerDomain(new QueueHealthStorage());
  await storage.init();
  onTestFinished(() => storage.close());
  return {
    storage,
    intake,
    audit,
    workItems,
    credentials,
    integrations,
    projects,
    sourceControl,
    modelPacks,
    memorySettings,
    customProviders,
    queueHealth,
  };
}
