import { describe, expect, it, vi } from 'vitest';

import type { PlatformAlertEvent } from '../../rules/types.js';

import { AlertReadClient } from './read-tools.js';
import type { PlatformAlertIngestResult } from './rules.js';
import { compareStreamIds, createAlertSync } from './sync.js';
import type { AlertAck, AlertBinding, AlertSyncCursor, AlertSyncDeps } from './sync.js';

type LoggedEvent = PlatformAlertEvent & { streamId: string };

function setup(
  results: Array<PlatformAlertIngestResult | Error> = [],
  { bound, ...overrides }: Partial<AlertSyncDeps> & { bound?: AlertBinding[] } = {},
) {
  const log: LoggedEvent[] = [];
  let seq = 0;
  const append = (
    incidentId: string,
    type: PlatformAlertEvent['type'] = 'alert.opened',
    extra: { projectId?: string; severity?: PlatformAlertEvent['incident']['severity'] } = {},
  ) => {
    seq++;
    log.push({
      streamId: `${seq}-0`,
      eventId: `${incidentId}:${type}`,
      type,
      occurredAt: '2026-11-13T10:00:00Z',
      organizationId: 'org-1',
      incident: {
        id: incidentId,
        fingerprint: 'fp',
        eventType: 'observability.rule',
        severity: extra.severity ?? 'error',
        openedAt: '2026-11-13T10:00:00Z',
        resolvedAt: null,
        eventCount: 1,
      },
      workKey: { kind: 'rule', ruleId: 'rule-1' },
      projectId: extra.projectId ?? 'p1',
      region: 'us',
      summary: 'x',
      ...(type === 'alert.thread_linked' ? { slack: { teamId: 'T1', channelId: 'C1', ts: '1.1' } } : {}),
    });
  };
  let cursor: AlertSyncCursor = {};
  const acks: AlertAck[] = [];
  const ingested: string[] = [];
  const floors: Record<string, string | undefined> = {};
  const queue = [...results];
  let bindings: AlertBinding[] = bound ?? [
    { factoryProjectId: 'fp-1', labels: null, createdAt: new Date('2026-11-01') },
  ];
  const sync = createAlertSync({
    organizationId: async () => 'org-1',
    listEvents: async after => {
      const from = after ? log.findIndex(e => e.streamId === after) + 1 : 0;
      return { events: log.slice(from, from + 2), nextCursor: from + 2 < log.length ? 'more' : null };
    },
    ack: async ack => void acks.push(ack),
    loadCursor: async () => structuredClone(cursor),
    saveCursor: async next => void (cursor = structuredClone(next)),
    listProjects: async () => [
      { id: 'fp-1', orgId: 'org-1' },
      { id: 'fp-2', orgId: 'org-1' },
      { id: 'fp-other', orgId: 'org-2' },
    ],
    intakeEnabled: async orgId => orgId === 'org-1',
    bindings: async () => bindings,
    ingest: async input => {
      const key = `${input.factoryProjectId}:${input.event.eventId}`;
      ingested.push(key);
      floors[key] = input.severityFloor;
      const next = queue.shift() ?? { status: 'replayed', card: { workItemId: 'w1', board: 'work' } };
      if (next instanceof Error) throw next;
      return next;
    },
    workItemUrl: ({ workItemId }) => `http://factory/${workItemId}`,
    maxPendingTicks: 3,
    ...overrides,
  });
  return {
    sync,
    append,
    acks,
    ingested,
    floors,
    cursor: () => cursor,
    bind: (next: AlertBinding[]) => void (bindings = next),
  };
}

const committed = { status: 'committed', workItemId: 'w1', board: 'work', created: true, reopened: false } as const;

describe('createAlertSync', () => {
  it('starts a newly bound project from the incidents still open, then tails the log', async () => {
    const { sync, append, ingested, cursor } = setup();
    append('i1');
    append('i2');
    append('i2', 'alert.resolved');
    append('i1', 'alert.thread_linked');
    await sync();
    // i2 recovered before the project was bound: no card for it.
    expect(ingested).toEqual(['fp-1:i1:alert.opened', 'fp-1:i1:alert.thread_linked']);
    expect(cursor()).toEqual({ projects: { 'fp-1': { after: '4-0' } } });

    append('i3');
    append('i3', 'alert.resolved');
    await sync();
    expect(ingested.slice(2)).toEqual(['fp-1:i3:alert.opened', 'fp-1:i3:alert.resolved']);
  });

  it('acks each card it lands on', async () => {
    const { sync, append, acks } = setup([committed]);
    append('i1');
    append('i1', 'alert.thread_linked');
    await sync();
    expect(acks.map(a => [a.incidentId, a.workItemUrl, a.slackReply])).toEqual([
      ['i1', 'http://factory/w1', 'platform'],
      ['i1', 'http://factory/w1', 'platform'],
    ]);
  });

  it('holds a project on an unfiled create, then resumes from it', async () => {
    const { sync, append, ingested, cursor } = setup([{ status: 'pending' }]);
    append('i1');
    await sync();
    expect(cursor().projects?.['fp-1']?.after).toBeNull();
    append('i1', 'alert.resolved');
    await sync();
    expect(ingested).toEqual(['fp-1:i1:alert.opened', 'fp-1:i1:alert.opened', 'fp-1:i1:alert.resolved']);
    expect(cursor().projects?.['fp-1']).toEqual({ after: '2-0' });
  });

  it('moves past an event that never files after the pending limit', async () => {
    const pending = { status: 'pending' } as const;
    const { sync, append, cursor } = setup([pending, pending, pending]);
    append('i1');
    await sync();
    await sync();
    expect(cursor().projects?.['fp-1']?.after).toBeNull();
    await sync();
    expect(cursor().projects?.['fp-1']?.after).toBe('1-0');
  });

  it('holds on an ingest error so the event is retried', async () => {
    const { sync, append, cursor } = setup([new Error('db down')]);
    append('i1');
    const summary = await sync();
    expect(summary.failed).toBe(1);
    expect(cursor().projects?.['fp-1']?.after).toBeNull();
  });

  it("routes a first fire by its binding's labels and follows the incident everywhere after", async () => {
    const { sync, append, ingested } = setup([], {
      bound: [
        { factoryProjectId: 'fp-1', labels: null, createdAt: new Date('2026-11-01') },
        { factoryProjectId: 'fp-2', labels: ['platform-project:p2'], createdAt: new Date('2026-11-02') },
      ],
    });
    await sync();
    append('i1', 'alert.opened', { projectId: 'p1' });
    append('i2', 'alert.opened', { projectId: 'p2' });
    append('i2', 'alert.resolved', { projectId: 'p2' });
    await sync();
    expect(ingested).toEqual([
      'fp-1:i1:alert.opened',
      'fp-1:i2:alert.resolved',
      'fp-2:i2:alert.opened',
      'fp-2:i2:alert.resolved',
    ]);
  });

  it('takes a below-floor severity only where the binding names it', async () => {
    const { sync, append, ingested, floors } = setup([], {
      bound: [
        { factoryProjectId: 'fp-1', labels: null, createdAt: new Date('2026-11-01') },
        { factoryProjectId: 'fp-2', labels: ['severity:warning'], createdAt: new Date('2026-11-02') },
      ],
    });
    await sync();
    append('i1', 'alert.opened', { severity: 'warning' });
    await sync();
    expect(ingested).toEqual(['fp-2:i1:alert.opened']);
    expect(floors['fp-2:i1:alert.opened']).toBe('info');
  });

  it("drops an unbound project's place, so binding it again starts from the open incidents", async () => {
    const { sync, append, ingested, cursor, bind } = setup();
    append('i1');
    await sync();
    bind([]);
    await sync();
    expect(cursor()).toEqual({ projects: {} });
    append('i1', 'alert.resolved');
    append('i2');
    bind([{ factoryProjectId: 'fp-1', labels: null, createdAt: new Date('2026-11-05') }]);
    await sync();
    expect(ingested).toEqual(['fp-1:i1:alert.opened', 'fp-1:i2:alert.opened']);
  });

  it("claims the thread reply only where the Factory's Slack app can post", async () => {
    const { sync, append, acks } = setup([committed], { canReplyInThread: async thread => thread.channelId !== 'C1' });
    append('i1');
    append('i1', 'alert.thread_linked');
    await sync();
    expect(acks.map(a => a.slackReply)).toEqual(['factory', 'platform']);
  });

  it('orders stream ids numerically', () => {
    expect(compareStreamIds('10-0', '9-5')).toBeGreaterThan(0);
    expect(compareStreamIds('9-10', '9-9')).toBeGreaterThan(0);
    expect(compareStreamIds('9-1', '9-1')).toBe(0);
  });
});

describe('AlertReadClient', () => {
  const minted = (n: number, expiresAt: string) => ({
    token: `tok-${n}`,
    region: 'eu' as const,
    observabilityBaseUrl: 'http://eu.obs/',
    projectId: 'p1',
    expiresAt,
  });

  it("reads from the token's region with the project pinned, re-minting once on a 401", async () => {
    let n = 0;
    const mint = vi.fn(async () => minted(++n, '2026-11-13T10:15:00Z'));
    const fetch = vi.fn(async (_url: string, init?: RequestInit) =>
      (init?.headers as Record<string, string>).authorization === 'Bearer tok-1'
        ? new Response('expired', { status: 401 })
        : new Response('{"logs":[]}'),
    );
    const client = new AlertReadClient({ mint, fetch: fetch as never, now: () => Date.parse('2026-11-13T10:00:00Z') });
    await expect(
      client.read('org-1', 'inc-1', { method: 'GET', path: '/logs', query: { status: 'error' } }),
    ).resolves.toEqual({ logs: [] });
    expect(mint).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![0]).toBe('http://eu.obs/alert-read/observability/logs?status=error');
    expect(fetch.mock.calls[1]![1]!.headers).toMatchObject({
      authorization: 'Bearer tok-2',
      'x-mastra-organization-id': 'org-1',
      'x-mastra-project-id': 'p1',
    });
  });

  it('reuses a token until two minutes before it expires', async () => {
    let now = Date.parse('2026-11-13T10:00:00Z');
    let n = 0;
    const mint = vi.fn(async () => minted(++n, '2026-11-13T10:15:00Z'));
    const client = new AlertReadClient({ mint, fetch: (async () => new Response('{}')) as never, now: () => now });
    await client.read('org-1', 'inc-1', { method: 'GET', path: '/traces' });
    now = Date.parse('2026-11-13T10:12:00Z');
    await client.read('org-1', 'inc-1', { method: 'GET', path: '/traces' });
    now = Date.parse('2026-11-13T10:13:30Z');
    await client.read('org-1', 'inc-1', { method: 'GET', path: '/traces' });
    expect(mint).toHaveBeenCalledTimes(2);
  });
});
