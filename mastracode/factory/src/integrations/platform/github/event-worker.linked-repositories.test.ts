import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EventEmitterPubSub } from '@mastra/core/events';
import type { WorkerDeps } from '@mastra/core/worker';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shareLinkedRepositoryChanges } from '../../../linked-repositories-changed.js';
import { FactoryProjectsStorage } from '../../../storage/domains/projects/base.js';
import { SourceControlStorage } from '../../../storage/domains/source-control/base.js';
import type { SourceControlStorageHandle } from '../../../storage/domains/source-control/base.js';
import { PlatformApiClient } from '../api-client.js';
import { PlatformGithubEventWorker } from './event-worker.js';
import type { PlatformGithubEventStorage } from './event-worker.js';

const POLL_MS = 15;

/** One Factory replica: its own storage connection to the shared database. */
async function createReplica(url: string, pubsub: EventEmitterPubSub) {
  const backend = new LibSQLFactoryStorage({ id: 'linked-repositories-test', url });
  const projects = backend.registerDomain(new FactoryProjectsStorage());
  const domain = backend.registerDomain(new SourceControlStorage());
  await backend.init();
  const stopSharing = await shareLinkedRepositoryChanges(pubsub, domain);
  return { backend, projects, github: domain.forIntegration('github'), stopSharing };
}

type Replica = Awaited<ReturnType<typeof createReplica>>;

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

describe('PlatformGithubEventWorker linked repositories', () => {
  let directory: string;
  let pubsub: EventEmitterPubSub;
  let polling: Replica;
  let other: Replica;
  let worker: PlatformGithubEventWorker | undefined;
  /** Repository ids the worker asked the Platform for events of, in order. */
  let polled: string[];
  let clock: number;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'linked-repositories-'));
    const url = `file:${join(directory, 'factory.db')}`;
    pubsub = new EventEmitterPubSub();
    polling = await createReplica(url, pubsub);
    other = await createReplica(url, pubsub);
    polled = [];
    clock = 1_000;
  });

  afterEach(async () => {
    await worker?.stop();
    worker = undefined;
    await polling.stopSharing();
    await other.stopSharing();
    await polling.backend.close();
    await other.backend.close();
    await rm(directory, { recursive: true, force: true });
  });

  async function startWorker(sourceControl: SourceControlStorageHandle = polling.github) {
    // The cursor store is not under test: nothing here returns events, so it is only written on a repository's first poll.
    let settings: unknown = null;
    worker = new PlatformGithubEventWorker({
      client: new PlatformApiClient({
        baseUrl: 'https://platform.example.com',
        accessToken: 'platform-token',
        fetchImpl: async input => {
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
      intervalMs: POLL_MS,
      now: () => clock,
    });
    await worker.init({
      pubsub,
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

  it('re-reads the linked repositories after an hour, so a change it never heard of is still picked up', async () => {
    await linkRepository(polling, '101');
    await startWorker();
    await polls('101', 1);

    // The other replica stops announcing, as if its event bus connection had dropped.
    await other.stopSharing();
    await linkRepository(other, '202');
    await polls('101', 3);
    expect(polled).not.toContain('202');

    clock += 60 * 60_000;
    await polls('202', 1);
  });
});
