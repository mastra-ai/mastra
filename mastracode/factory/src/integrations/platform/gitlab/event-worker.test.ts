import type { LeaseProvider } from '@mastra/core/events';
import type { WorkerDeps } from '@mastra/core/worker';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GitLabSignalSubscriptionRow } from '../../gitlab/subscriptions.js';
import { normalizeGitLabWebhookMetadata } from '../../gitlab/webhook.js';
import type { ParsedGitLabWebhook } from '../../gitlab/webhook.js';
import { PlatformApiClient } from '../api-client.js';
import { PlatformGitLabEventWorker } from './event-worker.js';
import type {
  IntegrationEventEntry,
  PlatformGitLabEventConnection,
  PlatformGitLabEventDispatchIntegration,
  PlatformGitLabEventStorage,
} from './event-worker.js';

const baseUrl = 'https://platform.example.com';
const accessToken = 'platform-token';

function json(data: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function createSettingsStorage(initial: unknown = null) {
  let value = initial;
  const get = vi.fn(async () => value);
  const save = vi.fn(async (_orgId: string, _userId: string, next: unknown) => {
    value = structuredClone(next);
  });
  return {
    storage: {
      integrationId: 'gitlab',
      settings: { get, save },
    } as unknown as PlatformGitLabEventStorage,
    get,
    save,
    read: () => value,
  };
}

function createGitLab(options: { subscriptions?: GitLabSignalSubscriptionRow[]; accessLevel?: number } = {}) {
  const listByTarget = vi.fn(async () => options.subscriptions ?? []);
  const updateStatus = vi.fn(async () => undefined);
  const getProjectMemberAccessLevel = vi.fn(async () => options.accessLevel ?? 40);
  const gitlab: PlatformGitLabEventDispatchIntegration = {
    integrationStorage: { subscriptions: { listByTarget, updateStatus } } as never,
    sourceControlStorage: {
      sessions: { getBySessionId: async () => ({ userId: 'user-1', orgId: 'org-1' }) },
    },
    getProjectMemberAccessLevel,
  };
  return { gitlab, listByTarget, updateStatus, getProjectMemberAccessLevel };
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

function event(id: string, payload: unknown, eventType = 'unknown'): IntegrationEventEntry {
  return { id, timestamp: Number(id.split('-')[0]), integrationId: 'gitlab', eventType, sourceEventId: null, payload };
}

const project = { id: 101, path_with_namespace: 'acme/app', web_url: 'https://gitlab.com/acme/app' };

/**
 * Serves `/v2/connections/{id}/events` from an in-memory per-connection log,
 * honouring `afterEventId` so the worker's cursor handling is exercised for
 * real. Records every request so tests can assert the cursor each poll used.
 */
function createEventLog(pages: Record<string, Array<{ events: IntegrationEventEntry[]; nextCursor: string | null }>>) {
  const requests: Array<{ connectionId: string; afterEventId: string | null; limit: string | null }> = [];
  const remaining = Object.fromEntries(Object.entries(pages).map(([id, list]) => [id, [...list]]));
  const fetchImpl = vi.fn<typeof fetch>(async input => {
    const url = new URL(String(input));
    const match = url.pathname.match(/^\/v2\/connections\/([^/]+)\/events$/);
    if (!match) throw new Error(`Unexpected request: ${url}`);
    const connectionId = decodeURIComponent(match[1]!);
    requests.push({
      connectionId,
      afterEventId: url.searchParams.get('afterEventId'),
      limit: url.searchParams.get('limit'),
    });
    const next = remaining[connectionId]?.shift();
    return json(next ?? { events: [], nextCursor: null });
  });
  return { fetchImpl, requests };
}

function createWorker(input: {
  fetchImpl: typeof fetch;
  storage: PlatformGitLabEventStorage;
  connections?: PlatformGitLabEventConnection[];
  gitlab?: PlatformGitLabEventDispatchIntegration;
  controller?: unknown;
  ingestFactoryEvent?: (event: ParsedGitLabWebhook) => Promise<unknown>;
  intervalMs?: number;
  now?: () => number;
}) {
  return new PlatformGitLabEventWorker({
    client: new PlatformApiClient({ baseUrl, accessToken, fetchImpl: input.fetchImpl }),
    controller: (input.controller ?? {}) as never,
    gitlab: input.gitlab ?? createGitLab().gitlab,
    storage: input.storage,
    listConnections: async () => input.connections ?? [{ id: 'conn-1', status: 'active' }],
    ingestFactoryEvent: input.ingestFactoryEvent,
    intervalMs: input.intervalMs ?? 1_000,
    now: input.now ?? (() => 1_000),
  });
}

async function runOnce(worker: PlatformGitLabEventWorker, deps = createDeps()) {
  await worker.init(deps);
  await worker.start();
  await vi.advanceTimersByTimeAsync(0);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'info').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('PlatformGitLabEventWorker', () => {
  it('starts from a synthesized stream id, processes a page in order, persists the cursor, and resumes from it', async () => {
    const settings = createSettingsStorage();
    const seen: string[] = [];
    const ingestFactoryEvent = vi.fn(async (parsed: ParsedGitLabWebhook) => {
      seen.push(parsed.deliveryId);
      return { status: 'committed' };
    });
    const log = createEventLog({
      'conn-1': [
        {
          events: [
            event('1000-0', { object_kind: 'issue', project, object_attributes: { iid: 1, action: 'open' } }),
            event('1000-1', { object_kind: 'merge_request', project, object_attributes: { iid: 2, action: 'open' } }),
            event('1001-0', { object_kind: 'push', project, ref: 'refs/heads/main' }),
          ],
          nextCursor: '1001-0',
        },
        {
          events: [event('1002-0', { object_kind: 'issue', project, object_attributes: { iid: 3, action: 'close' } })],
          nextCursor: '1002-0',
        },
      ],
    });
    const worker = createWorker({ fetchImpl: log.fetchImpl, storage: settings.storage, ingestFactoryEvent });

    await runOnce(worker);

    expect(seen).toEqual([
      'platform:conn-1:1000-0',
      'platform:conn-1:1000-1',
      'platform:conn-1:1001-0',
      'platform:conn-1:1002-0',
    ]);
    expect(log.requests.map(request => request.afterEventId)).toEqual(['999-0', '1001-0', '1002-0']);
    expect(log.requests.every(request => request.limit === '500')).toBe(true);
    expect(settings.read()).toEqual({ version: 1, connections: { 'conn-1': { afterEventId: '1002-0' } } });
    await worker.stop();

    log.requests.length = 0;
    const resumed = createWorker({ fetchImpl: log.fetchImpl, storage: settings.storage, now: () => 9_000 });
    await runOnce(resumed);

    expect(log.requests).toEqual([{ connectionId: 'conn-1', afterEventId: '1002-0', limit: '500' }]);
    await resumed.stop();
  });

  it('advances the cursor only after every event on the page has been processed', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryEvent = vi
      .fn<(parsed: ParsedGitLabWebhook) => Promise<unknown>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('rules unavailable'))
      .mockResolvedValue(undefined);
    const page = {
      events: [
        event('1000-0', { object_kind: 'issue', project, object_attributes: { iid: 1, action: 'open' } }),
        event('1000-1', { object_kind: 'issue', project, object_attributes: { iid: 2, action: 'open' } }),
      ],
      nextCursor: '1000-1',
    };
    const log = createEventLog({ 'conn-1': [page, page] });
    const worker = createWorker({ fetchImpl: log.fetchImpl, storage: settings.storage, ingestFactoryEvent });
    const deps = createDeps();

    await runOnce(worker, deps);

    // The second event failed, so the page cursor stays at the start marker.
    expect(ingestFactoryEvent).toHaveBeenCalledTimes(2);
    expect(settings.read()).toEqual({ version: 1, connections: { 'conn-1': { afterEventId: '999-0' } } });
    expect(deps.logger.error).toHaveBeenCalledWith(
      'Platform GitLab connection event polling failed',
      expect.objectContaining({ connectionId: 'conn-1', error: 'rules unavailable' }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    // The next cycle replays the whole page from the unchanged cursor.
    expect(log.requests.map(request => request.afterEventId)).toEqual(['999-0', '999-0', '1000-1']);
    expect(ingestFactoryEvent).toHaveBeenCalledTimes(4);
    expect(ingestFactoryEvent.mock.calls.map(([parsed]) => parsed.deliveryId)).toEqual([
      'platform:conn-1:1000-0',
      'platform:conn-1:1000-1',
      'platform:conn-1:1000-0',
      'platform:conn-1:1000-1',
    ]);
    expect(settings.read()).toEqual({ version: 1, connections: { 'conn-1': { afterEventId: '1000-1' } } });
    await worker.stop();
  });

  it('ignores unsupported object kinds and malformed bodies but still moves past them', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryEvent = vi.fn(async () => undefined);
    const log = createEventLog({
      'conn-1': [
        {
          events: [
            event('1000-0', { object_kind: 'pipeline', project, object_attributes: { id: 5 } }, 'pipeline'),
            event('1000-1', 'not an object'),
            event('1000-2', { project }),
            event('1000-3', { object_kind: 'note', project, object_attributes: { noteable_type: 'Issue' } }),
          ],
          nextCursor: '1000-3',
        },
      ],
    });
    const worker = createWorker({ fetchImpl: log.fetchImpl, storage: settings.storage, ingestFactoryEvent });

    await runOnce(worker);

    expect(ingestFactoryEvent).toHaveBeenCalledTimes(1);
    expect(ingestFactoryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'Note Hook', deliveryId: 'platform:conn-1:1000-3' }),
    );
    expect(settings.read()).toEqual({ version: 1, connections: { 'conn-1': { afterEventId: '1000-3' } } });
    await worker.stop();
  });

  it('hands issue, note and merge request bodies to the rules ingress with direct-route metadata', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryEvent = vi.fn(async () => undefined);
    const log = createEventLog({
      'conn-1': [
        {
          events: [
            event('1000-0', {
              object_kind: 'issue',
              user: { username: 'ada' },
              project,
              object_attributes: { iid: 12, action: 'open' },
            }),
            event('1000-1', {
              object_kind: 'note',
              user: { username: 'grace' },
              project,
              object_attributes: { noteable_type: 'Issue', note: 'please look' },
              issue: { iid: 12 },
            }),
            event('1000-2', {
              object_kind: 'merge_request',
              user: { username: 'linus' },
              project,
              object_attributes: { iid: 34, action: 'merge' },
            }),
          ],
          nextCursor: '1000-2',
        },
      ],
    });
    const worker = createWorker({ fetchImpl: log.fetchImpl, storage: settings.storage, ingestFactoryEvent });

    await runOnce(worker);

    const metadata = ingestFactoryEvent.mock.calls.map(([parsed]) =>
      normalizeGitLabWebhookMetadata(parsed as unknown as ParsedGitLabWebhook),
    );
    expect(metadata).toEqual([
      expect.objectContaining({ event: 'Issue Hook', projectId: 101, projectPath: 'acme/app', issueIid: 12, sender: 'ada' }),
      expect.objectContaining({
        event: 'Note Hook',
        projectId: 101,
        issueIid: 12,
        noteableType: 'Issue',
        sender: 'grace',
      }),
      expect.objectContaining({ event: 'Merge Request Hook', projectId: 101, mergeRequestIid: 34, sender: 'linus' }),
    ]);
    // No instance header exists on the polling path; the host comes from the payload.
    expect(ingestFactoryEvent.mock.calls.every(([parsed]) => !('instanceHost' in (parsed as object)))).toBe(true);
    await worker.stop();
  });

  describe('session dispatch', () => {
    const subscription = (): GitLabSignalSubscriptionRow =>
      ({
        id: 'sub-1',
        orgId: 'org-1',
        targetKey: 'change-request:gitlab:gitlab.com:101:34',
        sessionId: 'session-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        sessionScope: '',
        status: 'open',
        data: {
          host: 'gitlab.com',
          projectId: '101',
          projectPath: 'acme/app',
          projectRepositoryId: 'link-1',
          installationExternalId: 'conn-1',
          changeRequestId: '34',
          ownerId: 'u1',
          source: 'explicit-tool',
          subscribedByUserId: 'u1',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      }) as GitLabSignalSubscriptionRow;

    const mergeRequestNote = () =>
      event('1000-0', {
        object_kind: 'note',
        user: { id: 7, username: 'ada' },
        project,
        object_attributes: {
          noteable_type: 'MergeRequest',
          note: 'looks good',
          url: 'https://gitlab.com/acme/app/-/merge_requests/34#note_9',
        },
        merge_request: { iid: 34 },
      });

    function createController() {
      const send = vi.fn(async () => ({ record: { id: 'n-1' }, decision: { action: 'deliver' } }));
      const session = { thread: { getId: () => 'thread-1', switch: vi.fn() }, sendNotificationSignal: send };
      return {
        send,
        controller: {
          queryThreadById: async () => ({ id: 'thread-1', resourceId: 'resource-1' }),
          getSessionByResource: async () => session,
        },
      };
    }

    it('wakes a subscribed session for a merge request note from a trusted project member', async () => {
      const settings = createSettingsStorage();
      const { gitlab, getProjectMemberAccessLevel } = createGitLab({ subscriptions: [subscription()], accessLevel: 40 });
      const { controller, send } = createController();
      const log = createEventLog({ 'conn-1': [{ events: [mergeRequestNote()], nextCursor: '1000-0' }] });
      const ingestFactoryEvent = vi.fn(async () => undefined);
      const worker = createWorker({
        fetchImpl: log.fetchImpl,
        storage: settings.storage,
        gitlab,
        controller,
        ingestFactoryEvent,
      });

      await runOnce(worker);

      expect(ingestFactoryEvent).toHaveBeenCalledOnce();
      expect(getProjectMemberAccessLevel).toHaveBeenCalledWith('conn-1', '101', 'ada');
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'gitlab',
          kind: 'issue-comment-created',
          sourceId: 'platform:conn-1:1000-0',
          dedupeKey: 'platform:conn-1:1000-0:session-1:thread-1',
        }),
        expect.objectContaining({ requestContext: expect.anything() }),
      );
      await worker.stop();
    });

    it('drops a note from a sender below the trusted access level without waking the session', async () => {
      const settings = createSettingsStorage();
      const { gitlab } = createGitLab({ subscriptions: [subscription()], accessLevel: 10 });
      const { controller, send } = createController();
      const log = createEventLog({ 'conn-1': [{ events: [mergeRequestNote()], nextCursor: '1000-0' }] });
      const worker = createWorker({ fetchImpl: log.fetchImpl, storage: settings.storage, gitlab, controller });
      const deps = createDeps();

      await runOnce(worker, deps);

      expect(send).not.toHaveBeenCalled();
      expect(deps.logger.debug).toHaveBeenCalledWith(
        'Platform GitLab event dropped: sender not authorized',
        expect.objectContaining({ deliveryId: 'platform:conn-1:1000-0', sender: 'ada' }),
      );
      // A rejected sender is a handled delivery; the cursor still moves on.
      expect(settings.read()).toEqual({ version: 1, connections: { 'conn-1': { afterEventId: '1000-0' } } });
      await worker.stop();
    });
  });

  it('keeps polling other connections when one answers 401, and skips connections needing reauth', async () => {
    const settings = createSettingsStorage();
    const ingestFactoryEvent = vi.fn(async () => undefined);
    const requests: string[] = [];
    const fetchImpl = vi.fn<typeof fetch>(async input => {
      const url = new URL(String(input));
      const connectionId = url.pathname.split('/')[3]!;
      requests.push(connectionId);
      if (connectionId === 'conn-revoked') return json({ message: 'Connection requires reauthorization.' }, 401);
      if (connectionId === 'conn-2' && url.searchParams.get('afterEventId') === '999-0') {
        return json({
          events: [event('1000-0', { object_kind: 'issue', project, object_attributes: { iid: 1, action: 'open' } })],
          nextCursor: '1000-0',
        });
      }
      return json({ events: [], nextCursor: null });
    });
    const worker = createWorker({
      fetchImpl,
      storage: settings.storage,
      ingestFactoryEvent,
      connections: [
        { id: 'conn-revoked', status: 'active' },
        { id: 'conn-stale', status: 'needs_reauth' },
        { id: 'conn-2', status: 'active' },
      ],
    });
    const deps = createDeps();

    await runOnce(worker, deps);

    expect(requests).toEqual(['conn-revoked', 'conn-2', 'conn-2']);
    expect(ingestFactoryEvent).toHaveBeenCalledOnce();
    expect(deps.logger.warn).toHaveBeenCalledWith(
      'Platform GitLab connection needs reauthorization; skipped this cycle',
      expect.objectContaining({ connectionId: 'conn-revoked', status: 401 }),
    );
    expect(deps.logger.error).not.toHaveBeenCalled();
    expect(settings.read()).toEqual({
      version: 1,
      connections: { 'conn-revoked': { afterEventId: '999-0' }, 'conn-2': { afterEventId: '1000-0' } },
    });
    await worker.stop();
  });

  it('does not poll while another replica holds the lease', async () => {
    const settings = createSettingsStorage();
    const lease: LeaseProvider = {
      acquireLease: vi.fn(async () => ({ acquired: false, owner: 'other-worker' })),
      getLeaseOwner: vi.fn(async () => 'other-worker'),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => false),
      transferLease: vi.fn(async () => true),
    };
    const log = createEventLog({ 'conn-1': [] });
    const worker = createWorker({ fetchImpl: log.fetchImpl, storage: settings.storage, intervalMs: 11_000 });

    await runOnce(worker, createDeps(lease));
    await vi.advanceTimersByTimeAsync(11_000);

    expect(lease.acquireLease).toHaveBeenCalledWith('platform-gitlab-events:gitlab', expect.any(String), 33_000);
    expect(lease.acquireLease).toHaveBeenCalledTimes(2);
    expect(log.fetchImpl).not.toHaveBeenCalled();
    expect(settings.save).not.toHaveBeenCalled();
    await worker.stop();
    expect(lease.releaseLease).not.toHaveBeenCalled();
  });

  it('releases its lease on a clean stop and polls no further', async () => {
    const settings = createSettingsStorage();
    const lease: LeaseProvider = {
      acquireLease: vi.fn(async (_key, owner) => ({ acquired: true, owner })),
      getLeaseOwner: vi.fn(async () => undefined),
      releaseLease: vi.fn(async () => undefined),
      renewLease: vi.fn(async () => true),
      transferLease: vi.fn(async () => true),
    };
    const log = createEventLog({ 'conn-1': [] });
    const worker = createWorker({ fetchImpl: log.fetchImpl, storage: settings.storage });

    await runOnce(worker, createDeps(lease));

    expect(log.fetchImpl).toHaveBeenCalledOnce();
    const owner = vi.mocked(lease.acquireLease).mock.calls[0]?.[1];
    await worker.stop();
    expect(lease.releaseLease).toHaveBeenCalledWith('platform-gitlab-events:gitlab', owner);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(log.fetchImpl).toHaveBeenCalledOnce();
  });

  it('rejects a non-positive polling interval', () => {
    expect(() =>
      createWorker({ fetchImpl: vi.fn<typeof fetch>(), storage: createSettingsStorage().storage, intervalMs: 0 }),
    ).toThrow('Platform GitLab event polling interval must be a positive number.');
  });
});
