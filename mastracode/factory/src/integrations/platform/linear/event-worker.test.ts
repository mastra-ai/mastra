import type { LeaseProvider } from '@mastra/core/events';
import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { IssueReconciler } from '../../issue-reconciler.js';
import type { LinearRulesIngress } from '../../linear/rules.js';
import { PlatformApiClient } from '../api-client.js';
import { PlatformLinearEventWorker } from './event-worker.js';
import type {
  LinearEventLogEntry,
  LinearWebhookEnvelope,
  PlatformLinearEventStorage,
  PlatformLinearWorkspace,
} from './event-worker.js';

const baseUrl = 'https://platform.example.com';
const accessToken = 'platform-token';

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function issueEnvelope(overrides: Partial<Record<string, unknown>> = {}): LinearWebhookEnvelope {
  return {
    type: 'Issue',
    action: 'update',
    createdAt: '2026-08-06T15:00:00.000Z',
    webhookTimestamp: 1_754_496_000_000,
    linearOrganizationId: 'workspace-1',
    oauthClientId: null,
    url: 'https://linear.app/factory/issue/ENG-1',
    data: {
      id: 'issue-1',
      identifier: 'ENG-1',
      title: 'Original title',
      url: 'https://linear.app/factory/issue/ENG-1',
      state: { name: 'In Progress', type: 'started' },
      team: { key: 'ENG' },
      assignee: { name: 'Alice' },
      user: { name: 'Bob' },
      labels: [{ name: 'bug' }, { name: 'urgent' }],
      priorityLabel: 'High',
      createdAt: '2026-08-01T12:00:00.000Z',
      updatedAt: '2026-08-06T15:00:00.000Z',
      ...overrides,
    },
  };
}

function eventEntry(id: string, envelope: LinearWebhookEnvelope, timestamp = 1_754_496_000_000): LinearEventLogEntry {
  return { id, timestamp, envelope };
}

function createSettingsStorage(initial: unknown = null) {
  let value = initial;
  const get = vi.fn(async () => value);
  const save = vi.fn(async (_orgId: string, _userId: string, next: unknown) => {
    value = structuredClone(next);
  });
  return {
    storage: {
      integrationId: 'linear',
      settings: { get, save },
    } as unknown as PlatformLinearEventStorage,
    get,
    save,
    read: () => value,
  };
}

function createDeps(pubsub: unknown = {}): WorkerDeps {
  return {
    pubsub: pubsub as WorkerDeps['pubsub'],
    storage: {} as WorkerDeps['storage'],
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as unknown as WorkerDeps['logger'],
  };
}

function createWorker(input: {
  fetchImpl: typeof fetch;
  storage: PlatformLinearEventStorage;
  workspaces?: PlatformLinearWorkspace[];
  projects?: Array<{ id: string; orgId: string }>;
  intervalMs?: number;
  reconcileIntervalMs?: number;
  now?: () => number;
  ingestFactoryIssue?: (input: LinearRulesIngress) => Promise<unknown>;
  reconcileFactoryState?: IssueReconciler;
  pollEventsEnabled?: boolean;
}) {
  return new PlatformLinearEventWorker({
    client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl: input.fetchImpl }),
    linear: {
      listWorkspaces: async () => input.workspaces ?? [{ linearWorkspaceId: 'workspace-1' }],
    },
    storage: input.storage,
    projects: {
      listAll: async () => (input.projects ?? [{ id: 'project-1', orgId: 'org-1' }]) as never,
    } as never,
    ingestFactoryIssue: input.ingestFactoryIssue,
    reconcileFactoryState: input.reconcileFactoryState,
    pollEventsEnabled: input.pollEventsEnabled,
    intervalMs: input.intervalMs ?? 1_000,
    reconcileIntervalMs: input.reconcileIntervalMs,
    now: input.now,
  });
}

function acquireOnlyLeaseProvider(): LeaseProvider & {
  acquireLease: ReturnType<typeof vi.fn>;
  releaseLease: ReturnType<typeof vi.fn>;
  renewLease: ReturnType<typeof vi.fn>;
} {
  const acquireLease = vi.fn(async () => ({ acquired: true, owner: 'test-owner' }));
  const releaseLease = vi.fn(async () => true);
  const renewLease = vi.fn(async () => true);
  return { acquireLease, releaseLease, renewLease } as never;
}

async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('PlatformLinearEventWorker', () => {
  it('polls immediately, dispatches Issue events, persists a cursor, and resumes from it', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async (_input: LinearRulesIngress) => ({ status: 'committed' }));
    const eventRequests: URL[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/workspaces/workspace-1/events')) {
        eventRequests.push(url);
        if (url.searchParams.has('afterEventId')) {
          return json({ events: [] });
        }
        return json({
          events: [
            eventEntry('1000-0', issueEnvelope({ id: 'issue-1', identifier: 'ENG-1' })),
            eventEntry('1001-0', issueEnvelope({ id: 'issue-2', identifier: 'ENG-2' })),
          ],
        });
      }
      throw new Error(`unexpected fetch: ${url.toString()}`);
    });

    const worker = createWorker({ fetchImpl, storage: settings.storage, ingestFactoryIssue });
    const lease = acquireOnlyLeaseProvider();
    await worker.init(createDeps({ getLeaseProvider: () => lease }));
    await worker.start();

    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(ingestFactoryIssue).toHaveBeenCalledTimes(2);
    expect(ingestFactoryIssue.mock.calls[0]![0].issues[0]!.identifier).toBe('ENG-1');
    expect(ingestFactoryIssue.mock.calls[1]![0].issues[0]!.identifier).toBe('ENG-2');
    expect(lease.acquireLease).toHaveBeenCalledTimes(1);
    expect(settings.save).toHaveBeenCalled();
    const persisted = settings.read() as { workspaces: Record<string, { afterEventId?: string }> };
    expect(persisted.workspaces['workspace-1']!.afterEventId).toBe('1001-0');

    // Next tick should resume from the persisted afterEventId cursor.
    await vi.advanceTimersByTimeAsync(1_000);
    await flushMicrotasks();
    const resumeRequest = eventRequests.at(-1)!;
    expect(resumeRequest.searchParams.get('afterEventId')).toBe('1001-0');

    await worker.stop();
    expect(lease.releaseLease).toHaveBeenCalledTimes(1);
  });

  it('skips non-Issue events and malformed Issue payloads without advancing ingest', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async (_input: LinearRulesIngress) => ({ status: 'committed' }));
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.searchParams.has('afterEventId')) return json({ events: [] });
      return json({
        events: [
          eventEntry('1', { ...issueEnvelope(), type: 'Comment' }),
          eventEntry('2', { ...issueEnvelope({ id: undefined }) }),
          eventEntry('3', issueEnvelope({ id: 'issue-only-valid', identifier: 'ENG-42' })),
        ],
      });
    });

    const worker = createWorker({ fetchImpl, storage: settings.storage, ingestFactoryIssue });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(ingestFactoryIssue).toHaveBeenCalledTimes(1);
    expect(ingestFactoryIssue.mock.calls[0]![0].issues[0]!.identifier).toBe('ENG-42');

    await worker.stop();
  });

  it('fans an Issue event out to every Factory project', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async (_input: LinearRulesIngress) => ({ status: 'committed' }));
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.searchParams.has('afterEventId')) return json({ events: [] });
      return json({ events: [eventEntry('9', issueEnvelope())] });
    });

    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      ingestFactoryIssue,
      projects: [
        { id: 'project-a', orgId: 'org-1' },
        { id: 'project-b', orgId: 'org-2' },
      ],
    });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(ingestFactoryIssue).toHaveBeenCalledTimes(2);
    expect(ingestFactoryIssue.mock.calls.map(call => call[0]!.factoryProjectId).sort()).toEqual([
      'project-a',
      'project-b',
    ]);

    await worker.stop();
  });

  it('folds LinearIssueReconciler in on the reconcile cadence', async () => {
    const settings = createSettingsStorage();
    let now = 100_000;
    const reconcileFactoryState = vi.fn<IssueReconciler>(async () => ({
      projects: 1,
      checked: 3,
      updated: 1,
      missing: 0,
      failed: 0,
      errors: [],
    }));
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ events: [] }));

    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      reconcileFactoryState,
      intervalMs: 1_000,
      reconcileIntervalMs: 5_000,
      now: () => now,
    });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();

    // First tick: `lastReconcileAt` starts at 0 and `now` is well past the
    // reconcile interval, so the sweep fires immediately alongside the poll.
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();
    expect(reconcileFactoryState).toHaveBeenCalledTimes(1);

    // Second poll tick within the reconcile window — no additional sweep.
    now = 101_000;
    await vi.advanceTimersByTimeAsync(1_000);
    await flushMicrotasks();
    expect(reconcileFactoryState).toHaveBeenCalledTimes(1);

    // Advance clock past the reconcile window; the next poll tick sweeps again.
    now = 108_000;
    await vi.advanceTimersByTimeAsync(1_000);
    await flushMicrotasks();
    expect(reconcileFactoryState).toHaveBeenCalledTimes(2);

    await worker.stop();
  });

  it('skips ingest but still runs reconcile when pollEventsEnabled is false', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async () => ({ status: 'committed' }));
    const reconcileFactoryState = vi.fn<IssueReconciler>(async () => ({
      projects: 0,
      checked: 0,
      updated: 0,
      missing: 0,
      failed: 0,
      errors: [],
    }));
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new Error('fetch must not be called in reconcile-only mode');
    });

    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      ingestFactoryIssue,
      reconcileFactoryState,
      pollEventsEnabled: false,
    });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(ingestFactoryIssue).not.toHaveBeenCalled();
    expect(reconcileFactoryState).toHaveBeenCalledTimes(1);

    await worker.stop();
  });

  it('backs off polling when the lease cannot be acquired', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async () => ({ status: 'committed' }));
    const fetchImpl = vi.fn<typeof fetch>(async () => json({ events: [] }));
    const lease = {
      acquireLease: vi.fn(async () => ({ acquired: false, owner: 'other' })),
      releaseLease: vi.fn(async () => true),
      renewLease: vi.fn(async () => true),
    } as never as LeaseProvider;

    const worker = createWorker({ fetchImpl, storage: settings.storage, ingestFactoryIssue });
    await worker.init(createDeps({ getLeaseProvider: () => lease }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(ingestFactoryIssue).not.toHaveBeenCalled();

    await worker.stop();
  });
});
