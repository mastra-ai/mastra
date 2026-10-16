import { getDynamicMemory } from '@mastra/code-sdk/agents/memory';
import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../storage/test-utils.js';
import { migrateSessionResources } from './resource-migration.js';
import { listFactorySessionThreads } from './session-threads.js';

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

  await ops.insertOne('factory_run_bindings', {
    org_id: 'org-1',
    factory_project_id: FACTORY_ID,
    work_item_id: 'work-item-1',
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

  for (const sessionId of [USER_SESSION, RUN_SESSION, SLACK_SESSION, ORPHAN_SESSION, SIDE_SESSION, SLACK_DM_SESSION]) {
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
  const migrate = () =>
    migrateSessionResources({
      sessions: seed.sourceControl,
      workItems: seed.workItems,
      integrations: seed.integrations,
      memory,
      threads: sessionMemory,
    });
  return { seed, memoryStore, memory, ops, vector, migrate };
}

describe('migrateSessionResources', () => {
  it('moves each legacy session onto its Factory or owner, and leaves sessions without a Factory alone', async () => {
    const { memory, ops, vector, migrate } = await seedLegacyFactory();
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const report = await migrate();

    expect(report).toMatchObject({
      sessions: 6,
      factorySessions: 3,
      userSessions: 2,
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

    expect(await ops.findMany('factory_run_bindings', {})).toEqual([
      expect.objectContaining({ session_id: RUN_SESSION, thread_id: RUN_SESSION, resource_id: FACTORY_ID }),
    ]);
    expect(await ops.findMany('integration_subscriptions', {})).toEqual([
      expect.objectContaining({ session_id: USER_SESSION, resource_id: 'user-1', session_scope: '/workspace/legacy' }),
    ]);

    // The Factory's resource now lists its runs and Slack sessions; the user's lists only theirs.
    const byResource = async (resourceId: string) =>
      (await memory.listThreads({ filter: { resourceId }, perPage: false })).threads.map(t => t.id).sort();
    expect(await byResource(FACTORY_ID)).toEqual([RUN_SESSION, SLACK_SESSION, SIDE_SESSION].sort());
    expect(await byResource('user-1')).toEqual([USER_SESSION, SLACK_DM_SESSION, 'user-second-thread'].sort());
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

  it('opens a migrated session by its id with its old conversation', async () => {
    const { memoryStore, migrate } = await seedLegacyFactory();
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
    expect((await listFactorySessionThreads(controller, RUN_SESSION)).map(thread => thread.id)).toEqual([RUN_SESSION]);
  });
});
