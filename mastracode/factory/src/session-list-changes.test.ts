import { EventEmitter } from 'node:events';

import { EventEmitterPubSub } from '@mastra/core/events';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { feedTopic } from './feed-events.js';
import { shareSessionListChanges } from './session-list-changes.js';
import type { ProjectListScope } from './storage/announced-lists.js';
import type { SourceControlStorageHandle } from './storage/domains/source-control/base.js';
import { createSharedFactoryDatabaseForTests } from './storage/test-utils.js';
import type { FactoryStorageTestSeed } from './storage/test-utils.js';

const SESSION_ID = '00000000-0000-4000-8000-000000000301';

async function linkRepository(replica: FactoryStorageTestSeed) {
  const github = replica.sourceControl.forIntegration('github');
  const project = await replica.projects.create({ orgId: 'org-1', userId: 'user-1', input: { name: 'Shipyard' } });
  const installation = await github.installations.upsert({
    orgId: 'org-1',
    connectedByUserId: 'user-1',
    externalId: '7',
    accountName: 'acme',
    accountType: 'organization',
  });
  const repository = await github.repositories.upsert({
    orgId: 'org-1',
    input: { installationId: installation.id, externalId: '1', slug: 'acme/app', defaultBranch: 'main' },
  });
  const connection = await github.connections.create({
    orgId: 'org-1',
    factoryProjectId: project.id,
    installationId: installation.id,
    createdByUserId: 'user-1',
  });
  const link = await github.projectRepositories.link({
    orgId: 'org-1',
    connectionId: connection.id,
    repositoryId: repository.id,
    branch: null,
  });
  return { project, link };
}

async function twoReplicas(options: { aShares?: boolean; bSubscribes?: boolean } = {}) {
  const database = await createSharedFactoryDatabaseForTests();
  const bus = new EventEmitter();
  const a = await database.connect('replica-a');
  const b = await database.connect('replica-b');
  const stops: Array<() => Promise<void>> = [];
  if (options.aShares !== false) {
    stops.push(await shareSessionListChanges(new EventEmitterPubSub(bus), a));
  }
  const bPubsub = new EventEmitterPubSub(bus);
  if (options.bSubscribes === false) {
    bPubsub.subscribe = async () => {
      throw new Error('broker unreachable');
    };
  }
  stops.push(await shareSessionListChanges(bPubsub, b));
  const { project, link } = await linkRepository(a);
  const scope = { orgId: 'org-1', factoryProjectId: project.id };
  const frames: number[] = [];
  bus.on(feedTopic(scope.orgId, scope.factoryProjectId), () => frames.push(Date.now()));
  return {
    a: { ...a, github: a.sourceControl.forIntegration('github') },
    b: { ...b, github: b.sourceControl.forIntegration('github') },
    scope,
    link,
    frames,
    stop: () => Promise.all(stops.map(stop => stop())),
  };
}

const sessionsSeenBy = async (
  replica: { github: SourceControlStorageHandle },
  scope: ProjectListScope,
  viewerUserId: string,
) =>
  (await replica.github.sessions.listByProject({ ...scope, viewerUserId })).map(
    session => `${session.sessionId}:${session.title ?? ''}`,
  );
describe('session lists shared between replicas', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("shows a teammate's new, renamed or hidden session on the other replica's next read", async () => {
    const replicas = await twoReplicas();
    const { a, b, scope, link, frames } = replicas;
    try {
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([]);

      await a.github.sessions.create({
        sessionId: SESSION_ID,
        projectRepositoryId: link.id,
        orgId: 'org-1',
        userId: 'user-1',
        branch: 'feat/x',
        baseBranch: 'main',
      });
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([`${SESSION_ID}:`]);

      await a.github.sessions.rename({ sessionId: SESSION_ID, title: 'Fix login' });
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([`${SESSION_ID}:Fix login`]);

      await a.github.sessions.setVisibility({ sessionId: SESSION_ID, visibility: 'private', expectedUserId: 'user-1' });
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([]);
      expect(await sessionsSeenBy(b, scope, 'user-1')).toEqual([`${SESSION_ID}:Fix login`]);

      expect(frames).toHaveLength(3);
    } finally {
      await replicas.stop();
    }
  });

  it("shows a follow made or dropped on one replica on the other's next read", async () => {
    const replicas = await twoReplicas();
    const { a, b, scope, frames } = replicas;
    try {
      const { item } = await a.workItems.upsert({
        ...scope,
        userId: 'user-1',
        input: {
          externalSource: { integrationId: 'github', type: 'issue', externalId: '42' },
          title: 'Fix login',
          stages: ['intake'],
          sessions: {},
          metadata: {},
        },
      });
      const followsSeenByB = async () =>
        (await b.workItems.listProjectSubscriptions(scope)).map(row => `${row.sessionId}:${row.workItemId}`);
      expect(await followsSeenByB()).toEqual([]);
      frames.length = 0;

      await a.workItems.subscribeToWorkItem({
        ...scope,
        workItemId: item.id,
        sessionId: SESSION_ID,
        threadId: 'thread-1',
        resourceId: 'resource-1',
        userId: 'user-1',
        reason: 'subscribed',
      });
      expect(await followsSeenByB()).toEqual([`${SESSION_ID}:${item.id}`]);

      await a.workItems.unsubscribeFromWorkItem({ ...scope, workItemId: item.id, sessionId: SESSION_ID });
      expect(await followsSeenByB()).toEqual([]);

      expect(frames).toHaveLength(2);
    } finally {
      await replicas.stop();
    }
  });

  it('reads storage on every request while the replica could not subscribe to announcements', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const replicas = await twoReplicas({ bSubscribes: false });
    const { a, b, scope, link } = replicas;
    try {
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('subscribing to session list changes failed'));
      await a.github.sessions.create({
        sessionId: SESSION_ID,
        projectRepositoryId: link.id,
        orgId: 'org-1',
        userId: 'user-1',
        branch: 'feat/x',
        baseBranch: 'main',
      });
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([`${SESSION_ID}:`]);

      await a.github.sessions.rename({ sessionId: SESSION_ID, title: 'Fix login' });
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([`${SESSION_ID}:Fix login`]);
    } finally {
      await replicas.stop();
    }
  });

  it('shows a write whose announcement was lost within a minute', async () => {
    const replicas = await twoReplicas({ aShares: false });
    const { a, b, scope, link } = replicas;
    try {
      await a.github.sessions.create({
        sessionId: SESSION_ID,
        projectRepositoryId: link.id,
        orgId: 'org-1',
        userId: 'user-1',
        branch: 'feat/x',
        baseBranch: 'main',
      });
      vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-11-16T10:00:00Z') });
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([`${SESSION_ID}:`]);

      await a.github.sessions.rename({ sessionId: SESSION_ID, title: 'Fix login' });
      vi.setSystemTime(Date.now() + 59_999);
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([`${SESSION_ID}:`]);

      vi.setSystemTime(Date.now() + 1);
      expect(await sessionsSeenBy(b, scope, 'user-2')).toEqual([`${SESSION_ID}:Fix login`]);
    } finally {
      await replicas.stop();
    }
  });
});
