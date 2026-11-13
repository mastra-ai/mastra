import type { WorkerDeps } from '@mastra/core/worker';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import type { GitLabSignalSubscriptionRow } from '../../gitlab/subscriptions.js';
import { normalizeGitLabWebhookMetadata } from '../../gitlab/webhook.js';
import type { ParsedGitLabWebhook } from '../../gitlab/webhook.js';
import { PlatformEventsWorker } from '../foundation/events-worker.js';
import type { PlatformConnectEventDelivery, PlatformEventsWorkerStorage } from '../foundation/events-worker.js';
import { startFakePlatform } from '../foundation/test-utils.js';
import { handleGitLabConnectEvent } from './connect-events.js';
import type { GitLabConnectEventDependencies } from './connect-events.js';
import { PlatformGitLabIntegration } from './integration.js';

const project = { id: 101, path_with_namespace: 'acme/app', web_url: 'https://gitlab.com/acme/app' };

function delivery(
  id: string,
  payload: unknown,
  overrides: Partial<PlatformConnectEventDelivery> = {},
): PlatformConnectEventDelivery {
  return {
    id,
    timestamp: 1_700_000_000_000,
    connectionId: 'conn-1',
    integrationId: 'gitlab',
    eventType: 'Issue Hook',
    sourceEventId: null,
    payload,
    unverified: false,
    dedupeKey: overrides.sourceEventId ?? id,
    ...overrides,
  };
}

function createGitLab(options: { subscriptions?: GitLabSignalSubscriptionRow[]; accessLevel?: number } = {}) {
  const listByTarget = vi.fn(async () => options.subscriptions ?? []);
  const updateStatus = vi.fn(async () => undefined);
  const getProjectMemberAccessLevel = vi.fn(async () => options.accessLevel ?? 40);
  const gitlab: GitLabConnectEventDependencies['gitlab'] = {
    integrationStorage: { subscriptions: { listByTarget, updateStatus } } as never,
    sourceControlStorage: {
      sessions: { getBySessionId: async () => ({ userId: 'user-1', orgId: 'org-1' }) },
    },
    getProjectMemberAccessLevel,
  };
  return { gitlab, getProjectMemberAccessLevel };
}

describe('handleGitLabConnectEvent', () => {
  it('hands issue, note, merge request and push bodies to the rules ingress with direct-route metadata', async () => {
    const ingestFactoryEvent = vi.fn(async (_parsed: ParsedGitLabWebhook) => undefined);
    const { gitlab } = createGitLab();
    const bodies = [
      { object_kind: 'issue', user: { username: 'ada' }, project, object_attributes: { iid: 12, action: 'open' } },
      {
        object_kind: 'note',
        user: { username: 'grace' },
        project,
        object_attributes: { noteable_type: 'Issue', note: 'please look' },
        issue: { iid: 12 },
      },
      {
        object_kind: 'merge_request',
        user: { username: 'linus' },
        project,
        object_attributes: { iid: 34, action: 'merge' },
      },
      { object_kind: 'push', user_username: 'ken', project, ref: 'refs/heads/main' },
    ];
    for (const [index, body] of bodies.entries()) {
      await handleGitLabConnectEvent(delivery(String(2000 + index), body), { gitlab, ingestFactoryEvent });
    }

    const parsed = ingestFactoryEvent.mock.calls.map(([event]) => event);
    expect(parsed.map(event => event.deliveryId)).toEqual([
      'platform:conn-1:2000',
      'platform:conn-1:2001',
      'platform:conn-1:2002',
      'platform:conn-1:2003',
    ]);
    expect(parsed.map(event => normalizeGitLabWebhookMetadata(event))).toEqual([
      expect.objectContaining({
        event: 'Issue Hook',
        projectId: 101,
        projectPath: 'acme/app',
        issueIid: 12,
        sender: 'ada',
      }),
      expect.objectContaining({
        event: 'Note Hook',
        projectId: 101,
        issueIid: 12,
        noteableType: 'Issue',
        sender: 'grace',
      }),
      expect.objectContaining({ event: 'Merge Request Hook', projectId: 101, mergeRequestIid: 34, sender: 'linus' }),
      expect.objectContaining({ event: 'Push Hook', projectId: 101 }),
    ]);
    // No instance header exists on this path; the host comes from the payload.
    expect(parsed.every(event => !('instanceHost' in event))).toBe(true);
  });

  it('keys a delivery on the provider delivery id, so a redelivered webhook is the same delivery', async () => {
    const ingestFactoryEvent = vi.fn(async (_parsed: ParsedGitLabWebhook) => undefined);
    const { gitlab } = createGitLab();
    const body = { object_kind: 'issue', project, object_attributes: { iid: 1, action: 'open' } };

    // GitLab retried the webhook: the platform logged it twice under new event ids.
    await handleGitLabConnectEvent(delivery('3000', body, { sourceEventId: 'gl-uuid-1' }), {
      gitlab,
      ingestFactoryEvent,
    });
    await handleGitLabConnectEvent(delivery('3001', body, { sourceEventId: 'gl-uuid-1' }), {
      gitlab,
      ingestFactoryEvent,
    });

    expect(ingestFactoryEvent.mock.calls.map(([event]) => event.deliveryId)).toEqual([
      'platform:conn-1:gl-uuid-1',
      'platform:conn-1:gl-uuid-1',
    ]);
  });

  it('ignores unsupported object kinds and malformed bodies', async () => {
    const ingestFactoryEvent = vi.fn(async () => undefined);
    const { gitlab } = createGitLab();
    for (const body of [
      { object_kind: 'pipeline', project, object_attributes: { id: 5 } },
      'not an object',
      { project },
    ]) {
      await handleGitLabConnectEvent(delivery('4000', body), { gitlab, ingestFactoryEvent });
    }
    expect(ingestFactoryEvent).not.toHaveBeenCalled();
  });

  it('lets a rules ingress failure propagate so the event is retried', async () => {
    const { gitlab } = createGitLab();
    const ingestFactoryEvent = vi.fn(async () => {
      throw new Error('rules unavailable');
    });
    await expect(
      handleGitLabConnectEvent(
        delivery('5000', { object_kind: 'issue', project, object_attributes: { iid: 1, action: 'open' } }),
        { gitlab, ingestFactoryEvent },
      ),
    ).rejects.toThrow('rules unavailable');
  });

  it('drops an unverified event without reading its payload', async () => {
    const ingestFactoryEvent = vi.fn(async () => undefined);
    const onUnverifiedDropped = vi.fn();
    const { gitlab } = createGitLab();
    await handleGitLabConnectEvent(
      delivery(
        '6000',
        { object_kind: 'issue', project, object_attributes: { iid: 1, action: 'open' } },
        { unverified: true },
      ),
      { gitlab, ingestFactoryEvent, onUnverifiedDropped },
    );
    expect(ingestFactoryEvent).not.toHaveBeenCalled();
    expect(onUnverifiedDropped).toHaveBeenCalledOnce();
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
      delivery('7000', {
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
          getSession: async () => session,
        } as never,
      };
    }

    it('wakes a subscribed session for a merge request note from a trusted project member', async () => {
      const { gitlab, getProjectMemberAccessLevel } = createGitLab({
        subscriptions: [subscription()],
        accessLevel: 40,
      });
      const { controller, send } = createController();
      const ingestFactoryEvent = vi.fn(async () => undefined);

      await handleGitLabConnectEvent(mergeRequestNote(), { gitlab, controller, ingestFactoryEvent });

      expect(ingestFactoryEvent).toHaveBeenCalledOnce();
      expect(getProjectMemberAccessLevel).toHaveBeenCalledWith('conn-1', '101', 'ada');
      expect(send).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'gitlab',
          kind: 'issue-comment-created',
          sourceId: 'platform:conn-1:7000',
          dedupeKey: 'platform:conn-1:7000:session-1:thread-1',
        }),
        expect.objectContaining({ requestContext: expect.anything() }),
      );
    });

    it('does not wake a subscription that another connection created, even for the same merge request', async () => {
      const foreign = subscription();
      foreign.data.installationExternalId = 'conn-2';
      const { gitlab, getProjectMemberAccessLevel } = createGitLab({ subscriptions: [foreign], accessLevel: 40 });
      const { controller, send } = createController();

      await handleGitLabConnectEvent(mergeRequestNote(), { gitlab, controller });

      expect(send).not.toHaveBeenCalled();
      expect(getProjectMemberAccessLevel).not.toHaveBeenCalled();
    });

    it('drops a note from a sender below the trusted access level without waking the session', async () => {
      const { gitlab } = createGitLab({ subscriptions: [subscription()], accessLevel: 10 });
      const { controller, send } = createController();

      await handleGitLabConnectEvent(mergeRequestNote(), { gitlab, controller });

      expect(send).not.toHaveBeenCalled();
    });
  });
});

describe('PlatformGitLabIntegration events', () => {
  it('receives a GitLab webhook from the platform events service and runs it through the webhook processor', async () => {
    const platform = await startFakePlatform();
    platform.orgConnections = [{ id: 'conn-1', integrationId: 'gitlab', status: 'active' }];
    platform.linked.add('conn-1');
    const gitlab = new PlatformGitLabIntegration({ connect: platform.connect() });
    const handled: PlatformConnectEventDelivery[] = [];
    const route = gitlab.connectEventRoute({} as never);
    const recorded = {
      ...route,
      handle: async (event: PlatformConnectEventDelivery) => {
        handled.push(event);
        await route.handle(event);
      },
    };
    let saved: unknown = null;
    const worker = new PlatformEventsWorker({
      events: gitlab.binding.connect.events,
      storage: {
        integrationId: 'platform',
        settings: {
          get: async () => saved,
          save: async (_o: string, _u: string, next: unknown) => void (saved = next),
        },
      } as unknown as PlatformEventsWorkerStorage,
      routes: [recorded],
    });
    await worker.init({
      pubsub: {},
      storage: {},
      logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    } as unknown as WorkerDeps);
    await worker.start();
    onTestFinished(() => worker.stop());
    await vi.waitFor(() => expect(platform.openStreams).toBe(1));

    platform.publishConnect({
      connectionId: 'conn-1',
      integrationId: 'gitlab',
      eventType: 'Issue Hook',
      payload: { object_kind: 'issue', project, object_attributes: { iid: 9, action: 'open' } },
      sourceEventId: 'gl-uuid-9',
    });

    await vi.waitFor(() =>
      expect(handled).toEqual([expect.objectContaining({ connectionId: 'conn-1', dedupeKey: 'gl-uuid-9' })]),
    );
  });
});
