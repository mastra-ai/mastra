import { getDynamicMemory } from '@mastra/code-sdk/agents/memory';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import {
  migrateSessionResources,
  privatizeOwnerResourceSessions,
  sessionMemoryResource,
} from './resource-migration.js';
import { listFactorySessionThreads, sessionMemoryResourceId } from './session-threads.js';

const FACTORY_ID = '11111111-2222-4333-8444-555555555555';

/** Sessions as they were stored before shared resources: every resource id is the session id. */
const USER_SESSION = 'aaaaaaaa-0000-4000-8000-000000000001';
const RUN_SESSION = 'aaaaaaaa-0000-4000-8000-000000000002';
const SLACK_SESSION = 'aaaaaaaa-0000-4000-8000-000000000003';
const ORPHAN_SESSION = 'aaaaaaaa-0000-4000-8000-000000000004';
/** Started by an agent from the user session, to work for the Factory. */
const SIDE_SESSION = 'aaaaaaaa-0000-4000-8000-000000000005';
/** A Slack DM: private to its sender. */
const SLACK_DM_SESSION = 'aaaaaaaa-0000-4000-8000-000000000006';
/** A review run on a pull request: untrusted content, so it keeps its own resource. */
const PR_SESSION = 'aaaaaaaa-0000-4000-8000-000000000007';

const OBSERVATION_INDEX = 'memory_observations_384';

/** A vector store that honours metadata filters and, like LibSQL, replaces metadata on update. */
function createVectorStore() {
  const entries = new Map<string, Record<string, unknown>>();
  const matches = (metadata: Record<string, unknown>, filter: Record<string, unknown> = {}) =>
    Object.entries(filter).every(([key, expected]) =>
      expected && typeof expected === 'object' && '$ne' in expected
        ? metadata[key] !== (expected as { $ne: unknown }).$ne
        : metadata[key] === expected,
    );
  return {
    entries,
    store: {
      id: 'legacy-vector',
      listIndexes: vi.fn(async () => [OBSERVATION_INDEX]),
      describeIndex: vi.fn(async () => ({ dimension: 384, count: entries.size, metric: 'cosine' })),
      query: vi.fn(async ({ filter, topK }: { filter?: Record<string, unknown>; topK: number }) =>
        [...entries]
          .filter(([, metadata]) => matches(metadata, filter))
          .slice(0, topK)
          .map(([id, metadata]) => ({ id, score: 1, metadata })),
      ),
      updateVector: vi.fn(async ({ id, update }: { id: string; update: { metadata: Record<string, unknown> } }) => {
        entries.set(id, update.metadata);
      }),
    },
  };
}

async function seedLegacyFactory() {
  const seed = await createFactoryStorageForTests();
  const memoryStore = new InMemoryStore({ id: 'legacy-memory' });
  const memory = (await memoryStore.getStore('memory')) as MemoryStorage;
  const ops = seed.storage.ops;
  const now = new Date('2026-09-01T00:00:00.000Z');

  const sessionRow = (
    sessionId: string,
    branch: string,
    factoryProjectId: string | null,
    originSessionId?: string,
    visibility: 'org' | 'private' = 'org',
  ) =>
    ops.insertOne('source_control_sessions', {
      session_id: sessionId,
      project_repository_id: 'project-repository-1',
      factory_project_id: factoryProjectId,
      org_id: 'org-1',
      user_id: 'user-1',
      branch,
      base_branch: 'main',
      title: null,
      visibility,
      sandbox_id: null,
      sandbox_workdir: null,
      materialized_at: null,
      first_message_at: null,
      first_meaningful_exec_at: null,
      created_at: now,
      updated_at: now,
      ...(originSessionId ? { origin_session_id: originSessionId, origin_thread_id: originSessionId } : {}),
    });
  await sessionRow(USER_SESSION, `user/session-${USER_SESSION}`, FACTORY_ID);
  await sessionRow(RUN_SESSION, 'factory/issue-7', FACTORY_ID);
  await sessionRow(SLACK_SESSION, 'slack/1700-42', FACTORY_ID);
  await sessionRow(ORPHAN_SESSION, 'slack/1700-43', null);
  await sessionRow(SIDE_SESSION, `user/session-${SIDE_SESSION}`, FACTORY_ID, USER_SESSION);
  await sessionRow(SLACK_DM_SESSION, 'slack/D-1-1700-44', FACTORY_ID, undefined, 'private');
  await sessionRow(PR_SESSION, 'factory/pr-8', FACTORY_ID);
  const pullRequest = await seed.workItems.upsert({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: FACTORY_ID,
    input: {
      externalSource: { integrationId: 'github', type: 'pull-request', externalId: '8' },
      title: 'Review PR 8',
      stages: ['review'],
      sessions: {},
      metadata: { authorTrusted: true },
    },
  });
  await ops.insertOne('factory_run_bindings', {
    org_id: 'org-1',
    factory_project_id: FACTORY_ID,
    work_item_id: pullRequest.item.id,
    role: 'review',
    thread_id: PR_SESSION,
    resource_id: PR_SESSION,
    session_id: PR_SESSION,
    branch: 'factory/pr-8',
    status: 'revoked',
    created_at: now,
    revoked_at: now,
  });

  const issue = await seed.workItems.upsert({
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: FACTORY_ID,
    input: { title: 'Issue 7', stages: ['execute'], sessions: {} },
  });
  await ops.insertOne('factory_run_bindings', {
    org_id: 'org-1',
    factory_project_id: FACTORY_ID,
    work_item_id: issue.item.id,
    role: 'work',
    thread_id: RUN_SESSION,
    resource_id: RUN_SESSION,
    session_id: RUN_SESSION,
    branch: 'factory/issue-7',
    status: 'revoked',
    created_at: now,
    revoked_at: now,
  });
  await ops.insertOne('integration_subscriptions', {
    integration_id: 'github',
    org_id: 'org-1',
    target_key: 'pr:7:99:42',
    session_id: USER_SESSION,
    resource_id: USER_SESSION,
    thread_id: USER_SESSION,
    session_scope: '/workspace/legacy',
    status: 'active',
    data: {},
    created_at: now,
    updated_at: now,
  });

  for (const sessionId of [
    USER_SESSION,
    RUN_SESSION,
    SLACK_SESSION,
    ORPHAN_SESSION,
    SIDE_SESSION,
    SLACK_DM_SESSION,
    PR_SESSION,
  ]) {
    await memory.saveThread({
      thread: {
        id: sessionId,
        resourceId: sessionId,
        title: 'Legacy',
        metadata: { kept: true },
        createdAt: now,
        updatedAt: now,
      },
    });
    await memory.saveMessages({
      messages: [
        {
          id: `message-${sessionId}`,
          threadId: sessionId,
          resourceId: sessionId,
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: `hello from ${sessionId}` }] },
          createdAt: now,
        },
      ],
    });
  }
  // A second conversation the user opened inside their session.
  await memory.saveThread({
    thread: { id: 'user-second-thread', resourceId: USER_SESSION, title: 'Second', createdAt: now, updatedAt: now },
  });

  // An observation the run session made before the upgrade, indexed for recall search.
  const vector = createVectorStore();
  vector.entries.set('observation-run', {
    group_id: 'group-1',
    range: 'message-1:message-2',
    thread_id: RUN_SESSION,
    resource_id: RUN_SESSION,
    text: 'The deploy target is staging',
  });
  // The user session ran with resource-scoped observational memory.
  await memory.initializeObservationalMemory({
    threadId: null,
    resourceId: USER_SESSION,
    scope: 'resource',
    config: {},
  });

  const sessionMemory = getDynamicMemory(memoryStore, vector.store as never)({ requestContext: new RequestContext() });
  const migrate = ({ integrationsReady = true } = {}) =>
    migrateSessionResources({
      sessions: seed.sourceControl,
      workItems: seed.workItems,
      ...(integrationsReady ? { integrations: seed.integrations } : {}),
      memory,
      threads: sessionMemory,
    });
  return { seed, memoryStore, memory, ops, vector, migrate, now };
}

describe('sessionMemoryResource', () => {
  const base = {
    sessionId: 'session-1',
    orgId: 'org-1',
    userId: 'user-1',
    factoryProjectId: FACTORY_ID,
    branch: 'user/session-1',
    visibility: 'org',
    originSessionId: null,
  } as SourceControlSession;

  // Each row migrates onto the resource the runtime then lets it claim threads under.
  it.each([
    ['a person-opened session', {}, [], 'user-1'],
    ['an org side session', { originSessionId: 'parent-1' }, [], FACTORY_ID],
    ['a private side session', { originSessionId: 'parent-1', visibility: 'private' }, [], 'user-1'],
    ['a Slack channel thread', { branch: 'slack/1700-42' }, [], FACTORY_ID],
    ['a Slack DM', { branch: 'slack/D-1-1700-44', visibility: 'private' }, [], 'user-1'],
    ['a trusted run', {}, [{ externalSource: null, metadata: {} }], FACTORY_ID],
  ] as const)('moves %s to the resource the runtime grants it', async (_name, row, items, expected) => {
    const session = { ...base, ...row } as SourceControlSession;
    expect(sessionMemoryResource(session, [...items] as never).resourceId).toBe(expected);
    const runs = { hasRunBindingForSession: async () => items.length > 0 };
    const own = { queryThreadById: async () => ({ id: session.sessionId, resourceId: expected }) as never };
    expect(await sessionMemoryResourceId(own, session, runs)).toBe(expected);
  });
});

describe('migrateSessionResources', () => {
  it('moves each legacy session onto its Factory or owner, and leaves sessions without a Factory alone', async () => {
    const { memory, ops, vector, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const report = await migrate();

    expect(report).toMatchObject({
      sessions: 7,
      factorySessions: 3,
      userSessions: 2,
      isolatedSessions: 1,
      skipped: [ORPHAN_SESSION],
      failed: [],
      threads: 6,
      runBindings: 1,
      subscriptions: 1,
      resourceObservationsLeft: [USER_SESSION],
    });
    // Resource-scoped observational memory stays under the old resource; the log says so.
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`session ${USER_SESSION} has resource-scoped`));
    expect(await memory.getObservationalMemory(null, USER_SESSION)).toMatchObject({ resourceId: USER_SESSION });

    // Recall search filters observations by resource, so the run's past observation follows it.
    expect(vector.entries.get('observation-run')).toEqual({
      group_id: 'group-1',
      range: 'message-1:message-2',
      thread_id: RUN_SESSION,
      resource_id: FACTORY_ID,
      text: 'The deploy target is staging',
    });

    const thread = (id: string) => memory.getThreadById({ threadId: id });
    expect(await thread(USER_SESSION)).toMatchObject({
      resourceId: 'user-1',
      metadata: { kept: true, factorySessionId: USER_SESSION },
    });
    expect(await thread('user-second-thread')).toMatchObject({
      resourceId: 'user-1',
      metadata: { factorySessionId: USER_SESSION },
    });
    expect(await thread(RUN_SESSION)).toMatchObject({
      resourceId: FACTORY_ID,
      metadata: { factorySessionId: RUN_SESSION },
    });
    expect(await thread(SLACK_SESSION)).toMatchObject({
      resourceId: FACTORY_ID,
      metadata: { factorySessionId: SLACK_SESSION },
    });
    // A side session works for the Factory, though a person's session started it.
    expect(await thread(SIDE_SESSION)).toMatchObject({
      resourceId: FACTORY_ID,
      metadata: { factorySessionId: SIDE_SESSION },
    });
    // Skipped: no Factory to move onto, so nothing about it changes.
    expect(await thread(ORPHAN_SESSION)).toMatchObject({ resourceId: ORPHAN_SESSION, metadata: { kept: true } });
    expect((await thread(ORPHAN_SESSION))?.metadata).not.toHaveProperty('factorySessionId');

    const { messages } = await memory.listMessages({ threadId: RUN_SESSION });
    expect(messages.map(message => message.resourceId)).toEqual([FACTORY_ID]);

    expect(await ops.findMany('factory_run_bindings', {})).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ session_id: RUN_SESSION, thread_id: RUN_SESSION, resource_id: FACTORY_ID }),
        expect.objectContaining({ session_id: PR_SESSION, thread_id: PR_SESSION, resource_id: PR_SESSION }),
      ]),
    );
    expect(await ops.findMany('integration_subscriptions', {})).toEqual([
      expect.objectContaining({ session_id: USER_SESSION, resource_id: 'user-1', session_scope: '/workspace/legacy' }),
    ]);

    // The Factory's resource now lists its runs and Slack sessions; the user's lists only theirs.
    const byResource = async (resourceId: string) =>
      (await memory.listThreads({ filter: { resourceId }, perPage: false })).threads.map(t => t.id).sort();
    expect(await byResource(FACTORY_ID)).toEqual([RUN_SESSION, SLACK_SESSION, SIDE_SESSION].sort());
    expect(await byResource('user-1')).toEqual([USER_SESSION, SLACK_DM_SESSION, 'user-second-thread'].sort());
    // The pull request run stays on its own resource, away from the Factory's memory.
    expect(await byResource(PR_SESSION)).toEqual([PR_SESSION]);
  });

  it('changes nothing when it runs again', async () => {
    const { memory, ops, vector, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await migrate();
    vector.store.updateVector.mockClear();
    const snapshot = async () => ({
      threads: (await memory.listThreads({ perPage: false })).threads.map(({ id, resourceId, metadata }) => ({
        id,
        resourceId,
        metadata,
      })),
      bindings: await ops.findMany('factory_run_bindings', {}),
      subscriptions: await ops.findMany('integration_subscriptions', {}),
      sessions: await ops.findMany('source_control_sessions', {}),
    });
    const before = await snapshot();

    const second = await migrate();

    expect(second).toMatchObject({
      threads: 0,
      runBindings: 0,
      subscriptions: 0,
      failed: [],
      resourceObservationsLeft: [],
    });
    expect(await snapshot()).toEqual(before);
    expect(vector.store.updateVector).not.toHaveBeenCalled();
  });

  it('keeps a run whose bound work item no longer loads on its own resource', async () => {
    const { memory, ops, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await ops.updateMany('factory_run_bindings', { session_id: RUN_SESSION }, { work_item_id: 'deleted-item' });

    const report = await migrate();

    expect(report).toMatchObject({ isolatedSessions: 2, failed: [] });
    expect((await memory.getThreadById({ threadId: RUN_SESSION }))?.resourceId).toBe(RUN_SESSION);
    expect(await ops.findOne('factory_run_bindings', { session_id: RUN_SESSION })).toMatchObject({
      resource_id: RUN_SESSION,
    });
  });

  it('says how many sessions it moves and reports progress during a long migration', async () => {
    const { seed, migrate } = await seedLegacyFactory();
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    info.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Each session takes 6s, as against a slow remote database.
    let clock = 1_000_000;
    const now = vi.spyOn(Date, 'now').mockImplementation(() => clock);
    const listRunBoundItems = seed.workItems.listRunBoundItems.bind(seed.workItems);
    vi.spyOn(seed.workItems, 'listRunBoundItems').mockImplementation(sessionId => {
      clock += 6_000;
      return listRunBoundItems(sessionId);
    });

    try {
      await migrate();
    } finally {
      now.mockRestore();
    }

    const lines = info.mock.calls.map(([line]) => String(line));
    // Progress at most every 10s, never once the last session is done.
    expect(lines).toEqual([
      '[factory] session resource migration: moving 7 sessions in the background',
      expect.stringMatching(/^\[factory\] session resource migration: 2\/7 sessions checked, \d+ threads moved$/),
      expect.stringMatching(/^\[factory\] session resource migration: 4\/7 sessions checked, \d+ threads moved$/),
      expect.stringMatching(/^\[factory\] session resource migration: 6\/7 sessions checked, \d+ threads moved$/),
      expect.stringContaining('[factory] session resource migration: 6 threads'),
    ]);
  });

  it('reads only sessions it has not finished on later starts', async () => {
    const { seed, memory, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await migrate();
    const listThreads = vi.spyOn(memory, 'listThreads');
    const listRunBoundItems = vi.spyOn(seed.workItems, 'listRunBoundItems');

    const second = await migrate();

    // Only the session without a Factory is left; it is skipped again before any thread is read.
    expect(second).toMatchObject({ sessions: 1, skipped: [ORPHAN_SESSION], threads: 0 });
    expect(listRunBoundItems.mock.calls).toEqual([[ORPHAN_SESSION]]);
    expect(listThreads).not.toHaveBeenCalled();
  });

  it("moves a session's subscriptions on a later start when integrations weren't ready", async () => {
    const { ops, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const first = await migrate({ integrationsReady: false });

    expect(first.subscriptionsPending).toContain(USER_SESSION);
    expect(await ops.findMany('integration_subscriptions', {})).toEqual([
      expect.objectContaining({ session_id: USER_SESSION, resource_id: USER_SESSION }),
    ]);

    const second = await migrate();

    expect(second).toMatchObject({ subscriptions: 1, subscriptionsPending: [], failed: [] });
    expect(await ops.findMany('integration_subscriptions', {})).toEqual([
      expect.objectContaining({ session_id: USER_SESSION, resource_id: 'user-1' }),
    ]);
  });

  it('resumes a session after a crash between tagging and moving a thread', async () => {
    const { memory, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const move = memory.updateThreadResourceId.bind(memory);
    const crash = vi.spyOn(memory, 'updateThreadResourceId').mockRejectedValueOnce(new Error('connection reset'));

    const first = await migrate();
    expect(first.failed).toHaveLength(1);
    crash.mockImplementation(move);

    const second = await migrate();

    expect(second.failed).toEqual([]);
    for (const id of [USER_SESSION, RUN_SESSION, SLACK_SESSION]) {
      expect((await memory.getThreadById({ threadId: id }))?.resourceId).not.toBe(id);
    }
  });

  it('finishes moving the observations of a thread that storage moved before a crash', async () => {
    const { memory, vector, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vector.store.updateVector.mockRejectedValueOnce(new Error('vector store unavailable'));

    const first = await migrate();

    // Storage moved the thread, so it is no longer listed under its session id.
    expect(first.failed).toEqual([RUN_SESSION]);
    expect(await memory.getThreadById({ threadId: RUN_SESSION })).toMatchObject({
      resourceId: FACTORY_ID,
      metadata: { factoryResourceMovePending: true },
    });
    expect(vector.entries.get('observation-run')).toMatchObject({ resource_id: RUN_SESSION });

    const second = await migrate();

    expect(second).toMatchObject({ failed: [], threads: 1 });
    expect(vector.entries.get('observation-run')).toMatchObject({ resource_id: FACTORY_ID });
    expect(await memory.getThreadById({ threadId: RUN_SESSION })).toMatchObject({
      resourceId: FACTORY_ID,
      metadata: { factorySessionId: RUN_SESSION, factoryResourceMovePending: false },
    });
  });

  it("keeps a private run's other threads listed under the session after moving its own thread", async () => {
    const { seed, memoryStore, memory, ops, migrate, now } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await ops.updateMany('source_control_sessions', { session_id: RUN_SESSION }, { visibility: 'private' });
    await memory.saveThread({
      thread: { id: 'run-second-thread', resourceId: RUN_SESSION, title: 'Second', createdAt: now, updatedAt: now },
    });

    await migrate();

    // Its own thread moves onto the Factory; a stamp there wouldn't count for a private session.
    expect((await memory.getThreadById({ threadId: RUN_SESSION }))?.resourceId).toBe(FACTORY_ID);
    expect((await memory.getThreadById({ threadId: 'run-second-thread' }))?.resourceId).toBe(RUN_SESSION);
    const controller = new AgentController({
      id: 'code',
      storage: memoryStore,
      stateSchema: undefined,
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          defaultModelId: 'openai/gpt-5.5',
          agent: new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'Test.', model: 'openai/gpt-5.5' }),
        },
      ],
    });
    await controller.init();
    const listed = await listFactorySessionThreads(
      controller,
      { sessionId: RUN_SESSION, orgId: 'org-1', userId: 'user-1', factoryProjectId: FACTORY_ID, visibility: 'private' },
      seed.workItems,
    );
    expect(listed.map(thread => thread.id).sort()).toEqual([RUN_SESSION, 'run-second-thread'].sort());
  });

  it('opens a migrated session by its id with its old conversation', async () => {
    const { seed, memoryStore, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    await migrate();
    const controller = new AgentController({
      id: 'code',
      storage: memoryStore,
      stateSchema: undefined,
      modes: [
        {
          id: 'build',
          name: 'Build',
          default: true,
          defaultModelId: 'openai/gpt-5.5',
          agent: new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'Test.', model: 'openai/gpt-5.5' }),
        },
      ],
    });
    await controller.init();

    const session = await controller.createSession({ id: RUN_SESSION, resourceId: FACTORY_ID, threadId: RUN_SESSION });

    expect(session.identity.getId()).toBe(RUN_SESSION);
    expect(session.thread.getId()).toBe(RUN_SESSION);
    const messages = await session.thread.listMessages({ threadId: RUN_SESSION });
    expect(messages.map(message => message.id)).toEqual([`message-${RUN_SESSION}`]);
    expect(
      (
        await listFactorySessionThreads(
          controller,
          { sessionId: RUN_SESSION, orgId: 'org-1', userId: 'user-1', factoryProjectId: FACTORY_ID },
          seed.workItems,
        )
      ).map(thread => thread.id),
    ).toEqual([RUN_SESSION]);
  });
});

describe('privatizeOwnerResourceSessions', () => {
  it("makes shared user sessions on their owner's memory private, and leaves everything else alone", async () => {
    const { seed, memory, ops, now, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await migrate();
    // Shared since sharing moves threads: its conversation is on the Factory, so it stays shared.
    const SHARED_SESSION = 'aaaaaaaa-0000-4000-8000-000000000008';
    await ops.insertOne('source_control_sessions', {
      session_id: SHARED_SESSION,
      project_repository_id: 'project-repository-1',
      factory_project_id: FACTORY_ID,
      org_id: 'org-1',
      user_id: 'user-1',
      branch: `user/session-${SHARED_SESSION}`,
      base_branch: 'main',
      title: null,
      visibility: 'org',
      sandbox_id: null,
      sandbox_workdir: null,
      materialized_at: null,
      first_message_at: null,
      first_meaningful_exec_at: null,
      resources_migrated_at: now,
      created_at: now,
      updated_at: now,
    });
    await memory.saveThread({
      thread: {
        id: SHARED_SESSION,
        resourceId: FACTORY_ID,
        title: '',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });
    const backfill = () =>
      privatizeOwnerResourceSessions({ sessions: seed.sourceControl, workItems: seed.workItems, memory });
    const visibilities = async () =>
      Object.fromEntries(
        await Promise.all(
          [USER_SESSION, RUN_SESSION, SLACK_SESSION, SIDE_SESSION, SLACK_DM_SESSION, PR_SESSION, SHARED_SESSION].map(
            async id => [
              id,
              (await ops.findMany<{ visibility: string }>('source_control_sessions', { session_id: id }))[0]
                ?.visibility,
            ],
          ),
        ),
      );

    expect(await backfill()).toBe(1);
    expect(await visibilities()).toEqual({
      [USER_SESSION]: 'private',
      [RUN_SESSION]: 'org',
      [SLACK_SESSION]: 'org',
      [SIDE_SESSION]: 'org',
      [SLACK_DM_SESSION]: 'private',
      [PR_SESSION]: 'org',
      [SHARED_SESSION]: 'org',
    });
    // Each session is checked once, so later starts have nothing to do.
    await expect(seed.sourceControl.listSessionsAwaitingVisibilityCheck()).resolves.toEqual([]);
    expect(await backfill()).toBe(0);
  });

  it('waits for the resource migration before checking a session', async () => {
    const { seed, ops } = await seedLegacyFactory();
    // Before the resource migration nothing is checked: a session's resource isn't settled yet.
    await expect(seed.sourceControl.listSessionsAwaitingVisibilityCheck()).resolves.toEqual([]);
    expect(
      (await ops.findMany<{ session_id: string }>('source_control_sessions', { visibility_checked_at: null })).length,
    ).toBeGreaterThan(0);
  });
});
