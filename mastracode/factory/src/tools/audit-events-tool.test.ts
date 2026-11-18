import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, vi } from 'vitest';

import { auditActorOf } from '../rules/transition-service.js';
import { ACTOR_PROFILE_METADATA_KEY, AuditStorage } from '../storage/domains/audit/base.js';
import type { RecordAuditEventInput } from '../storage/domains/audit/base.js';
import type { Card, FactoryRunBindingRecord } from '../storage/domains/work-items/base.js';
import { createAuditEventsTool } from './audit-events-tool.js';
import type { FactoryAuditToolDependencies } from './audit-events-tool.js';
import type { FactoryToolScope } from './scope.js';

const scope: FactoryToolScope = {
  orgId: 'org-1',
  factoryProjectId: 'project-1',
  userId: 'user-1',
  sessionId: 'session-1',
  resourceId: 'session-1',
  threadId: 'thread-1',
  kind: 'user',
  interactive: true,
};

const ITEM = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const BASE = Date.parse('2026-10-01T00:00:00Z');

type Summary = {
  action: string;
  occurredAt: string;
  actor: { type: string; id: string; name?: string };
  startedBy?: string;
  targets: Array<{ type: string; id: string; name?: string }>;
};
type Result = { events: Summary[]; nextCursor?: string };

interface Thread {
  id: string;
  metadata?: Record<string, unknown>;
}
interface SessionRow {
  id: string;
  orgId: string;
  factoryProjectId: string;
  userId: string;
  visibility: 'org' | 'private';
}

async function setup({
  events,
  bindings = [],
  threads = [],
  sessions = [],
}: {
  events: Array<Omit<RecordAuditEventInput, 'orgId'> & { orgId?: string; at: number }>;
  bindings?: Array<Pick<FactoryRunBindingRecord, 'threadId'> & Partial<FactoryRunBindingRecord>>;
  threads?: Thread[];
  sessions?: SessionRow[];
}) {
  const backend = new LibSQLFactoryStorage({ id: 'audit-tool-test', url: ':memory:' });
  const audit = backend.registerDomain(new AuditStorage());
  await backend.init();
  for (const { at, ...event } of events) {
    await audit.record({
      orgId: 'org-1',
      factoryProjectId: 'project-1',
      ...event,
      occurredAt: new Date(BASE + at * 1000),
    });
  }

  const card = { id: ITEM, factoryProjectId: 'project-1' } as Card;
  const deps: FactoryAuditToolDependencies = {
    audit,
    workItems: {
      listShared: vi.fn(async () => [card]),
      getForProject: vi.fn(async (_org, _project, id) => (id === ITEM ? card : null)),
      listRunBindings: vi.fn(async () => bindings as FactoryRunBindingRecord[]),
    } as unknown as FactoryAuditToolDependencies['workItems'],
    messaging: async () =>
      ({
        controller: {
          queryThreadById: async ({ threadId }: { threadId: string }) => threads.find(t => t.id === threadId),
        },
      }) as never,
    sessions: { getBySessionId: async (id: string) => (sessions.find(s => s.id === id) ?? null) as never },
  };
  const tool = createAuditEventsTool(scope, deps) as unknown as {
    execute: (input: unknown, context: unknown) => Promise<Result>;
  };
  return { run: (input: Record<string, unknown> = {}) => tool.execute(input, {}), audit };
}

describe('factory_list_audit_events', () => {
  it("lists this Factory's events newest first without request context, emails or other metadata", async () => {
    const { run } = await setup({
      events: [
        {
          at: 1,
          actorId: 'user-2',
          action: 'factory.work_item.created',
          targets: [{ type: 'work_item', id: ITEM, name: 'Fix it' }],
          context: { location: '10.0.0.1', userAgent: 'curl' },
          metadata: { branch: 'secret-branch', [ACTOR_PROFILE_METADATA_KEY]: { name: 'Ada', email: 'ada@x.dev' } },
        },
        {
          at: 2,
          actorId: 'user-3',
          action: 'factory.work_item.stage_moved',
          targets: [{ type: 'work_item', id: ITEM }],
          metadata: { [ACTOR_PROFILE_METADATA_KEY]: { name: 'bob@x.dev' } },
        },
        { at: 3, factoryProjectId: 'project-2', actorId: 'user-2', action: 'factory.work_item.created', targets: [] },
        { at: 4, orgId: 'org-2', actorId: 'user-2', action: 'factory.work_item.created', targets: [] },
      ],
    });

    const result = await run();
    expect(result.events.map(e => e.action)).toEqual(['factory.work_item.stage_moved', 'factory.work_item.created']);
    expect(result.events[0]!.actor).toEqual({ type: 'human', id: 'user-3' });
    expect(result.events[1]).toEqual({
      action: 'factory.work_item.created',
      occurredAt: new Date(BASE + 1000).toISOString(),
      actor: { type: 'human', id: 'user-2', name: 'Ada' },
      targets: [{ type: 'work_item', id: ITEM, name: 'Fix it' }],
    });
    expect(JSON.stringify(result)).not.toMatch(/10\.0\.0\.1|curl|secret-branch|@x\.dev/);
    expect(result.nextCursor).toBeUndefined();
  });

  it('filters by actor, namespace, actions, work item and time range', async () => {
    const { run } = await setup({
      events: [
        { at: 1, actorId: 'user-1', action: 'factory.work_item.created', targets: [{ type: 'work_item', id: ITEM }] },
        { at: 2, actorId: 'user-2', action: 'factory.work_item.created', targets: [{ type: 'work_item', id: ITEM }] },
        {
          at: 3,
          actorId: 'user-1',
          action: 'factory.work_item.stage_moved',
          targets: [{ type: 'work_item', id: 'other' }],
        },
        { at: 4, actorId: 'user-1', action: 'factory.board.created', targets: [] },
      ],
    });

    const mine = await run({ actor: 'me' });
    expect(mine.events.map(e => e.occurredAt)).toEqual([4, 3, 1].map(s => new Date(BASE + s * 1000).toISOString()));
    expect((await run({ namespace: 'board' })).events).toHaveLength(1);
    expect((await run({ actions: ['factory.work_item.created'] })).events).toHaveLength(2);
    expect((await run({ namespace: 'board', actions: ['factory.work_item.created'] })).events).toEqual([]);
    expect((await run({ workItem: ITEM })).events).toHaveLength(2);
    const window = await run({
      since: new Date(BASE + 2000).toISOString(),
      until: new Date(BASE + 4000).toISOString(),
    });
    expect(window.events.map(e => e.actor.id)).toEqual(['user-1', 'user-2']);
  });

  it('pages with a cursor', async () => {
    const { run } = await setup({
      events: [1, 2, 3].map(at => ({ at, actorId: 'user-2', action: 'factory.work_item.created', targets: [] })),
    });

    const first = await run({ limit: 2 });
    expect(first.events).toHaveLength(2);
    const second = await run({ limit: 2, cursor: first.nextCursor });
    expect(second.events.map(e => e.occurredAt)).toEqual([new Date(BASE + 1000).toISOString()]);
    expect(second.nextCursor).toBeUndefined();
    await expect(run({ cursor: 'not-a-cursor' })).rejects.toThrow('cursor');
  });

  it("shows agent events from runs, shared sessions and the caller's own private sessions only", async () => {
    const agent = (thread: string, startedBy = 'user-2') => ({
      actorId: `agent:${thread}`,
      actorType: 'agent' as const,
      action: 'factory.agent.push',
      targets: [],
      metadata: { startedBy },
    });
    const { run } = await setup({
      events: [
        { at: 1, ...agent('run-thread') },
        { at: 2, ...agent('shared-thread') },
        { at: 3, ...agent('private-thread') },
        { at: 4, ...agent('mine-thread') },
        { at: 5, ...agent('unknown-thread') },
        { at: 6, ...agent('own-run', 'user-1') },
        { at: 7, ...agent('session:mine'), metadata: {} },
        { at: 8, ...agent('session:private'), metadata: {} },
        { at: 9, ...agent('session:run-session'), metadata: {} },
        { at: 10, ...agent('session:shared'), metadata: {} },
        { at: 11, ...agent('session:bound-private'), metadata: {} },
      ],
      bindings: [
        { threadId: 'run-thread', sessionId: 'run-session' },
        { threadId: 'bound-thread', sessionId: 'bound-private' },
      ],
      threads: [
        { id: 'shared-thread', metadata: { factorySessionId: 'shared' } },
        { id: 'private-thread', metadata: { factorySessionId: 'private' } },
        { id: 'mine-thread', metadata: { factorySessionId: 'mine' } },
      ],
      sessions: [
        { id: 'shared', orgId: 'org-1', factoryProjectId: 'project-1', userId: 'user-2', visibility: 'org' },
        { id: 'private', orgId: 'org-1', factoryProjectId: 'project-1', userId: 'user-2', visibility: 'private' },
        { id: 'mine', orgId: 'org-1', factoryProjectId: 'project-1', userId: 'user-1', visibility: 'private' },
        { id: 'run-session', orgId: 'org-1', factoryProjectId: 'project-1', userId: 'user-2', visibility: 'org' },
        { id: 'bound-private', orgId: 'org-1', factoryProjectId: 'project-1', userId: 'user-2', visibility: 'private' },
      ],
    });

    const result = await run();
    expect(result.events.map(e => e.actor.id)).toEqual([
      'agent:session:shared',
      'agent:session:run-session',
      'agent:session:mine',
      'agent:own-run',
      'agent:mine-thread',
      'agent:shared-thread',
      'agent:run-thread',
    ]);
    expect(result.events[3]!.startedBy).toBe('user-1');
  });

  it("leaves out people's events about another person's private session", async () => {
    const sessions: SessionRow[] = [
      { id: 'shared', orgId: 'org-1', factoryProjectId: 'project-1', userId: 'user-2', visibility: 'org' },
      { id: 'private', orgId: 'org-1', factoryProjectId: 'project-1', userId: 'user-2', visibility: 'private' },
      { id: 'mine', orgId: 'org-1', factoryProjectId: 'project-1', userId: 'user-1', visibility: 'private' },
    ];
    const { run } = await setup({
      events: [
        {
          at: 1,
          actorId: 'user-2',
          action: 'factory.git.commit',
          targets: [{ type: 'session', id: 'private' }],
          metadata: { sessionId: 'private' },
        },
        {
          at: 2,
          actorId: 'user-2',
          action: 'factory.git.push',
          targets: [{ type: 'branch', id: 'secret-branch' }],
          metadata: { sessionId: 'private' },
        },
        {
          at: 3,
          actorId: 'user-2',
          action: 'factory.git.commit',
          targets: [{ type: 'session', id: 'shared' }],
          metadata: { sessionId: 'shared' },
        },
        {
          at: 4,
          actorId: 'user-2',
          action: 'factory.run.approved',
          targets: [{ type: 'session', id: 'mine' }],
          metadata: { sessionId: 'mine' },
        },
        { at: 5, actorId: 'user-2', action: 'factory.git.push', targets: [{ type: 'session', id: 'gone' }] },
        {
          at: 6,
          actorId: 'agent:run-thread',
          actorType: 'agent',
          action: 'factory.agent.signaled',
          targets: [{ type: 'session', id: 'private' }],
          metadata: { startedBy: 'user-1' },
        },
        // An ownership transfer names the session's row id, which no session lookup resolves.
        {
          at: 7,
          actorId: 'user-2',
          action: 'factory.session.owner_transferred',
          targets: [{ type: 'session', id: 'row-of-shared', name: 'Shared plan' }],
          metadata: { fromOwnerId: 'user-3', toOwnerId: 'user-2' },
        },
      ],
      bindings: [{ threadId: 'run-thread' }],
      sessions,
    });

    const result = await run();
    expect(result.events.map(e => e.targets[0]!.id)).toEqual(['mine', 'shared']);
  });

  it("shows the stage moves a run's agent made on its card", async () => {
    // The transition service records a run agent under its binding, not its thread.
    const runAgent = (bindingId: string) => auditActorOf({ type: 'agent', bindingId, role: 'engineer' });
    const moved = {
      action: 'factory.work_item.stage_moved',
      targets: [{ type: 'work_item', id: ITEM, name: 'Fix it' }],
    };
    const { run } = await setup({
      events: [
        { at: 1, actorId: 'user-2', action: 'factory.work_item.created', targets: [{ type: 'work_item', id: ITEM }] },
        { at: 2, ...runAgent('binding-1'), ...moved },
        { at: 3, ...runAgent('binding-elsewhere'), ...moved },
      ],
      bindings: [{ id: 'binding-1', threadId: 'run-thread', sessionId: 'run-session' }],
    });

    const history = await run({ workItem: ITEM });
    expect(history.events.map(e => [e.action, e.actor.id])).toEqual([
      ['factory.work_item.stage_moved', 'agent:binding-1'],
      ['factory.work_item.created', 'user-2'],
    ]);
  });

  it('includes agent runs a person started when asked', async () => {
    const { run } = await setup({
      events: [
        { at: 1, actorId: 'user-2', action: 'factory.work_item.created', targets: [] },
        {
          at: 2,
          actorId: 'agent:t',
          actorType: 'agent',
          action: 'factory.agent.push',
          targets: [],
          metadata: { startedBy: 'user-2' },
        },
      ],
      bindings: [{ threadId: 't' }],
    });

    expect((await run({ actor: 'user-2' })).events).toHaveLength(1);
    expect((await run({ actor: 'user-2', includeAgentRuns: true })).events.map(e => e.actor.id)).toEqual([
      'agent:t',
      'user-2',
    ]);
    await expect(run({ includeAgentRuns: true })).rejects.toThrow('includeAgentRuns');
  });
});
