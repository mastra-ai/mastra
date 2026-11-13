import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { EventEmitterPubSub } from '@mastra/core/events';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { publishBoardChange, subscribeBoardChanges } from '../board-changes.js';
import type { Intake } from '../capabilities/intake.js';
import { FactoryProjectsStorage } from '../storage/domains/projects/base.js';
import type { FactoryProject } from '../storage/domains/projects/base.js';
import { WorkItemsStorage } from '../storage/domains/work-items/base.js';
import { createIssueReconciler } from './issue-reconciler.js';
import { KeptCards } from './kept-cards.js';

/** One Factory replica: its own storage connection to the shared database, wired as `MastraFactory` wires it. */
async function createReplica(url: string, pubsub: EventEmitterPubSub | undefined) {
  const backend = new LibSQLFactoryStorage({ id: 'kept-cards-test', url });
  const workItems = backend.registerDomain(new WorkItemsStorage());
  const projects = backend.registerDomain(new FactoryProjectsStorage());
  await backend.init();
  const cards = new KeptCards({ projects, workItems });
  let stop = async () => {};
  if (pubsub) {
    const origin = crypto.randomUUID();
    workItems.onBoardChanged(scope => {
      cards.changed(scope);
      publishBoardChange(pubsub, origin, scope);
    });
    projects.onDeleted(project => {
      const scope = { orgId: project.orgId, factoryProjectId: project.id };
      cards.changed(scope);
      publishBoardChange(pubsub, origin, scope);
    });
    stop = await subscribeBoardChanges(pubsub, origin, scope => cards.changed(scope));
    cards.trustAnnouncements();
  }
  return { backend, workItems, projects, cards, stop };
}

type Replica = Awaited<ReturnType<typeof createReplica>>;

function createProject(replica: Replica, name: string): Promise<FactoryProject> {
  return replica.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name } });
}

async function createJiraCard(replica: Replica, project: FactoryProject, key: string) {
  const { item } = await replica.workItems.upsert({
    orgId: project.orgId,
    userId: 'user-1',
    factoryProjectId: project.id,
    input: {
      externalSource: { integrationId: 'jira', type: 'issue', externalId: key },
      title: key,
      stages: ['intake'],
      sessions: {},
      metadata: {},
    },
  });
  return item;
}

/** Counts every call a replica makes to its database. */
function countStorageCalls(replica: Replica): () => number {
  const ops = replica.backend.ops as unknown as Record<string, unknown>;
  const names = new Set([...Object.keys(ops), ...Object.getOwnPropertyNames(Object.getPrototypeOf(ops))]);
  const spies = [...names]
    .filter(name => name !== 'constructor' && typeof ops[name] === 'function')
    .map(name => vi.spyOn(ops as Record<string, (...args: unknown[]) => unknown>, name));
  return () => spies.reduce((total, spy) => total + spy.mock.calls.length, 0);
}

describe('issue sweeps over kept cards', () => {
  let directory: string;
  let pubsub: EventEmitterPubSub;
  let sweeping: Replica;
  let other: Replica;
  /** What Jira reports for every issue. */
  let jiraState: string;
  /** Issue keys the sweep asked Jira for, in order. */
  let asked: string[];

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'kept-cards-'));
    const url = `file:${join(directory, 'factory.db')}`;
    pubsub = new EventEmitterPubSub();
    sweeping = await createReplica(url, pubsub);
    other = await createReplica(url, pubsub);
    jiraState = 'To Do';
    asked = [];
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await sweeping.stop();
    await other.stop();
    await sweeping.backend.close();
    await other.backend.close();
    await rm(directory, { recursive: true, force: true });
  });

  function jiraSweep(replica: Replica, cards: KeptCards | null = replica.cards) {
    const intake = {
      resolveIntakeDispatch: async ({ externalSource }: { externalSource: { externalId: string } }) => ({
        issueId: externalSource.externalId,
      }),
      getIssue: async ({ issueId }: { issueId: string }) => {
        asked.push(issueId);
        return { id: issueId, state: jiraState, stateType: 'unstarted' };
      },
    } as unknown as Intake;
    return createIssueReconciler({
      integrationId: 'jira',
      intake,
      projects: replica.projects,
      storage: replica.workItems,
      ...(cards ? { cards } : {}),
      issueId: item => item.externalSource?.externalId,
      isTerminal: () => false,
      metadata: (_item, issue) => ({ state: issue.state }),
    });
  }

  it('asks the provider about every card without reading the database while nothing changes', async () => {
    const project = await createProject(sweeping, 'Factory');
    await createJiraCard(sweeping, project, 'ENG-1');
    const sweep = jiraSweep(sweeping);
    await expect(sweep()).resolves.toMatchObject({ checked: 1, updated: 1 });
    // The sweep's own write changed the board, so the next one reads it once more.
    await expect(sweep()).resolves.toMatchObject({ checked: 1, updated: 0 });

    const storageCalls = countStorageCalls(sweeping);
    asked = [];
    await expect(sweep()).resolves.toMatchObject({ projects: 1, checked: 1, updated: 0 });
    await expect(sweep()).resolves.toMatchObject({ projects: 1, checked: 1, updated: 0 });

    expect(asked).toEqual(['ENG-1', 'ENG-1']);
    expect(storageCalls()).toBe(0);
  });

  it('reads the database on every sweep when no kept cards are passed', async () => {
    const project = await createProject(sweeping, 'Factory');
    await createJiraCard(sweeping, project, 'ENG-1');
    const sweep = jiraSweep(sweeping, null);
    await sweep();
    await sweep();

    const storageCalls = countStorageCalls(sweeping);
    await expect(sweep()).resolves.toMatchObject({ checked: 1, updated: 0 });

    expect(storageCalls()).toBeGreaterThan(0);
  });

  it('sweeps a card another replica imported, in a project another replica created', async () => {
    const project = await createProject(sweeping, 'Factory');
    await createJiraCard(sweeping, project, 'ENG-1');
    const sweep = jiraSweep(sweeping);
    await sweep();
    await sweep();

    await createJiraCard(other, project, 'ENG-2');
    const added = await createProject(other, 'Second');
    await createJiraCard(other, added, 'OPS-1');

    await vi.waitFor(async () => {
      asked = [];
      await sweep();
      expect(asked.toSorted()).toEqual(['ENG-1', 'ENG-2', 'OPS-1']);
    });
  });

  it('stops sweeping the cards of a project another replica deleted', async () => {
    const kept = await createProject(sweeping, 'Factory');
    await createJiraCard(sweeping, kept, 'ENG-1');
    const deleted = await createProject(sweeping, 'Old');
    await createJiraCard(sweeping, deleted, 'OLD-1');
    const sweep = jiraSweep(sweeping);
    await sweep();
    await sweep();

    await other.projects.delete({ orgId: deleted.orgId, id: deleted.id });

    await vi.waitFor(async () => {
      asked = [];
      await sweep();
      expect(asked).toEqual(['ENG-1']);
    });
  });

  it('stores a provider change without undoing a card change it never heard about', async () => {
    const project = await createProject(sweeping, 'Factory');
    const card = await createJiraCard(sweeping, project, 'ENG-1');
    const sweep = jiraSweep(sweeping);
    await sweep();
    await sweep();
    await sweeping.workItems.syncCard({
      orgId: project.orgId,
      id: card.id,
      userId: 'user-1',
      patch: { metadata: { owner: 'ada' } },
    });
    await sweep();

    // A replica whose announcements are lost: the sweeping replica keeps the card it read before.
    const silent = await createReplica(`file:${join(directory, 'factory.db')}`, undefined);
    await silent.workItems.syncCard({
      orgId: project.orgId,
      id: card.id,
      userId: 'user-1',
      patch: { metadata: { owner: 'grace' } },
    });
    await silent.backend.close();

    jiraState = 'In Progress';
    await expect(sweep()).resolves.toMatchObject({ checked: 1, updated: 1 });

    const stored = await sweeping.workItems.get({ orgId: project.orgId, id: card.id });
    expect({ ...stored?.workItem.metadata, ...stored?.metadata }).toMatchObject({
      state: 'In Progress',
      owner: 'grace',
    });
  });

  it('keeps nothing until announcements from other replicas are trusted', async () => {
    const project = await createProject(sweeping, 'Factory');
    await createJiraCard(sweeping, project, 'ENG-1');
    const untrusted = new KeptCards({ projects: sweeping.projects, workItems: sweeping.workItems });
    const sweep = jiraSweep(sweeping, untrusted);
    await sweep();
    await sweep();

    const storageCalls = countStorageCalls(sweeping);
    await expect(sweep()).resolves.toMatchObject({ checked: 1, updated: 0 });

    expect(storageCalls()).toBeGreaterThan(0);
  });
});
