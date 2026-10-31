/** Registers built-in domains on fresh LibSQL storage or an isolated Postgres schema. */

import { randomUUID } from 'node:crypto';

import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import type { PgFactoryStorage } from '@mastra/pg';
import { onTestFinished } from 'vitest';

import { createBoardRegistry, workItemPhaseSemantics } from '../boards/index.js';
import { workItemProviderAdapter } from '../work-items/providers/index.js';
import { AuditStorage } from './domains/audit/base.js';
import { StoredBoardsStorage } from './domains/boards/base.js';
import { ChannelIdentityStorage } from './domains/channel-identity/base.js';
import { WorkItemCommentsStorage } from './domains/comments/base.js';
import { ModelCredentialsStorage } from './domains/credentials/base.js';
import { CustomProvidersStorage } from './domains/custom-providers/base.js';
import { IntakeStorage } from './domains/intake/base.js';
import { IntegrationStorage } from './domains/integrations/base.js';
import { MemorySettingsStorage } from './domains/memory-settings/base.js';
import { ModelDefaultsStorage } from './domains/model-defaults/base.js';
import { FactoryProjectsStorage } from './domains/projects/base.js';
import { QueueHealthStorage } from './domains/queue-health/base.js';
import { SourceControlStorage } from './domains/source-control/base.js';
import { WorkItemsStorage } from './domains/work-items/base.js';
import type { ExternalWorkItemSource } from './domains/work-items/base.js';
import type { WorkItemRow, WorkItemSourceRow } from './domains/work-items/work-item-schema.js';

export function createProviderWorkItemForTests(input: {
  id: string;
  title: string;
  source: ExternalWorkItemSource | null;
  metadata: Record<string, unknown> | null;
}): WorkItemRow {
  const source = workItemProviderAdapter(input.source).toSource(input.source, input.metadata);
  const sources: WorkItemSourceRow[] = source
    ? [
        {
          ...source,
          id: `source-${input.id}`,
          workItemId: `work-${input.id}`,
          revision: 1,
          syncedAt: null,
          createdAt: new Date(0),
          updatedAt: new Date(0),
        },
      ]
    : [];
  return {
    sources,
    title: input.title,
    provider: source?.provider ?? 'factory',
    externalId: source?.externalId ?? input.id,
    key: source ? source.key : input.id.slice(0, 8),
    url: source?.url ?? null,
    state: source?.state ?? null,
    labels: source?.labels ?? [],
    author: source?.author ?? null,
    metadata: source?.metadata ?? null,
    id: `work-${input.id}`,
    orgId: 'org-1',
    factoryProjectId: 'project-1',
    parentWorkItemId: null,
    revision: 1,
    syncedAt: null,
    createdAt: new Date(0),
    updatedAt: new Date(0),
  };
}

/** Keep migration tests from clearing tables another Postgres test is using. */
export async function createIsolatedFactoryPostgresForTests(connectionString: string): Promise<PgFactoryStorage> {
  const { PgFactoryStorage, PostgresStore } = await import('@mastra/pg');
  const admin = new PostgresStore({ id: 'factory-test-admin', connectionString, disableInit: true });
  const schema = `factory_test_${randomUUID().replaceAll('-', '')}`;
  await admin.pool.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(connectionString);
  url.searchParams.set('options', `-c search_path=${schema}`);
  onTestFinished(async () => {
    await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.close();
  });
  return new PgFactoryStorage({ id: 'factory-test', connectionString: url.toString() });
}

export interface FactoryStorageTestSeed<T extends FactoryStorage = FactoryStorage> {
  storage: T;
  intake: IntakeStorage;
  audit: AuditStorage;
  workItems: WorkItemsStorage;
  credentials: ModelCredentialsStorage;
  integrations: IntegrationStorage;
  projects: FactoryProjectsStorage;
  sourceControl: SourceControlStorage;
  modelDefaults: ModelDefaultsStorage;
  memorySettings: MemorySettingsStorage;
  customProviders: CustomProvidersStorage;
  queueHealth: QueueHealthStorage;
  channelIdentity: ChannelIdentityStorage;
  comments: WorkItemCommentsStorage;
  boards: StoredBoardsStorage;
}

/**
 * Create fresh storage with every built-in domain. Defaults to LibSQL `:memory:`;
 * `FACTORY_TEST_STORAGE_BACKEND=postgres` uses an isolated schema at `FACTORY_TEST_POSTGRES_URL`.
 * The backend closes automatically when the current test finishes.
 */
export function createFactoryStorageForTests(): Promise<FactoryStorageTestSeed>;
export function createFactoryStorageForTests<T extends FactoryStorage>(storage: T): Promise<FactoryStorageTestSeed<T>>;
export async function createFactoryStorageForTests(
  storage?: FactoryStorage,
): Promise<FactoryStorageTestSeed<FactoryStorage>> {
  if (!storage && process.env.FACTORY_TEST_STORAGE_BACKEND === 'postgres') {
    const url = process.env.FACTORY_TEST_POSTGRES_URL;
    if (!url) throw new Error('FACTORY_TEST_POSTGRES_URL is required for the Postgres test backend.');
    storage = await createIsolatedFactoryPostgresForTests(url);
  }
  storage ??= new LibSQLFactoryStorage({ id: 'factory-test', url: ':memory:' });
  const intake = storage.registerDomain(new IntakeStorage());
  const audit = storage.registerDomain(new AuditStorage());
  const workItems = storage.registerDomain(new WorkItemsStorage());
  const boardRegistry = createBoardRegistry();
  workItems.useTerminalPhasePredicate(item => workItemPhaseSemantics(boardRegistry, item)?.kind === 'terminal');
  const credentials = storage.registerDomain(new ModelCredentialsStorage());
  const integrations = storage.registerDomain(new IntegrationStorage());
  const projects = storage.registerDomain(new FactoryProjectsStorage());
  const sourceControl = storage.registerDomain(new SourceControlStorage());
  const modelDefaults = storage.registerDomain(new ModelDefaultsStorage());
  const memorySettings = storage.registerDomain(new MemorySettingsStorage());
  const customProviders = storage.registerDomain(new CustomProvidersStorage());
  const queueHealth = storage.registerDomain(new QueueHealthStorage());
  const channelIdentity = storage.registerDomain(new ChannelIdentityStorage());
  const comments = storage.registerDomain(new WorkItemCommentsStorage());
  const boards = storage.registerDomain(new StoredBoardsStorage());
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
    modelDefaults,
    memorySettings,
    customProviders,
    queueHealth,
    channelIdentity,
    comments,
    boards,
  };
}
