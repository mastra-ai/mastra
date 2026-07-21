import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GithubIntegration } from './integration';
import type { GithubSignalSubscriptionRow } from './subscriptions';

const getRepositoryCollaboratorPermission = vi.fn<
  (
    installationId: number,
    repoFullName: string,
    username: string,
    signal?: AbortSignal,
  ) => Promise<'admin' | 'maintain' | 'write' | 'triage' | 'read' | 'none' | undefined>
>(async () => 'write');
// Stub integration: dispatch consumes the injected instance for permission checks.
const githubStub = { getRepositoryCollaboratorPermission } as unknown as GithubIntegration;
import { classifyGithubWebhook, dispatchGithubWebhook } from './webhook';
import type { ParsedGithubWebhook } from './webhook';

function parsed(event: string, action: string, extra: Record<string, unknown> = {}): ParsedGithubWebhook {
  return {
    event,
    deliveryId: 'delivery-1',
    payload: {
      action,
      installation: { id: 7 },
      repository: { id: 99, full_name: 'octo/hello' },
      sender: { login: 'ada' },
      pull_request: { number: 34 },
      ...extra,
    },
  };
}

function subscription(id: string, scope: string, threadId = `thread-${id}`): GithubSignalSubscriptionRow {
  return {
    id,
    orgId: 'org-1',
    targetKey: 'change-request:7:99:34',
    sessionId: `session-${id}`,
    resourceId: 'resource-1',
    threadId,
    sessionScope: scope,
    status: 'open',
    data: {
      installationExternalId: '7',
      projectRepositoryId: 'project-repository-1',
      repositoryExternalId: '99',
      repositorySlug: 'octo/hello',
      changeRequestId: '34',
      ownerId: 'owner-1',
      source: 'explicit-tool',
      subscribedByUserId: 'user-1',
    },
    createdAt: new Date('2026-07-13T00:00:00Z'),
    updatedAt: new Date('2026-07-13T00:00:00Z'),
  };
}

beforeEach(() => {
  getRepositoryCollaboratorPermission.mockReset();
  getRepositoryCollaboratorPermission.mockResolvedValue('write');
});

describe('classifyGithubWebhook', () => {
  it.each([
    ['pull_request_review', 'submitted', { review: { state: 'approved' } }, 'urgent'],
    ['pull_request_review', 'submitted', { review: { state: 'changes_requested' } }, 'urgent'],
    ['pull_request', 'closed', { pull_request: { number: 34, merged: true } }, 'urgent'],
    ['pull_request', 'closed', { pull_request: { number: 34, merged: false } }, 'urgent'],
    [
      'issue_comment',
      'created',
      { issue: { number: 34, pull_request: { url: 'https://api.github.test/pr/34' } }, pull_request: undefined },
      'high',
    ],
    ['pull_request_review_comment', 'created', {}, 'high'],
    ['pull_request_review', 'submitted', { review: { state: 'commented' } }, 'high'],
    ['pull_request', 'reopened', {}, 'high'],
    ['pull_request_review', 'dismissed', {}, 'high'],
    ['pull_request', 'synchronize', {}, 'medium'],
    ['pull_request', 'ready_for_review', {}, 'medium'],
    ['pull_request', 'converted_to_draft', {}, 'medium'],
    ['pull_request', 'assigned', {}, 'medium'],
    ['pull_request', 'unassigned', {}, 'medium'],
    ['pull_request', 'review_requested', {}, 'medium'],
    ['pull_request', 'review_request_removed', {}, 'medium'],
    ['pull_request', 'edited', {}, 'low'],
    ['pull_request', 'labeled', {}, 'low'],
    ['pull_request', 'unlabeled', {}, 'low'],
    ['pull_request', 'milestoned', {}, 'low'],
    ['pull_request', 'demilestoned', {}, 'low'],
  ] as const)('%s.%s maps to %s', (event, action, extra, priority) => {
    expect(classifyGithubWebhook(parsed(event, action, extra))?.priority).toBe(priority);
  });

  it('acknowledges unknown actions and ordinary issue comments without classifying them', () => {
    expect(classifyGithubWebhook(parsed('pull_request', 'opened'))).toBeUndefined();
    expect(
      classifyGithubWebhook(parsed('issue_comment', 'created', { issue: { number: 34 }, pull_request: undefined })),
    ).toBeUndefined();
  });
});

describe('dispatchGithubWebhook', () => {
  it('ignores author-gated activity from senders without write access', async () => {
    getRepositoryCollaboratorPermission.mockResolvedValue('read');
    const listSubscriptions = vi.fn(async () => [subscription('a', '/worktrees/a')]);
    const result = await dispatchGithubWebhook(
      parsed('issue_comment', 'created', {
        issue: { number: 34, pull_request: { url: 'https://api.github.test/pr/34' } },
        pull_request: undefined,
      }),
      {
        controller: {} as never,
        github: githubStub,
        listSubscriptions,
      },
    );

    expect(result).toEqual({ delivered: 0, failed: 0, ignored: true });
    expect(getRepositoryCollaboratorPermission).toHaveBeenCalledWith(7, 'octo/hello', 'ada', expect.any(AbortSignal));
    expect(listSubscriptions).not.toHaveBeenCalled();
  });

  it('fails closed when the collaborator permission check times out', async () => {
    vi.useFakeTimers();
    try {
      let permissionSignal: AbortSignal | undefined;
      getRepositoryCollaboratorPermission.mockImplementation((_installationId, _repository, _sender, signal) => {
        permissionSignal = signal;
        return new Promise(() => undefined);
      });
      const listSubscriptions = vi.fn(async () => [subscription('a', '/worktrees/a')]);
      const result = dispatchGithubWebhook(
        parsed('issue_comment', 'created', {
          issue: { number: 34, pull_request: { url: 'https://api.github.test/pr/34' } },
          pull_request: undefined,
        }),
        { controller: {} as never, github: githubStub, listSubscriptions },
      );

      await vi.advanceTimersByTimeAsync(5_000);

      await expect(result).resolves.toEqual({ delivered: 0, failed: 0, ignored: true });
      expect(permissionSignal?.aborted).toBe(true);
      expect(listSubscriptions).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('allows only explicitly authorized bot senders for author-gated activity', async () => {
    const listSubscriptions = vi.fn(async () => []);
    const unauthorized = parsed('pull_request_review_comment', 'created', {
      sender: { login: 'random-bot[bot]', type: 'Bot' },
    });
    const authorized = parsed('pull_request_review_comment', 'created', {
      sender: { login: 'coderabbitai[bot]', type: 'Bot' },
    });

    await expect(
      dispatchGithubWebhook(unauthorized, { controller: {} as never, github: githubStub, listSubscriptions }),
    ).resolves.toEqual({
      delivered: 0,
      failed: 0,
      ignored: true,
    });
    await expect(
      dispatchGithubWebhook(authorized, { controller: {} as never, github: githubStub, listSubscriptions }),
    ).resolves.toEqual({
      delivered: 0,
      failed: 0,
      ignored: false,
    });
    expect(listSubscriptions).toHaveBeenCalledTimes(1);
    expect(getRepositoryCollaboratorPermission).not.toHaveBeenCalled();
  });

  it('delivers with per-target dedupe, exact scope/thread resume, and no delivery overrides', async () => {
    const sendA = vi.fn(async () => ({ record: { id: 'n-a' }, decision: { action: 'deliver' } }));
    const sendB = vi.fn(async () => ({ record: { id: 'n-b' }, decision: { action: 'deliver' } }));
    const switchB = vi.fn(async () => undefined);
    const liveA = { thread: { getId: () => 'thread-a', switch: vi.fn() }, sendNotificationSignal: sendA };
    const resumedB = { thread: { getId: () => 'thread-b', switch: switchB }, sendNotificationSignal: sendB };
    const getSessionByResource = vi.fn(async (_resourceId: string, scope?: string) =>
      scope === '/worktrees/a' ? liveA : undefined,
    );
    const createSession = vi.fn(async () => resumedB);
    const rows = [subscription('a', '/worktrees/a'), subscription('b', '/worktrees/b')];

    const result = await dispatchGithubWebhook(
      parsed('issue_comment', 'created', {
        issue: { number: 34, pull_request: { url: 'https://api.github.test/pr/34' } },
        comment: { html_url: 'https://github.com/octo/hello/pull/34#issuecomment-123' },
        pull_request: undefined,
      }),
      {
        controller: { getSessionByResource, createSession } as never,
        listSubscriptions: async () => rows,
        isAuthorizedSender: async () => true,
      },
    );

    expect(result).toEqual({ delivered: 2, failed: 0, ignored: false });
    expect(getSessionByResource).toHaveBeenCalledWith('resource-1', '/worktrees/a');
    expect(createSession).toHaveBeenCalledWith({
      id: 'session-b',
      ownerId: 'owner-1',
      resourceId: 'resource-1',
      scope: '/worktrees/b',
      tags: {
        factoryProjectId: 'resource-1',
        projectRepositoryId: 'project-repository-1',
        worktreePath: '/worktrees/b',
      },
    });
    expect(switchB).not.toHaveBeenCalled();
    expect(sendA).toHaveBeenCalledWith(
      expect.objectContaining({
        priority: 'high',
        dedupeKey: 'delivery-1:session-a:thread-a',
        coalesceKey: 'github:99:pull-request:34',
        metadata: expect.objectContaining({
          targetUrl: 'https://github.com/octo/hello/pull/34#issuecomment-123',
        }),
      }),
    );
    expect(sendA.mock.calls[0]).toHaveLength(1);
  });

  it('switches an exact live scoped session to its subscribed thread', async () => {
    let currentThread = 'other-thread';
    const switchThread = vi.fn(async ({ threadId }: { threadId: string }) => {
      currentThread = threadId;
    });
    const send = vi.fn(async () => ({ record: { id: 'n-1' }, decision: { action: 'deliver' } }));
    const session = { thread: { getId: () => currentThread, switch: switchThread }, sendNotificationSignal: send };

    await dispatchGithubWebhook(parsed('pull_request', 'synchronize'), {
      controller: { getSessionByResource: async () => session, createSession: vi.fn() } as never,
      listSubscriptions: async () => [subscription('a', '/worktrees/a')],
    });

    expect(switchThread).toHaveBeenCalledWith({ threadId: 'thread-a', emitEvent: false });
    expect(send).toHaveBeenCalledOnce();
  });

  it('includes retained subscriptions and reopens them after accepted reopen delivery', async () => {
    const send = vi.fn(async () => ({ record: { id: 'n-1' }, decision: { action: 'deliver' } }));
    const listSubscriptions = vi.fn(async () => [{ ...subscription('a', '/worktrees/a'), status: 'closed' as const }]);
    const updateStatus = vi.fn(async () => {});

    await dispatchGithubWebhook(parsed('pull_request', 'reopened'), {
      controller: {
        getSessionByResource: async () => ({
          thread: { getId: () => 'thread-a', switch: vi.fn() },
          sendNotificationSignal: send,
        }),
        createSession: vi.fn(),
      } as never,
      listSubscriptions,
      retireSubscription: updateStatus,
    });

    expect(listSubscriptions).toHaveBeenCalledWith(expect.objectContaining({ changeRequestId: '34' }), {
      includeTerminal: true,
    });
    expect(updateStatus).toHaveBeenCalledWith('a', 'open');
  });

  it('isolates failed targets and retires only successful terminal deliveries after acceptance', async () => {
    const order: string[] = [];
    const success = {
      thread: { getId: () => 'thread-a', switch: vi.fn() },
      sendNotificationSignal: vi.fn(async () => ({
        record: { id: 'n-a' },
        decision: { action: 'deliver' },
        persisted: Promise.resolve().then(() => order.push('persisted')),
        accepted: Promise.resolve().then(() => order.push('accepted')),
      })),
    };
    const failure = {
      thread: { getId: () => 'thread-b', switch: vi.fn() },
      sendNotificationSignal: vi.fn(async () => {
        throw new Error('delivery failed');
      }),
    };
    const retire = vi.fn(async id => {
      order.push(`retired:${id}`);
    });
    const onTargetError = vi.fn();

    const result = await dispatchGithubWebhook(
      parsed('pull_request', 'closed', { pull_request: { number: 34, merged: true } }),
      {
        controller: {
          getSessionByResource: async (_resourceId: string, scope?: string) =>
            scope === '/worktrees/a' ? success : failure,
          createSession: vi.fn(),
        } as never,
        listSubscriptions: async () => [subscription('a', '/worktrees/a'), subscription('b', '/worktrees/b')],
        retireSubscription: retire,
        onTargetError,
      },
    );

    expect(result).toEqual({ delivered: 1, failed: 1, ignored: false });
    expect(retire).toHaveBeenCalledOnce();
    expect(retire).toHaveBeenCalledWith('a', 'merged');
    expect(order.at(-1)).toBe('retired:a');
    expect(onTargetError).toHaveBeenCalledWith(expect.objectContaining({ id: 'b' }), expect.any(Error));
  });

  it('does nothing when no subscription exists', async () => {
    const controller = { getSessionByResource: vi.fn(), createSession: vi.fn() };
    const result = await dispatchGithubWebhook(parsed('pull_request', 'edited'), {
      controller: controller as never,
      listSubscriptions: async () => [],
    });

    expect(result).toEqual({ delivered: 0, failed: 0, ignored: false });
    expect(controller.getSessionByResource).not.toHaveBeenCalled();
  });
});
