import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { GitLabSignalSubscriptionRow } from './subscriptions.js';
import { classifyGitLabWebhook, dispatchGitLabWebhook } from './webhook-dispatch.js';
import type { GitLabWebhookDispatchIntegration } from './webhook-dispatch.js';
import type { ParsedGitLabWebhook } from './webhook.js';

function parsed(
  event: string,
  attributes: Record<string, unknown>,
  extra: Record<string, unknown> = {},
  instanceHost?: string,
): ParsedGitLabWebhook {
  return {
    event,
    deliveryId: 'delivery-1',
    ...(instanceHost ? { instanceHost } : {}),
    payload: {
      user: { id: 7, username: 'ada' },
      project: { id: 101, path_with_namespace: 'acme/app', web_url: 'https://gitlab.example.com/acme/app' },
      object_attributes: { iid: 34, url: 'https://gitlab.example.com/acme/app/-/merge_requests/34', ...attributes },
      ...extra,
    },
  };
}

const mergeRequest = (action: string, attributes: Record<string, unknown> = {}) =>
  parsed('Merge Request Hook', { action, ...attributes });
const note = (attributes: Record<string, unknown> = {}) =>
  parsed(
    'Note Hook',
    {
      noteable_type: 'MergeRequest',
      note: 'looks good',
      url: 'https://gitlab.example.com/acme/app/-/merge_requests/34#note_9',
      ...attributes,
    },
    { merge_request: { iid: 34 } },
  );

function subscription(
  id: string,
  scope: string,
  threadId = `thread-${id}`,
  status: 'open' | 'closed' | 'merged' = 'open',
): GitLabSignalSubscriptionRow {
  return {
    id,
    orgId: 'org-1',
    targetKey: 'change-request:gitlab:gitlab.example.com:101:34',
    sessionId: `session-${id}`,
    resourceId: 'resource-1',
    threadId,
    sessionScope: scope,
    status,
    data: {
      host: 'gitlab.example.com',
      projectId: '101',
      projectPath: 'acme/app',
      projectRepositoryId: 'project-repository-1',
      installationExternalId: 'direct',
      changeRequestId: '34',
      ownerId: 'owner-1',
      source: 'explicit-tool',
      subscribedByUserId: 'user-1',
    },
    createdAt: new Date('2026-09-20T00:00:00Z'),
    updatedAt: new Date('2026-09-20T00:00:00Z'),
  };
}

function controllerStub(overrides: Record<string, unknown>, threads: Record<string, string> | 'all' = 'all') {
  return {
    queryThreadById: async ({ threadId }: { threadId: string }) =>
      threads === 'all'
        ? { id: threadId, resourceId: 'resource-1' }
        : threads[threadId]
          ? { id: threadId, resourceId: threads[threadId] }
          : null,
    ...overrides,
  } as never;
}

const getProjectMemberAccessLevel = vi.fn(async (): Promise<number | undefined> => 40);
const resolveActiveConnectionForHost = vi.fn(async (connectionId: string) => connectionId);

function gitlabStub(sessionRow: { userId: string; orgId: string } | null = null): GitLabWebhookDispatchIntegration {
  return {
    integrationStorage: {} as never,
    sourceControlStorage: { sessions: { getBySessionId: async () => sessionRow } },
    getProjectMemberAccessLevel,
    resolveActiveConnectionForHost,
  };
}

function session(threadId: string) {
  const send = vi.fn(async () => ({ record: { id: `n-${threadId}` }, decision: { action: 'deliver' } }));
  return {
    session: { thread: { getId: () => threadId, switch: vi.fn() }, sendNotificationSignal: send },
    send,
  };
}

beforeEach(() => {
  getProjectMemberAccessLevel.mockReset();
  getProjectMemberAccessLevel.mockResolvedValue(40);
  resolveActiveConnectionForHost.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('classifyGitLabWebhook', () => {
  it.each([
    ['approved', {}, 'review-approved', 'urgent', false],
    ['unapproved', {}, 'review-dismissed', 'high', false],
    ['merge', {}, 'pull-request-merged', 'urgent', true],
    ['close', {}, 'pull-request-closed', 'urgent', true],
    ['reopen', {}, 'pull-request-reopened', 'high', false],
    ['update', { oldrev: 'abc123' }, 'pull-request-synchronize', 'medium', false],
    ['update', {}, 'pull-request-edited', 'low', false],
  ] as const)('merge request %s maps to %s', (action, attributes, kind, priority, terminal) => {
    const notification = classifyGitLabWebhook(mergeRequest(action, attributes));
    expect(notification).toMatchObject({
      action,
      kind,
      priority,
      terminal,
      metadata: {
        event: 'Merge Request Hook',
        host: 'gitlab.example.com',
        projectId: 101,
        projectPath: 'acme/app',
        mergeRequestIid: 34,
        sender: 'ada',
        senderId: 7,
        deliveryId: 'delivery-1',
      },
    });
  });

  it('classifies merge request notes as comments and diff notes as review comments', () => {
    expect(classifyGitLabWebhook(note())).toMatchObject({
      kind: 'issue-comment-created',
      priority: 'high',
      action: 'created',
      summary: 'ada commented on acme/app!34',
    });
    expect(classifyGitLabWebhook(note({ type: 'DiffNote' }))).toMatchObject({
      kind: 'review-comment-created',
      summary: 'ada left a review comment on acme/app!34',
    });
  });

  it('acknowledges unknown actions, issue notes, other events and host mismatches without classifying them', () => {
    expect(classifyGitLabWebhook(mergeRequest('open'))).toBeUndefined();
    expect(
      classifyGitLabWebhook(parsed('Note Hook', { noteable_type: 'Issue' }, { issue: { iid: 3 } })),
    ).toBeUndefined();
    expect(classifyGitLabWebhook(parsed('Issue Hook', { action: 'close' }))).toBeUndefined();
    expect(
      classifyGitLabWebhook(parsed('Merge Request Hook', { action: 'merge' }, {}, 'gitlab.other.example')),
    ).toBeUndefined();
  });

  it('summarizes with the merge request label and sender', () => {
    expect(classifyGitLabWebhook(mergeRequest('merge'))?.summary).toBe('ada merged the merge request on acme/app!34');
  });
});

describe('dispatchGitLabWebhook', () => {
  it('ignores deliveries no notification maps to without touching subscriptions', async () => {
    const listSubscriptions = vi.fn(async () => []);
    await expect(
      dispatchGitLabWebhook(mergeRequest('open'), { controller: {} as never, listSubscriptions }),
    ).resolves.toEqual({ delivered: 0, failed: 0, skipped: 0, ignored: true });
    expect(listSubscriptions).not.toHaveBeenCalled();
  });

  it('runs the woken session as the subscribing user in the subscription organization', async () => {
    const owned = session('thread-a');
    const result = await dispatchGitLabWebhook(mergeRequest('reopen'), {
      controller: controllerStub({ getSessionByResource: vi.fn(async () => owned.session), createSession: vi.fn() }),
      listSubscriptions: async () => [subscription('a', '/worktrees/a', 'thread-a')],
      retireSubscription: vi.fn(async () => undefined),
    });

    expect(result).toMatchObject({ delivered: 1, failed: 0 });
    expect(owned.send).toHaveBeenCalledTimes(1);
    const [, options] = owned.send.mock.calls[0] as unknown as [
      unknown,
      { requestContext?: { get: (key: string) => unknown } },
    ];
    expect(options?.requestContext?.get('user')).toEqual({ workosId: 'user-1', organizationId: 'org-1' });
  });

  it('falls back to the Factory session owner for a row that names no subscribing user', async () => {
    const owned = session('thread-a');
    const row = subscription('a', '/worktrees/a', 'thread-a');
    row.data = { ...row.data, subscribedByUserId: null };
    const result = await dispatchGitLabWebhook(mergeRequest('reopen'), {
      controller: controllerStub({ getSessionByResource: vi.fn(async () => owned.session), createSession: vi.fn() }),
      gitlab: gitlabStub({ userId: 'owner-9', orgId: 'org-9' }),
      listSubscriptions: async () => [row],
      retireSubscription: vi.fn(async () => undefined),
    });
    expect(result).toMatchObject({ delivered: 1 });
    const [, options] = owned.send.mock.calls[0] as unknown as [
      unknown,
      { requestContext?: { get: (key: string) => unknown } },
    ];
    expect(options?.requestContext?.get('user')).toEqual({ workosId: 'owner-9', organizationId: 'org-9' });
  });

  it('fails the delivery, without retiring, when neither the row nor the session names a user', async () => {
    const owned = session('thread-a');
    const row = subscription('a', '/worktrees/a', 'thread-a');
    row.data = { ...row.data, subscribedByUserId: null };
    const retireSubscription = vi.fn(async () => undefined);
    const onTargetError = vi.fn();
    const result = await dispatchGitLabWebhook(mergeRequest('close'), {
      controller: controllerStub({ getSessionByResource: vi.fn(async () => owned.session), createSession: vi.fn() }),
      gitlab: gitlabStub(null),
      listSubscriptions: async () => [row],
      retireSubscription,
      onTargetError,
    });
    expect(result).toMatchObject({ delivered: 0, failed: 1, skipped: 0 });
    expect(owned.send).not.toHaveBeenCalled();
    expect(retireSubscription).not.toHaveBeenCalled();
    expect(onTargetError).toHaveBeenCalledWith(
      row,
      expect.objectContaining({ message: expect.stringContaining('has no resolvable tenant identity') }),
    );
  });

  it('delivers to every subscribed session, then retires terminal subscriptions', async () => {
    const a = session('thread-a');
    const b = session('thread-b');
    const getSessionByResource = vi.fn(async (_resourceId: string, scope?: string) =>
      scope === '/worktrees/a' ? a.session : b.session,
    );
    const retireSubscription = vi.fn(async () => undefined);

    const result = await dispatchGitLabWebhook(mergeRequest('merge'), {
      controller: controllerStub({ getSessionByResource, createSession: vi.fn() }),
      listSubscriptions: async () => [
        subscription('a', '/worktrees/a', 'thread-a'),
        subscription('b', '/worktrees/b', 'thread-b'),
      ],
      retireSubscription,
    });

    expect(result).toEqual({ delivered: 2, failed: 0, skipped: 0, ignored: false });
    expect(a.send).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'gitlab',
        kind: 'pull-request-merged',
        priority: 'urgent',
        summary: 'ada merged the merge request on acme/app!34',
        sourceId: 'delivery-1',
        dedupeKey: 'delivery-1:session-a:thread-a',
        coalesceKey: 'gitlab:gitlab.example.com:101:merge-request:34',
        metadata: expect.objectContaining({
          event: 'Merge Request Hook',
          action: 'merge',
          repository: 'acme/app',
          mergeRequestIid: 34,
          targetUrl: 'https://gitlab.example.com/acme/app/-/merge_requests/34',
          deliveryId: 'delivery-1',
        }),
      }),
      expect.objectContaining({ requestContext: expect.anything() }),
    );
    expect(retireSubscription.mock.calls).toEqual([
      ['a', 'merged'],
      ['b', 'merged'],
    ]);
  });

  it('reactivates retained subscriptions on reopen and points note deliveries at the note', async () => {
    const a = session('thread-a');
    const retireSubscription = vi.fn(async () => undefined);
    const listSubscriptions = vi.fn(async () => [subscription('a', '/worktrees/a', 'thread-a', 'closed')]);
    const controller = controllerStub({ getSessionByResource: async () => a.session, createSession: vi.fn() });

    await expect(
      dispatchGitLabWebhook(mergeRequest('reopen'), { controller, listSubscriptions, retireSubscription }),
    ).resolves.toMatchObject({ delivered: 1 });
    expect(listSubscriptions).toHaveBeenCalledWith(expect.anything(), { includeTerminal: true });
    expect(retireSubscription).toHaveBeenCalledWith('a', 'open');

    await expect(
      dispatchGitLabWebhook(note(), { controller, gitlab: gitlabStub(), listSubscriptions, retireSubscription }),
    ).resolves.toMatchObject({ delivered: 1 });
    expect(a.send).toHaveBeenLastCalledWith(
      expect.objectContaining({
        kind: 'issue-comment-created',
        metadata: expect.objectContaining({
          targetUrl: 'https://gitlab.example.com/acme/app/-/merge_requests/34#note_9',
        }),
      }),
      expect.objectContaining({ requestContext: expect.anything() }),
    );
    expect(getProjectMemberAccessLevel).toHaveBeenCalledWith('direct', '101', 'ada');
  });

  it('gates comments and approvals on trusted membership through the subscription connection', async () => {
    const a = session('thread-a');
    const onSenderRejected = vi.fn();
    const controller = controllerStub({ getSessionByResource: async () => a.session, createSession: vi.fn() });
    const listSubscriptions = async () => [subscription('a', '/worktrees/a', 'thread-a')];
    resolveActiveConnectionForHost.mockResolvedValue('direct-preferred');

    getProjectMemberAccessLevel.mockResolvedValueOnce(20);
    await expect(
      dispatchGitLabWebhook(mergeRequest('approved'), {
        controller,
        gitlab: gitlabStub(),
        listSubscriptions,
        onSenderRejected,
      }),
    ).resolves.toEqual({ delivered: 0, failed: 0, skipped: 0, ignored: false });
    expect(getProjectMemberAccessLevel).toHaveBeenCalledWith('direct-preferred', '101', 'ada');
    expect(onSenderRejected).toHaveBeenCalledOnce();
    expect(a.send).not.toHaveBeenCalled();

    getProjectMemberAccessLevel.mockRejectedValueOnce(new Error('GitLab unavailable'));
    await expect(
      dispatchGitLabWebhook(note({ type: 'DiffNote' }), { controller, gitlab: gitlabStub(), listSubscriptions }),
    ).resolves.toMatchObject({ delivered: 0 });

    // Without an integration to ask, gated kinds fail closed; ungated ones still flow.
    await expect(dispatchGitLabWebhook(note(), { controller, listSubscriptions })).resolves.toMatchObject({
      delivered: 0,
    });
    await expect(
      dispatchGitLabWebhook(mergeRequest('close'), {
        controller,
        listSubscriptions,
        retireSubscription: async () => undefined,
      }),
    ).resolves.toMatchObject({
      delivered: 1,
    });
  });

  it('fails the author gate closed when the membership lookup hangs', async () => {
    vi.useFakeTimers();
    const a = session('thread-a');
    getProjectMemberAccessLevel.mockImplementationOnce(() => new Promise(() => {}));
    const pending = dispatchGitLabWebhook(mergeRequest('approved'), {
      controller: controllerStub({ getSessionByResource: async () => a.session, createSession: vi.fn() }),
      gitlab: gitlabStub(),
      listSubscriptions: async () => [subscription('a', '/worktrees/a', 'thread-a')],
    });
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual({ delivered: 0, failed: 0, skipped: 0, ignored: false });
    expect(a.send).not.toHaveBeenCalled();
  });

  it('skips threads this deployment does not hold and reports per-target errors', async () => {
    const onTargetSkipped = vi.fn();
    const onTargetError = vi.fn();
    const a = session('thread-a');
    const result = await dispatchGitLabWebhook(mergeRequest('close'), {
      controller: controllerStub(
        {
          getSessionByResource: async (_resourceId: string, scope?: string) =>
            scope === '/worktrees/a' ? a.session : undefined,
          createSession: vi.fn(),
        },
        { 'thread-a': 'resource-1', 'thread-b': 'resource-1' },
      ),
      gitlab: gitlabStub(null),
      listSubscriptions: async () => [
        subscription('a', '/worktrees/a', 'thread-a'),
        subscription('b', '/worktrees/b', 'thread-b'),
        subscription('c', '/worktrees/c', 'thread-elsewhere'),
      ],
      retireSubscription: async () => undefined,
      onTargetSkipped,
      onTargetError,
    });

    expect(result).toEqual({ delivered: 1, failed: 1, skipped: 1, ignored: false });
    expect(onTargetSkipped.mock.calls[0]![0].id).toBe('c');
    expect(onTargetError.mock.calls[0]![0].id).toBe('b');
    expect(String(onTargetError.mock.calls[0]![1])).toMatch(/has no Factory session session-b/);
  });

  it('delivers only to subscriptions created under the source connection when one is named', async () => {
    const onConnectionMismatch = vi.fn();
    resolveActiveConnectionForHost.mockImplementation(async (connectionId: string) => connectionId);
    const own = session('thread-own');
    const other = session('thread-other');
    const ownRow = subscription('own', '/worktrees/own', 'thread-own');
    const otherRow = subscription('other', '/worktrees/other', 'thread-other');
    otherRow.data.installationExternalId = 'conn-2';
    ownRow.data.installationExternalId = 'conn-1';
    const result = await dispatchGitLabWebhook(mergeRequest('approved'), {
      controller: controllerStub({
        getSessionByResource: async (_resourceId: string, scope?: string) =>
          scope === '/worktrees/own' ? own.session : other.session,
      }),
      gitlab: gitlabStub(null),
      listSubscriptions: async () => [ownRow, otherRow],
      retireSubscription: async () => undefined,
      sourceConnectionId: 'conn-1',
      onConnectionMismatch,
    });

    expect(result).toEqual({ delivered: 1, failed: 0, skipped: 1, ignored: false });
    expect(own.send).toHaveBeenCalledOnce();
    expect(other.send).not.toHaveBeenCalled();
    expect(onConnectionMismatch.mock.calls[0]![0].id).toBe('other');
    // The membership check runs only for the subscription that is delivered.
    expect(getProjectMemberAccessLevel).toHaveBeenCalledTimes(1);
    expect(getProjectMemberAccessLevel).toHaveBeenCalledWith('conn-1', '101', expect.any(String));
  });

  it('recreates a missing session as the Factory session owner and binds the subscribed thread', async () => {
    const a = session('thread-a');
    a.session.thread.getId = vi.fn().mockReturnValueOnce('other-thread').mockReturnValue('thread-a');
    const createSession = vi.fn(async () => a.session);
    await expect(
      dispatchGitLabWebhook(mergeRequest('close'), {
        controller: controllerStub({ getSessionByResource: async () => undefined, createSession }),
        gitlab: gitlabStub({ userId: 'owner-1', orgId: 'org-1' }),
        listSubscriptions: async () => [subscription('a', '/worktrees/a', 'thread-a')],
        retireSubscription: async () => undefined,
      }),
    ).resolves.toMatchObject({ delivered: 1 });
    expect(createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'session-a',
        ownerId: 'owner-1',
        resourceId: 'resource-1',
        scope: '/worktrees/a',
        tags: { factoryProjectId: 'resource-1', projectRepositoryId: 'project-repository-1' },
      }),
    );
    expect(a.session.thread.switch).toHaveBeenCalledWith({ threadId: 'thread-a', emitEvent: false });
  });
});
