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

/**
 * Build a stub `WorkItemsStorage.list` from a map of
 * `${orgId}:${factoryProjectId}` → Linear source keys already linked. The
 * event worker only dispatches to projects that already have a work item for
 * the incoming Linear issue's source key, so callers seed the expected links.
 */
function stubWorkItems(links: Record<string, string[]> = {}): Pick<import('../../../storage/domains/work-items/base.js').WorkItemsStorage, 'list'> {
  return {
    list: async ({ orgId, factoryProjectId }: { orgId: string; factoryProjectId: string }) => {
      const sourceKeys = links[`${orgId}:${factoryProjectId}`] ?? [];
      return sourceKeys.map(key => ({
        id: `item-${key}`,
        orgId,
        factoryProjectId,
        externalSource: { integrationId: 'linear', type: 'issue', externalId: key },
      })) as never;
    },
  };
}

function createWorker(input: {
  fetchImpl: typeof fetch;
  storage: PlatformLinearEventStorage;
  workspaces?: PlatformLinearWorkspace[];
  projects?: Array<{ id: string; orgId: string }>;
  /**
   * Source keys already linked per `${orgId}:${factoryProjectId}` pair. Default
   * is a single link for the default project so most tests just work; scoping
   * tests should set this explicitly.
   */
  linkedSourceKeys?: Record<string, string[]>;
  intervalMs?: number;
  reconcileIntervalMs?: number;
  now?: () => number;
  ingestFactoryIssue?: (input: LinearRulesIngress) => Promise<unknown>;
  reconcileFactoryState?: IssueReconciler;
  pollEventsEnabled?: boolean;
}) {
  const projects = input.projects ?? [{ id: 'project-1', orgId: 'org-1' }];
  // Default: every provided project has *every* linked identifier the tests
  // dispatch. Behavioral scoping tests override this to prove filtering.
  const defaultLinks: Record<string, string[]> = {};
  for (const project of projects) {
    defaultLinks[`${project.orgId}:${project.id}`] = ['linear:ENG-1', 'linear:ENG-2', 'linear:ENG-42', 'linear:ENG-100'];
  }
  return new PlatformLinearEventWorker({
    client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl: input.fetchImpl }),
    linear: {
      listWorkspaces: async () => input.workspaces ?? [{ linearWorkspaceId: 'workspace-1' }],
    },
    storage: input.storage,
    projects: {
      listAll: async () => projects as never,
    } as never,
    workItems: stubWorkItems(input.linkedSourceKeys ?? defaultLinks),
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

  it('only dispatches an Issue event to projects that already link that Linear issue', async () => {
    // Cross-tenant safety: the event stream is workspace-scoped and Platform
    // Linear has no workspace→org mapping. Dispatching to every project would
    // materialize a triage card in orgs that never subscribed to this issue
    // via the default `linearIssueObserved` rule.
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async (_input: LinearRulesIngress) => ({ status: 'committed' }));
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.searchParams.has('afterEventId')) return json({ events: [] });
      return json({ events: [eventEntry('9', issueEnvelope({ id: 'issue-x', identifier: 'ENG-7' }))] });
    });

    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      ingestFactoryIssue,
      projects: [
        { id: 'project-a', orgId: 'org-1' },
        { id: 'project-b', orgId: 'org-2' },
        { id: 'project-c', orgId: 'org-3' },
      ],
      linkedSourceKeys: {
        // Only org-1/project-a has a Linear work item for ENG-7. The other
        // projects are untouched, even ones in org-3 that have unrelated
        // Linear work items.
        'org-1:project-a': ['linear:ENG-7', 'linear:ENG-99'],
        'org-2:project-b': [],
        'org-3:project-c': ['linear:ENG-100'],
      },
    });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(ingestFactoryIssue).toHaveBeenCalledTimes(1);
    expect(ingestFactoryIssue.mock.calls[0]![0].orgId).toBe('org-1');
    expect(ingestFactoryIssue.mock.calls[0]![0].factoryProjectId).toBe('project-a');

    await worker.stop();
  });

  it('drops an Issue event when no project links it', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async (_input: LinearRulesIngress) => ({ status: 'committed' }));
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.searchParams.has('afterEventId')) return json({ events: [] });
      return json({ events: [eventEntry('9', issueEnvelope({ id: 'unknown', identifier: 'ENG-999' }))] });
    });

    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      ingestFactoryIssue,
      projects: [{ id: 'project-a', orgId: 'org-1' }],
      linkedSourceKeys: { 'org-1:project-a': [] },
    });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(ingestFactoryIssue).not.toHaveBeenCalled();

    await worker.stop();
  });

  it('advances the cursor past an event whose ingest threw (at-most-once, drift caught by reconciler)', async () => {
    // Cursor must move forward past a failing ingest so a single poison event
    // cannot block the whole workspace stream. The reconciler sweep is the
    // backstop that reconciles drift within its interval.
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async (_input: LinearRulesIngress) => {
      throw new Error('downstream unavailable');
    });
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.searchParams.has('afterEventId')) return json({ events: [] });
      return json({ events: [eventEntry('42', issueEnvelope({ id: 'x', identifier: 'ENG-42' }))] });
    });

    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      ingestFactoryIssue,
    });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(ingestFactoryIssue).toHaveBeenCalledTimes(1);
    const persisted = settings.read() as { workspaces: Record<string, { afterEventId?: string }> } | null;
    expect(persisted?.workspaces['workspace-1']?.afterEventId).toBe('42');

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

  it('does not call listWorkspaces in reconcile-only mode (workspace-listing outage cannot block reconcile)', async () => {
    // Regression: previously #poll always fetched the workspace list even
    // when event tailing was disabled, so a Platform workspace outage would
    // throw out of #poll and prevent #maybeReconcile from ever running.
    const settings = createSettingsStorage();
    const reconcileFactoryState = vi.fn<IssueReconciler>(async () => ({
      projects: 0,
      checked: 0,
      updated: 0,
      missing: 0,
      failed: 0,
      errors: [],
    }));
    const listWorkspaces = vi.fn(async () => {
      throw new Error('workspace listing must not be called in reconcile-only mode');
    });

    const worker = new PlatformLinearEventWorker({
      client: new PlatformApiClient({
        baseUrl,
        accessToken,
        fetchImpl: async () => {
          throw new Error('fetch must not be called in reconcile-only mode');
        },
      }),
      linear: { listWorkspaces } as never,
      storage: settings.storage,
      projects: { listAll: async () => [{ id: 'project-1', orgId: 'org-1' }] as never } as never,
      workItems: stubWorkItems({}),
      reconcileFactoryState,
      pollEventsEnabled: false,
      intervalMs: 1_000,
    });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    expect(listWorkspaces).not.toHaveBeenCalled();
    expect(reconcileFactoryState).toHaveBeenCalledTimes(1);

    await worker.stop();
  });

  it('resolves the project list once per event page, not once per event', async () => {
    // Regression: a 500-event page previously triggered 500 cross-org
    // project scans. #dispatchEvent now takes the project list as an
    // argument and #pollWorkspace resolves it once per page.
    const settings = createSettingsStorage();
    const ingestFactoryIssue = vi.fn(async (_input: LinearRulesIngress) => ({ status: 'committed' }));
    const listAll = vi.fn(async () => [{ id: 'project-1', orgId: 'org-1' }] as never);
    const events = Array.from({ length: 5 }, (_, index) =>
      eventEntry(String(index + 1), issueEnvelope({ id: `issue-${index + 1}`, identifier: `ENG-${index + 1}` })),
    );
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      if (url.searchParams.has('afterEventId')) return json({ events: [] });
      return json({ events });
    });

    const worker = new PlatformLinearEventWorker({
      client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl }),
      linear: { listWorkspaces: async () => [{ linearWorkspaceId: 'workspace-1' }] } as never,
      storage: settings.storage,
      projects: { listAll } as never,
      workItems: stubWorkItems({
        'org-1:project-1': events.map((_, index) => `linear:ENG-${index + 1}`),
      }),
      ingestFactoryIssue,
      intervalMs: 1_000,
    });
    await worker.init(createDeps({ getLeaseProvider: () => acquireOnlyLeaseProvider() }));
    await worker.start();
    await vi.advanceTimersByTimeAsync(0);
    await flushMicrotasks();

    // Two pages: the initial page with 5 events, then the empty follow-up
    // page. listAll fires once per page — not per event.
    expect(ingestFactoryIssue).toHaveBeenCalledTimes(events.length);
    expect(listAll).toHaveBeenCalledTimes(1);

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
