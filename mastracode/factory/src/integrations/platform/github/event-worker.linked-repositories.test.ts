import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EventEmitterPubSub } from '@mastra/core/events';
import type { FactoryStorage } from '@mastra/core/storage';
import type { WorkerDeps } from '@mastra/core/worker';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage, PostgresStore } from '@mastra/pg';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shareLinkedRepositoryChanges } from '../../../linked-repositories-changed.js';
import { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import { SourceControlStorage } from '../../../storage/domains/source-control/base.js';
import type { SourceControlStorageHandle } from '../../../storage/domains/source-control/base.js';
import { PlatformApiClient } from '../api-client.js';
import { PlatformGithubEventWorker } from './event-worker.js';
import type { PlatformGithubEventStorage } from './event-worker.js';

const POLL_MS = 15;

/** A database several replicas connect to independently. */
interface SharedDatabase {
  connect(id: string): FactoryStorage;
  drop(): Promise<void>;
}

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

const databases: Array<{ name: string; skip: boolean; create(): Promise<SharedDatabase> }> = [
  {
    name: 'LibSQL',
    skip: false,
    async create() {
      const directory = await mkdtemp(join(tmpdir(), 'linked-repositories-'));
      const url = `file:${join(directory, 'factory.db')}`;
      return {
        connect: id => new LibSQLFactoryStorage({ id, url }),
        drop: () => rm(directory, { recursive: true, force: true }),
      };
    },
  },
  {
    name: 'PostgreSQL',
    skip: !postgresUrl,
    async create() {
      const admin = new PostgresStore({ id: 'linked-repositories-admin', connectionString: postgresUrl!, disableInit: true });
      const schema = `factory_test_${randomUUID().replaceAll('-', '')}`;
      await admin.pool.query(`CREATE SCHEMA "${schema}"`);
      const url = new URL(postgresUrl!);
      url.searchParams.set('options', `-c search_path=${schema}`);
      return {
        connect: id => new PgFactoryStorage({ id, connectionString: url.toString() }),
        drop: async () => {
          await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
          await admin.close();
        },
      };
    },
  },
];

/** One Factory replica: its own storage connection to the shared database. */
async function createReplica(database: SharedDatabase, id: string) {
  const backend = database.connect(id);
  const projects = backend.registerDomain(new FactoryProjectsStorage());
  const domain = backend.registerDomain(new SourceControlStorage());
  await backend.init();
  return { backend, projects, domain, github: domain.forIntegration('github'), stopSharing: async () => {} };
}

type Replica = Awaited<ReturnType<typeof createReplica>>;

/** Connects a replica to the event bus, replacing any earlier connection. */
async function share(replica: Replica, pubsub: EventEmitterPubSub): Promise<void> {
  await replica.stopSharing();
  replica.stopSharing = async () => {};
  const stopSharing = await shareLinkedRepositoryChanges(pubsub, replica.domain).catch(() => undefined);
  if (stopSharing) replica.stopSharing = stopSharing;
}


async function linkRepository(replica: Replica, repositoryExternalId: string): Promise<{ unlink(): Promise<boolean> }> {
  const project = await replica.projects.create({
    orgId: 'org-1',
    userId: 'user-1',
    input: { name: `Project ${repositoryExternalId}` },
  });
  const installation = await replica.github.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '7',
    accountName: 'acme',
    accountType: 'organization',
  });
  const repository = await replica.github.repositories.upsert({
    orgId: 'org-1',
    input: {
      installationId: installation.id,
      externalId: repositoryExternalId,
      slug: `acme/repo-${repositoryExternalId}`,
      defaultBranch: 'main',
    },
  });
  const connection = await replica.github.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const link = await replica.github.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    createdByUserId: 'user-1',
    branch: null,
    sandboxProvider: 'local',
    sandboxWorkdir: '/workspace/repo',
  });
  return { unlink: () => replica.github.projectRepositories.unlink({ orgId: 'org-1', id: link.id }) };
}

describe.each(databases)('PlatformGithubEventWorker linked repositories on $name', ({ skip, create }) => {
  let database: SharedDatabase;
  /** The bus every replica's connection is attached to. */
  let bus: EventEmitter;
  let polling: Replica;
  let other: Replica;
  let worker: PlatformGithubEventWorker | undefined;
  /** Repository ids the worker asked the Platform for events of, in order. */
  let polled: string[];
  /** Names the Platform reports for repositories, by id. */
  let platformNames: Map<number, string>;
  /** Repositories each pull request reconcile sweep was handed. */
  let reconciled: Array<Array<{ id: number; fullName: string }>>;

  /** A replica's own connection to the shared event bus. */
  function connection(): EventEmitterPubSub {
    return new EventEmitterPubSub(bus);
  }

  beforeEach(async ({ skip: skipTest }) => {
    if (skip) skipTest();
    database = await create();
    bus = new EventEmitter();
    polling = await createReplica(database, 'polling');
    other = await createReplica(database, 'other');
    await share(polling, connection());
    await share(other, connection());
    polled = [];
    platformNames = new Map();
    reconciled = [];
  });

  afterEach(async () => {
    if (skip) return;
    await worker?.stop();
    worker = undefined;
    await polling.stopSharing();
    await other.stopSharing();
    await polling.backend.close();
    await other.backend.close();
    await database.drop();
  });


  async function startWorker(
    sourceControl: SourceControlStorageHandle = polling.github,
    { reconcile = false }: { reconcile?: boolean } = {},
  ) {
    // The cursor store is not under test: nothing here returns events, so it is only written on a repository's first poll.
    let settings: unknown = null;
    worker = new PlatformGithubEventWorker({
      client: new PlatformApiClient({
        baseUrl: 'https://platform.example.com',
        accessToken: 'platform-token',
        fetchImpl: async input => {
          const installationId = /\/installations\/(\d+)\/repositories$/.exec(String(input))?.[1];
          if (installationId) {
            const repositories = [...platformNames].map(([id, fullName]) => ({ id, fullName }));
            return new Response(JSON.stringify({ repositories }), { headers: { 'content-type': 'application/json' } });
          }
          const repositoryId = /\/repositories\/(\d+)\/events/.exec(String(input))?.[1];
          if (!repositoryId) throw new Error(`Unexpected request: ${String(input)}`);
          polled.push(repositoryId);
          return new Response(JSON.stringify({ events: [], nextCursor: null }), {
            headers: { 'content-type': 'application/json' },
          });
        },
      }),
      controller: {} as never,
      github: {} as never,
      storage: {
        integrationId: 'github',
        settings: {
          get: async () => settings,
          save: async (_orgId: string, _userId: string, next: unknown) => {
            settings = structuredClone(next);
          },
        },
      } as unknown as PlatformGithubEventStorage,
      sourceControl,
      onRepositoriesChanged: listener => sourceControl.onLinkedRepositoriesChanged(listener),
      repositoryChangesShared: () => sourceControl.linkedRepositoryChangesShared(),
      ...(reconcile
        ? {
            reconcileFactoryState: async repositories => {
              reconciled.push(repositories.map(({ id, fullName }) => ({ id, fullName })));
              return { repositories: repositories.length, checked: 0, merged: 0, closed: 0, failed: 0, errors: [] };
            },
          }
        : {}),
      intervalMs: POLL_MS,
    });
    await worker.init({
      pubsub: connection(),
      storage: {} as WorkerDeps['storage'],
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } as unknown as WorkerDeps['logger'],
    });
    await worker.start();
  }

  /** Resolves once the worker has polled `repositoryId` `times` more times. */
  async function polls(repositoryId: string, times: number): Promise<void> {
    const before = polled.filter(id => id === repositoryId).length;
    await vi.waitFor(() =>
      expect(polled.filter(id => id === repositoryId).length).toBeGreaterThanOrEqual(before + times),
    );
  }

  function countStorageReads(replica: Replica) {
    const findOne = vi.spyOn(replica.backend.ops, 'findOne');
    const findMany = vi.spyOn(replica.backend.ops, 'findMany');
    return () => findOne.mock.calls.length + findMany.mock.calls.length;
  }

  it('reads nothing from storage on polls where the linked repositories have not changed', async () => {
    await linkRepository(polling, '101');
    await startWorker();
    await polls('101', 1);

    const storageReads = countStorageReads(polling);
    await polls('101', 5);

    expect(storageReads()).toBe(0);
  });

  it('polls a repository linked on another replica, and stops when it is unlinked there', async () => {
    await linkRepository(polling, '101');
    await startWorker();
    await polls('101', 1);

    const link = await linkRepository(other, '202');
    await polls('202', 2);

    await link.unlink();
    // A poll already in flight may still ask for 202 once.
    await polls('101', 2);
    polled.length = 0;
    await polls('101', 3);
    expect(polled).not.toContain('202');
  });

  it('sweeps a repository under the name the Platform reports, without reading storage', async () => {
    await linkRepository(polling, '101');
    platformNames.set(101, 'acme/renamed');
    const storageReads = countStorageReads(polling);
    await startWorker(polling.github, { reconcile: true });
    await polls('101', 1);
    const readsForFirstPoll = storageReads();
    await polls('101', 3);

    expect(reconciled).toEqual([[{ id: 101, fullName: 'acme/renamed' }]]);
    expect(storageReads()).toBe(readsForFirstPoll);
  });

  it('re-reads the linked repositories on every poll while it is still subscribing to other replicas', async () => {
    const connected = Promise.withResolvers<void>();
    const pubsub = connection();
    const subscribe = pubsub.subscribe.bind(pubsub);
    vi.spyOn(pubsub, 'subscribe').mockImplementation(async (...args) => {
      await connected.promise;
      return subscribe(...args);
    });
    const sharing = share(polling, pubsub);
    await linkRepository(polling, '101');
    await startWorker();
    await polls('101', 1);

    // Announced before the polling replica is listening, so only a re-read finds it.
    await linkRepository(other, '202');
    await polls('202', 1);

    connected.resolve();
    await sharing;
    await polls('101', 2);
    const storageReads = countStorageReads(polling);
    await polls('101', 3);
    expect(storageReads()).toBe(0);
  });

  it('re-reads the linked repositories on every poll when it cannot subscribe to other replicas', async () => {
    const pubsub = connection();
    vi.spyOn(pubsub, 'subscribe').mockRejectedValue(new Error('broker unreachable'));
    await share(polling, pubsub);
    await linkRepository(polling, '101');
    await startWorker();
    await polls('101', 1);

    // The other replica stops announcing, as if its event bus connection had dropped.
    await other.stopSharing();
    await linkRepository(other, '202');
    await polls('202', 1);
  });

  it('still announces its own links when it cannot subscribe to other replicas', async () => {
    const pubsub = connection();
    vi.spyOn(pubsub, 'subscribe').mockRejectedValue(new Error('broker unreachable'));
    await share(other, pubsub);
    await linkRepository(polling, '101');
    await startWorker();
    await polls('101', 1);

    await linkRepository(other, '202');
    await polls('202', 2);
  });
});
