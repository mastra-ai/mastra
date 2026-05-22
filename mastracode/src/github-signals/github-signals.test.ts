import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createClient } from '@libsql/client';
import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '@mastra/core/request-context';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GithubSignals, ghSignals } from './github-signals';
import { GithubNotificationPoller } from './notification-poller.js';
import { GithubNotificationStore } from './notification-store.js';

afterEach(() => {
  vi.useRealTimers();
});

function createHarness() {
  const thread = {
    id: 'thread-1',
    resourceId: 'resource-1',
    title: 'Thread 1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    metadata: {},
  };

  const memory = {
    getThreadById: vi.fn(async () => thread),
    updateThread: vi.fn(async ({ metadata }) => {
      thread.metadata = metadata;
      return thread;
    }),
  };

  const mastra = {
    getStorage: () => ({
      getStore: vi.fn(async (name: string) => (name === 'memory' ? memory : undefined)),
    }),
  };

  const messageList = { addSystem: vi.fn() };
  const requestContext = new RequestContext();
  requestContext.set(MASTRA_THREAD_ID_KEY, 'thread-1');
  requestContext.set(MASTRA_RESOURCE_ID_KEY, 'resource-1');

  return { thread, memory, mastra, messageList, requestContext };
}

function createSnapshot({
  title = 'Test PR',
  state = 'open',
  merged = false,
  closedAt,
  mergedAt,
  mergeable,
  mergeableState,
  headSha,
  failedChecks = [],
  comments = [],
  reviews = [],
}: {
  title?: string;
  state?: string;
  merged?: boolean;
  closedAt?: string;
  mergedAt?: string;
  mergeable?: boolean | string | null;
  mergeableState?: string;
  headSha?: string;
  failedChecks?: unknown[];
  comments?: unknown[];
  reviews?: unknown[];
} = {}) {
  return {
    title,
    state,
    merged,
    closedAt,
    mergedAt,
    mergeable,
    mergeableState,
    headSha,
    failedChecks,
    comments,
    reviews,
  };
}

type TestSnapshot = ReturnType<typeof createSnapshot>;

function createSnapshotCommandRunner(snapshots: TestSnapshot[], permissions: Record<string, string | Error> = {}) {
  let snapshotIndex = 0;
  let currentSnapshot = snapshots[0] ?? createSnapshot();
  return vi.fn(async (args: string[]) => {
    const endpoint = args[1];
    if (args[0] !== 'api' || typeof endpoint !== 'string') {
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    }

    if (args.includes('/notifications')) {
      return { stdout: 'HTTP/2.0 200 OK\netag: "etag-empty"\n\n[]' };
    }

    const permissionMatch = endpoint.match(/^repos\/([^/]+\/[^/]+)\/collaborators\/([^/]+)\/permission$/);
    if (permissionMatch) {
      const user = permissionMatch[2]!;
      const permission = permissions[user] ?? 'write';
      if (permission instanceof Error) throw permission;
      return { stdout: `${permission}\n` };
    }

    if (/^repos\/[^/]+\/[^/]+\/pulls\/\d+$/.test(endpoint)) {
      currentSnapshot = snapshots[snapshotIndex++] ?? snapshots.at(-1) ?? createSnapshot();
      return {
        stdout: JSON.stringify({
          title: currentSnapshot.title,
          html_url: 'https://github.com/mastra-ai/mastra/pull/123',
          state: currentSnapshot.state,
          merged: currentSnapshot.merged,
          closed_at: currentSnapshot.closedAt,
          merged_at: currentSnapshot.mergedAt,
          mergeable: currentSnapshot.mergeable,
          mergeable_state: currentSnapshot.mergeableState,
          head: { sha: currentSnapshot.headSha ?? `sha-${snapshotIndex}` },
        }),
      };
    }

    if (/^repos\/[^/]+\/[^/]+\/issues\/\d+\/comments$/.test(endpoint)) {
      return { stdout: JSON.stringify([currentSnapshot.comments]) };
    }

    if (/^repos\/[^/]+\/[^/]+\/pulls\/\d+\/reviews$/.test(endpoint)) {
      return { stdout: JSON.stringify([currentSnapshot.reviews]) };
    }

    if (/^repos\/[^/]+\/[^/]+\/commits\/[^/]+\/check-runs$/.test(endpoint)) {
      return { stdout: JSON.stringify({ check_runs: currentSnapshot.failedChecks }) };
    }

    throw new Error(`Unexpected gh api endpoint: ${endpoint}`);
  });
}

function createSendSignalMock() {
  return vi.fn(() => ({
    accepted: true,
    runId: 'run-1',
    signal: {} as any,
    persisted: Promise.resolve(),
    started: Promise.resolve(),
  }));
}

const historicalGenericAuthorPrNotification = {
  id: '23866356138',
  unread: true,
  reason: 'author',
  updated_at: '2026-05-14T21:13:29Z',
  subject: {
    title: 'ci: run workspace tests from source',
    url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/16567',
    latest_comment_url: null,
    type: 'PullRequest',
  },
  repository: { full_name: 'mastra-ai/mastra' },
  url: 'https://api.github.com/notifications/threads/23866356138',
};

const historicalCodeRabbitCommentNotification = {
  id: '23852814282',
  unread: true,
  reason: 'author',
  updated_at: '2026-05-14T18:39:59Z',
  subject: {
    title: 'feat(core): add GitHub PR signals',
    url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/16515',
    latest_comment_url: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/314159',
    type: 'PullRequest',
  },
  repository: { full_name: 'mastra-ai/mastra' },
  url: 'https://api.github.com/notifications/threads/23852814282',
};

const historicalRequestChangesReviewThreadNotification = {
  id: '23879042032',
  unread: true,
  reason: 'comment',
  updated_at: '2026-05-15T16:32:42Z',
  last_read_at: '2026-05-15T16:32:21Z',
  subject: {
    title: 'feat(mastracode): add /skill:<name> command to activate skills explicitly',
    url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/16618',
    latest_comment_url: null,
    type: 'PullRequest',
  },
  repository: { full_name: 'mastra-ai/mastra' },
  url: 'https://api.github.com/notifications/threads/23879042032',
};

async function processSignals(
  github: GithubSignals,
  harness: ReturnType<typeof createHarness>,
  messages: any[],
  overrides: Record<string, unknown> = {},
) {
  github.processor.__registerMastra(harness.mastra as any);
  return github.processor.processInputStep({
    stepNumber: 0,
    steps: [],
    messages,
    messageList: harness.messageList as any,
    requestContext: harness.requestContext,
    systemMessages: [],
    state: {},
    model: {} as any,
    tools: {},
    abort: (() => {
      throw new Error('aborted');
    }) as any,
    retryCount: 0,
    ...overrides,
  });
}

async function processOutputStep(
  github: GithubSignals,
  harness: ReturnType<typeof createHarness>,
  messages: any[],
  step: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
) {
  github.processor.__registerMastra(harness.mastra as any);
  return github.processor.processOutputStep?.({
    stepNumber: 0,
    messages,
    messageList: harness.messageList as any,
    requestContext: harness.requestContext,
    systemMessages: [],
    state: {},
    usage: {} as any,
    steps: [],
    abort: (() => {
      throw new Error('aborted');
    }) as any,
    retryCount: 0,
    ...step,
    ...overrides,
  } as any);
}

async function processOutputResult(
  github: GithubSignals,
  harness: ReturnType<typeof createHarness>,
  messages: any[],
  overrides: Record<string, unknown> = {},
) {
  github.processor.__registerMastra(harness.mastra as any);
  return github.processor.processOutputResult?.({
    messages,
    messageList: harness.messageList as any,
    requestContext: harness.requestContext,
    systemMessages: [],
    state: {},
    usage: {} as any,
    steps: [],
    abort: (() => {
      throw new Error('aborted');
    }) as any,
    retryCount: 0,
    ...overrides,
  } as any);
}

describe('GithubSignals', () => {
  it('creates subscribe, unsubscribe, and compact notification signals', () => {
    const subscribe = ghSignals.prSubscribe({ prNumber: 123, repo: 'mastra-ai/mastra' });
    const unsubscribe = ghSignals.prUnsubscribe({ prNumber: 123, repo: 'mastra-ai/mastra' });
    const review = ghSignals.prNotification({
      kind: 'review',
      prNumber: 123,
      repo: 'mastra-ai/mastra',
      title: 'GitHub review',
      details: 'test2',
      user: 'TylerBarnes',
      reviewState: 'COMMENTED',
    });

    expect(subscribe.type).toBe('system-reminder');
    expect(subscribe.attributes).toMatchObject({
      type: 'github-pr-subscribe',
      prNumber: 123,
      repo: 'mastra-ai/mastra',
    });
    expect(subscribe.contents).toContain('subscribed to Github PR #123');
    expect(unsubscribe.type).toBe('system-reminder');
    expect(unsubscribe.attributes).toMatchObject({ type: 'github-pr-unsubscribe' });
    expect(review.type).toBe('system-reminder');
    expect(review.contents).toBe('test2');
    expect(review.attributes).toMatchObject({
      type: 'github-review',
      kind: 'review',
      pr: 123,
      repo: 'mastra-ai/mastra',
      user: 'TylerBarnes',
      reviewState: 'COMMENTED',
    });
  });

  it('subscribes a thread, persists metadata, and registers active polling', async () => {
    const { memory, thread } = createHarness();
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot(),
      createSnapshot({
        failedChecks: [{ name: 'lint', conclusion: 'failure', details_url: 'https://github.com/checks/lint' }],
      }),
    ]);
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);

    const subscription = await github.subscribeThread({
      memory: memory as any,
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });

    expect(subscription).toMatchObject({ repo: 'mastra-ai/mastra', prNumber: 123 });
    expect(Object.keys((thread.metadata as any).mastra.githubSignals.subscriptions)).toHaveLength(1);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({ type: 'github-ci-failure', pr: 123, checkCount: 1 }),
        contents: '- lint: failure',
      }),
      expect.objectContaining({ resourceId: 'resource-1', threadId: 'thread-1' }),
    );
  });

  it('unsubscribes a thread and removes persisted metadata and active polling', async () => {
    const { memory, thread } = createHarness();
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot(),
      createSnapshot({
        failedChecks: [{ name: 'lint', conclusion: 'failure', details_url: 'https://github.com/checks/lint' }],
      }),
    ]);
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    await github.subscribeThread({
      memory: memory as any,
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });

    const removed = await github.unsubscribeThread({
      memory: memory as any,
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });

    expect(removed).toMatchObject({ repo: 'mastra-ai/mastra', prNumber: 123 });
    expect(Object.keys((thread.metadata as any).mastra.githubSignals.subscriptions)).toHaveLength(0);

    await github.poll();

    expect(sendSignal).not.toHaveBeenCalled();
  });

  it('syncs the current thread through polling and pending delivery', async () => {
    const github = new GithubSignals({ repo: 'mastra-ai/mastra' });
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    const poll = vi.spyOn(github, 'poll').mockResolvedValue(undefined);
    const deliverPendingNotifications = vi.spyOn(github, 'deliverPendingNotifications').mockResolvedValue(2);

    const result = await github.syncThread({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });

    expect(result).toEqual({ pendingDelivered: 2 });
    expect(poll).toHaveBeenCalledWith(expect.objectContaining({ repo: 'mastra-ai/mastra', prNumber: 123 }), {
      forceSnapshot: true,
    });
    expect(deliverPendingNotifications).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
      }),
    );
  });

  it('reads and enriches PR comment notifications from the shared LibSQL inbox cache', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const latestCommentUrl = 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1';
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) {
        return {
          stdout: `HTTP/2.0 200 OK\netag: \"etag-1\"\n\n${JSON.stringify([
            {
              ...historicalCodeRabbitCommentNotification,
              id: 'thread-1',
              reason: 'comment',
              updated_at: '2026-01-02T00:00:00.000Z',
              repository: { full_name: 'mastra-ai/mastra' },
              subject: {
                ...historicalCodeRabbitCommentNotification.subject,
                title: 'Fresh PR comment',
                url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
                latest_comment_url: latestCommentUrl,
              },
            },
          ])}`,
        };
      }
      if (args[1] === latestCommentUrl) {
        return {
          stdout: JSON.stringify({
            user: { login: 'coderabbitai[bot]' },
            body: 'A detailed CodeRabbit review comment.',
            html_url: 'https://github.com/mastra-ai/mastra/pull/123#discussion_r1',
          }),
        };
      }
      if (args[1] === 'repos/mastra-ai/mastra/pulls/123') return { stdout: JSON.stringify({ head: { sha: 'sha-1' } }) };
      if (args[1] === 'repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: poller,
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(commandRunner.mock.calls[0]?.[0]).toContain('/notifications');
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: 'A detailed CodeRabbit review comment.',
        attributes: expect.objectContaining({
          type: 'github-comment',
          title: 'Fresh PR comment',
          user: 'coderabbitai[bot]',
          url: 'https://github.com/mastra-ai/mastra/pull/123#discussion_r1',
        }),
      }),
      expect.anything(),
    );
  });

  it('does not emit non-actionable PR inbox notifications without comment details or failed checks', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) {
        return {
          stdout: `HTTP/2.0 200 OK\netag: \"etag-1\"\n\n${JSON.stringify([
            {
              ...historicalGenericAuthorPrNotification,
              updated_at: '2026-01-02T00:00:00.000Z',
              subject: {
                ...historicalGenericAuthorPrNotification.subject,
                url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
              },
            },
            {
              ...historicalRequestChangesReviewThreadNotification,
              updated_at: '2026-01-02T00:00:01.000Z',
              subject: {
                ...historicalRequestChangesReviewThreadNotification.subject,
                url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/124',
              },
            },
          ])}`,
        };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-1' } }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/124') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-2' } }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-2/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: poller,
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 124,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(sendSignal).not.toHaveBeenCalled();
    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 123)).resolves.toMatchObject([
      { id: '23866356138', title: 'ci: run workspace tests from source' },
    ]);
    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 124)).resolves.toMatchObject([
      { id: '23879042032', title: 'feat(mastracode): add /skill:<name> command to activate skills explicitly' },
    ]);
    github.destroy();
  });

  it('does not emit cached comment notifications authored by the current GitHub user', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-05-20T10:00:00.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const latestCommentUrl = 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/4500729873';
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args[1] === 'user') return { stdout: 'TylerBarnes\n' };
      if (args.includes('/notifications')) {
        return {
          stdout: `HTTP/2.0 200 OK\netag: \"etag-1\"\n\n${JSON.stringify([
            {
              ...historicalCodeRabbitCommentNotification,
              id: 'self-comment-thread',
              reason: 'comment',
              updated_at: '2026-05-20T10:00:00.000Z',
              repository: { full_name: 'mastra-ai/mastra' },
              subject: {
                ...historicalCodeRabbitCommentNotification.subject,
                title: 'fix: goal judge maxSteps, retry, resume retrigger, and task auto-demote',
                url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/16843',
                latest_comment_url: latestCommentUrl,
              },
            },
          ])}`,
        };
      }
      if (args[1] === latestCommentUrl) {
        return {
          stdout: JSON.stringify({
            user: { login: 'TylerBarnes' },
            body: 'Thanks for the quick follow-up. I pulled the latest branch and re-verified.',
            html_url: 'https://github.com/mastra-ai/mastra/pull/16843#issuecomment-4500729873',
          }),
        };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/16843') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-1' } }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: poller,
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 16843,
      createdAt: '2026-05-20T09:00:00.000Z',
      updatedAt: '2026-05-20T09:00:00.000Z',
    });

    await github.poll();

    expect(sendSignal).not.toHaveBeenCalled();
    await expect(store.readPrNotifications('account-1', 'mastra-ai/mastra', 16843)).resolves.toMatchObject([
      { id: 'self-comment-thread', commentAuthor: 'TylerBarnes' },
    ]);
    github.destroy();
  });

  it('emits wanted historical comment notifications while filtering generic PR updates', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-05-14T21:14:00.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) {
        return {
          stdout: `HTTP/2.0 200 OK\netag: \"etag-1\"\n\n${JSON.stringify([
            historicalGenericAuthorPrNotification,
            historicalCodeRabbitCommentNotification,
          ])}`,
        };
      }
      if (args[1] === historicalCodeRabbitCommentNotification.subject.latest_comment_url) {
        return {
          stdout: JSON.stringify({
            user: { login: 'coderabbitai[bot]' },
            body: 'Historical CodeRabbit review body.',
            html_url: 'https://github.com/mastra-ai/mastra/pull/16515#discussion_r314159',
          }),
        };
      }
      if (args[1] === 'repos/mastra-ai/mastra/pulls/16515') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-1' } }) };
      }
      if (args[1] === 'repos/mastra-ai/mastra/pulls/16567') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-2' } }) };
      }
      if (args[1] === 'repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      if (args[1] === 'repos/mastra-ai/mastra/commits/sha-2/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: poller,
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 16515,
      createdAt: '2026-05-14T18:00:00.000Z',
      updatedAt: '2026-05-14T18:00:00.000Z',
    });
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 16567,
      createdAt: '2026-05-14T18:00:00.000Z',
      updatedAt: '2026-05-14T18:00:00.000Z',
    });

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: 'Historical CodeRabbit review body.',
        attributes: expect.objectContaining({
          type: 'github-comment',
          pr: 16515,
          title: 'feat(core): add GitHub PR signals',
          user: 'coderabbitai[bot]',
        }),
      }),
      expect.anything(),
    );
    expect((sendSignal.mock.calls as any[])[0]?.[0]).not.toMatchObject({ attributes: { pr: 16567 } });
    github.destroy();
  });

  it('emits CI failures by enriching shared inbox PR notifications', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const pullRequestUrl = 'https://api.github.com/repos/mastra-ai/mastra/pulls/123';
    const checksUrl = 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs';
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) {
        return {
          stdout: `HTTP/2.0 200 OK\netag: \"etag-1\"\n\n${JSON.stringify([
            {
              id: 'thread-1',
              reason: 'ci_activity',
              updated_at: '2026-01-02T00:00:00.000Z',
              repository: { full_name: 'mastra-ai/mastra' },
              subject: {
                title: 'CI updated',
                type: 'PullRequest',
                url: pullRequestUrl,
              },
            },
          ])}`,
        };
      }
      if (args[1] === pullRequestUrl) return { stdout: JSON.stringify({ head: { sha: 'sha-1' } }) };
      if (args[1] === checksUrl) {
        return {
          stdout: JSON.stringify({
            check_runs: [{ name: 'lint', conclusion: 'failure', details_url: 'https://github.com/checks/lint' }],
          }),
        };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: poller,
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(commandRunner.mock.calls.map(call => call[0])).toEqual(
      expect.arrayContaining([expect.arrayContaining(['/notifications']), ['api', pullRequestUrl], ['api', checksUrl]]),
    );
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({ type: 'github-ci-failure', checkCount: 1 }),
        contents: '- lint: failure (https://github.com/checks/lint)',
      }),
      expect.anything(),
    );
    github.destroy();
  });

  it('emits merged and closed PR state notifications from enriched inbox rows', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const blockerStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'merged-thread',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'feat: ship it',
        subjectType: 'PullRequest',
        reason: 'state_change',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-02T00:00:00.000Z',
        prState: 'closed',
        prMerged: true,
        prClosedAt: '2026-01-02T00:00:00.000Z',
        prMergedAt: '2026-01-02T00:00:00.000Z',
        prHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/123',
      },
      {
        id: 'closed-thread',
        repo: 'mastra-ai/mastra',
        prNumber: 124,
        title: 'fix: not today',
        subjectType: 'PullRequest',
        reason: 'state_change',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/124',
        updatedAt: '2026-01-02T00:00:00.000Z',
        prState: 'closed',
        prMerged: false,
        prClosedAt: '2026-01-02T00:00:00.000Z',
        prHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/124',
      },
    ]);
    await blockerStore.acquireMasterLease('account-1', 45_000);
    const commandRunner = vi.fn(async () => {
      throw new Error('non-master should not call GitHub');
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    for (const prNumber of [123, 124]) {
      github.addSubscription({
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber,
        lastNotificationUpdatedAt: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }

    await github.poll();

    expect(commandRunner).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledTimes(2);
    const calls = sendSignal.mock.calls as any[];
    expect(calls[0][0]).toMatchObject({
      attributes: {
        type: 'github-pr-merged',
        kind: 'pr-merged',
        pr: 123,
        url: 'https://github.com/mastra-ai/mastra/pull/123',
      },
    });
    expect(calls[0][0].contents).toContain('PR #123 was merged: feat: ship it');
    expect(calls[0][0].contents).toContain('automatically unsubscribed');
    expect(calls[0][0].contents).toContain('resubscribe with the github tool');
    expect(calls[1][0]).toMatchObject({
      contents: 'PR #124 was closed without merge: fix: not today',
      attributes: {
        type: 'github-pr-closed',
        kind: 'pr-closed',
        pr: 124,
        url: 'https://github.com/mastra-ai/mastra/pull/124',
      },
    });
    github.destroy();
  });

  it('emits cached PR conflict notifications even when the inbox updated_at was already acknowledged', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const blockerStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'conflicted-thread',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'feat: needs merge work',
        subjectType: 'PullRequest',
        reason: 'state_change',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-02T00:00:00.000Z',
        prHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/123',
        prMergeable: false,
        prMergeableState: 'dirty',
        prHeadSha: 'sha-1',
      },
      {
        id: 'unknown-thread',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'feat: still computing',
        subjectType: 'PullRequest',
        reason: 'state_change',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-02T00:00:00.000Z',
        prMergeable: null,
        prMergeableState: 'unknown',
        prHeadSha: 'sha-2',
      },
    ]);
    await blockerStore.acquireMasterLease('account-1', 45_000);
    const commandRunner = vi.fn(async () => {
      throw new Error('non-master should not call GitHub');
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastNotificationUpdatedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    github.markActive({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });
    await github.poll();
    await github.markIdle({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });
    await github.poll();

    expect(commandRunner).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledTimes(2);
    const calls = sendSignal.mock.calls as any[];
    expect(calls[1][0]).toMatchObject({
      contents: 'PR #123 has merge conflicts: feat: needs merge work',
      attributes: {
        type: 'github-pr-conflict',
        kind: 'pr-conflict',
        pr: 123,
        url: 'https://github.com/mastra-ai/mastra/pull/123',
      },
    });
    github.destroy();
  });

  it('emits snapshot PR conflict notifications when no inbox notification changes', async () => {
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: needs merge work',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
      createSnapshot({
        title: 'feat: needs merge work',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
    ]);
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner, now });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();
    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: 'PR #123 has merge conflicts: feat: needs merge work',
        attributes: expect.objectContaining({
          type: 'github-pr-conflict',
          kind: 'pr-conflict',
          pr: 123,
          url: 'https://github.com/mastra-ai/mastra/pull/123',
        }),
      }),
      expect.anything(),
    );
    github.destroy();
  });

  it('emits cached CI failures even when the inbox updated_at was already acknowledged', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const blockerStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'CI updated',
        subjectType: 'PullRequest',
        reason: 'author',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-02T00:00:00.000Z',
        failedChecks: [{ name: 'lint', status: 'failure', url: 'https://github.com/checks/lint' }],
      },
    ]);
    await blockerStore.acquireMasterLease('account-1', 45_000);
    const commandRunner = vi.fn(async () => {
      throw new Error('non-master should not call GitHub');
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastNotificationUpdatedAt: '2026-01-02T00:00:00.000Z',
      lastCheckFingerprint: JSON.stringify([['old check', 'failure']]),
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(commandRunner).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({ type: 'github-ci-failure', checkCount: 1 }),
        contents: '- lint: failure (https://github.com/checks/lint)',
      }),
      expect.anything(),
    );
    github.destroy();
  });

  it('updates cached CI fingerprint when failed checks clear', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const blockerStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'CI updated',
        subjectType: 'PullRequest',
        reason: 'author',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-02T00:00:00.000Z',
        failedChecks: [],
      },
    ]);
    await blockerStore.acquireMasterLease('account-1', 45_000);
    const commandRunner = vi.fn(async () => {
      throw new Error('non-master should not call GitHub');
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    const persistence = { update: vi.fn().mockResolvedValue(undefined) };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        lastNotificationUpdatedAt: '2026-01-02T00:00:00.000Z',
        lastCheckFingerprint: JSON.stringify([['lint', 'failure']]),
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      persistence,
    );

    await github.poll();

    expect(sendSignal).not.toHaveBeenCalled();
    expect(persistence.update).toHaveBeenCalledWith(expect.objectContaining({ lastCheckFingerprint: '[]' }));
    github.destroy();
  });

  it('claims cached notification delivery so concurrent instances do not duplicate a thread signal', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const firstStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const secondStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) {
        return {
          stdout: `HTTP/2.0 200 OK\netag: "etag-1"\n\n${JSON.stringify([
            {
              id: 'thread-1',
              reason: 'comment',
              updated_at: '2026-01-02T00:00:00.000Z',
              repository: { full_name: 'mastra-ai/mastra' },
              subject: {
                title: 'CodeRabbit comment',
                type: 'PullRequest',
                url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
                latest_comment_url: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
              },
            },
          ])}`,
        };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1') {
        return { stdout: JSON.stringify({ user: { login: 'coderabbitai[bot]' }, body: 'CodeRabbit comment' }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-1' } }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-1/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const firstGithub = new GithubSignals({
      pollIntervalMs: 1_000,
      notificationPoller: new GithubNotificationPoller({
        store: firstStore,
        commandRunner,
        accountKey: 'account-1',
        now,
      }),
      now,
    });
    const secondGithub = new GithubSignals({
      pollIntervalMs: 1_000,
      notificationPoller: new GithubNotificationPoller({
        store: secondStore,
        commandRunner,
        accountKey: 'account-1',
        now,
      }),
      now,
    });
    const firstSendSignal = createSendSignalMock();
    const secondSendSignal = createSendSignalMock();
    const subscription = {
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    firstGithub.addAgent({ id: 'agent-1', sendSignal: firstSendSignal } as any);
    secondGithub.addAgent({ id: 'agent-1', sendSignal: secondSendSignal } as any);
    firstGithub.addSubscription(subscription);
    secondGithub.addSubscription(subscription);

    await firstGithub.poll();
    await secondGithub.poll();

    expect(firstSendSignal).toHaveBeenCalledTimes(1);
    expect(secondSendSignal).not.toHaveBeenCalled();
    firstGithub.destroy();
    secondGithub.destroy();
  });

  it('coalesces inbox timestamp bumps for the same latest comment URL', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:03.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const notification = {
      id: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      title: 'CodeRabbit comment',
      reason: 'author',
      subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
      latestCommentUrl: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
      updatedAt: '2026-01-02T00:00:01.000Z',
    };
    await store.upsertNotifications('account-1', [notification]);
    const commandRunner = vi.fn(async () => ({ stdout: `HTTP/2.0 200 OK\n\n[]` }));
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();
    await store.upsertNotifications('account-1', [{ ...notification, updatedAt: '2026-01-02T00:00:02.000Z' }]);
    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    github.destroy();
  });

  it('delivers cached inbox notifications with reused thread IDs and newer timestamps after startup rehydration', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:02.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'CodeRabbit posted a review comment',
        reason: 'author',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        latestCommentUrl: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
        updatedAt: '2026-01-02T00:00:01.000Z',
      },
    ]);
    const commandRunner = vi.fn(async () => ({ stdout: `HTTP/2.0 200 OK\n\n[]` }));
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now });
    const github = new GithubSignals({ pollIntervalMs: 1_000, notificationPoller: poller, now });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    const subscription = {
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastNotificationUpdatedAt: '2026-01-02T00:00:00.000Z',
      seenNotificationIds: ['thread-1'],
    };
    const memory = {
      listThreads: vi.fn(async () => ({
        threads: [
          {
            id: 'thread-1',
            title: 'Thread 1',
            metadata: {
              mastra: {
                githubSignals: {
                  processedSignalIds: [],
                  subscriptions: { 'mastra-ai/mastra:123': subscription },
                },
              },
            },
          },
        ],
        total: 1,
        page: 0,
        perPage: 100,
        hasMore: false,
      })),
      updateThread: vi.fn(async () => undefined),
    };

    await github.init({ memory, resourceId: 'resource-1' });
    await github.poll();

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({ type: 'github-comment', title: 'CodeRabbit posted a review comment' }),
      }),
      expect.anything(),
    );
    github.destroy();
  });

  it('polls the shared inbox once while multiple subscriptions read cached PR rows', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args.includes('/notifications')) {
        return {
          stdout: `HTTP/2.0 200 OK\netag: "etag-1"\n\n${JSON.stringify([
            {
              id: 'thread-123',
              reason: 'comment',
              updated_at: '2026-01-02T00:00:00.000Z',
              repository: { full_name: 'mastra-ai/mastra' },
              subject: {
                title: 'PR 123 comment',
                type: 'PullRequest',
                url: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
                latest_comment_url: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/123',
              },
            },
            {
              id: 'thread-456',
              reason: 'comment',
              updated_at: '2026-01-02T00:00:00.000Z',
              repository: { full_name: 'mastra-ai/mastra' },
              subject: {
                title: 'PR 456 comment',
                type: 'PullRequest',
                url: 'https://api.github.com/repos/mastra-ai/mastra/issues/456',
                latest_comment_url: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/456',
              },
            },
          ])}`,
        };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/123') {
        return { stdout: JSON.stringify({ user: { login: 'reviewer' }, body: 'PR 123 comment' }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/456') {
        return { stdout: JSON.stringify({ user: { login: 'reviewer' }, body: 'PR 456 comment' }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/pulls/123') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-123' } }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/issues/456') {
        return { stdout: JSON.stringify({ head: { sha: 'sha-456' } }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-123/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      if (args[1] === 'https://api.github.com/repos/mastra-ai/mastra/commits/sha-456/check-runs') {
        return { stdout: JSON.stringify({ check_runs: [] }) };
      }
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const poller = new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: poller,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 456,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(commandRunner.mock.calls.filter(call => call[0].includes('/notifications'))).toHaveLength(2);
    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[]).map(call => call[0].attributes.title)).toEqual([
      'PR 123 comment',
      'PR 456 comment',
    ]);
    github.destroy();
  });

  it('emits approval and merge updates from snapshot fallback even without inbox notifications', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-03T00:00:00.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: ship it',
        state: 'closed',
        merged: true,
        closedAt: '2026-01-02T00:02:00.000Z',
        mergedAt: '2026-01-02T00:02:00.000Z',
        reviews: [
          {
            id: 'review-1',
            body: '',
            submittedAt: '2026-01-02T00:01:00.000Z',
            state: 'APPROVED',
            user: { login: 'TylerBarnes' },
            html_url: 'https://github.com/mastra-ai/mastra/pull/123#pullrequestreview-1',
          },
        ],
      }),
    ]);
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastReviewTimestamp: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[0][0]).toMatchObject({
      attributes: { type: 'github-review', kind: 'review', reviewState: 'APPROVED', user: 'TylerBarnes' },
      contents: 'TylerBarnes approved this PR.',
    });
    expect((sendSignal.mock.calls as any[])[1][0]).toMatchObject({
      attributes: { type: 'github-pr-merged', kind: 'pr-merged' },
    });
    expect((sendSignal.mock.calls as any[])[1][0].contents).toContain('PR #123 was merged: feat: ship it');
    expect((sendSignal.mock.calls as any[])[1][0].contents).toContain('automatically unsubscribed');
    github.destroy();
  });

  it('auto-unsubscribes after delivering a merged PR snapshot notification', async () => {
    const onAutoUnsubscribe = vi.fn();
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: ship it',
        state: 'closed',
        merged: true,
        closedAt: '2026-01-02T00:02:00.000Z',
        mergedAt: '2026-01-02T00:02:00.000Z',
      }),
    ]);
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner,
      onAutoUnsubscribe,
    });
    const sendSignal = createSendSignalMock();
    const persistence = { update: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    const subscription = {
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      lastCheckFingerprint: '[]',
    };
    github.addSubscription(subscription, persistence);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        attributes: expect.objectContaining({ type: 'github-pr-merged', kind: 'pr-merged' }),
        contents: expect.stringContaining('automatically unsubscribed'),
      }),
      expect.anything(),
    );
    expect(persistence.remove).toHaveBeenCalledWith(expect.objectContaining({ prNumber: 123 }));
    expect(onAutoUnsubscribe).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    expect(persistence.update).not.toHaveBeenCalledWith(expect.objectContaining({ prNumber: 123 }));
    github.destroy();
  });

  it('defers auto-unsubscribe for queued merged PR notifications until delivery', async () => {
    const onAutoUnsubscribe = vi.fn();
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: ship it',
        state: 'closed',
        merged: true,
        closedAt: '2026-01-02T00:02:00.000Z',
        mergedAt: '2026-01-02T00:02:00.000Z',
      }),
    ]);
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner,
      onAutoUnsubscribe,
    });
    const sendSignal = createSendSignalMock();
    const persistence = { update: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        ...context,
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastCheckFingerprint: '[]',
      },
      persistence,
    );
    github.markActive(context);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(((sendSignal.mock.calls as any[])[0] as any[])?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });
    expect(persistence.remove).not.toHaveBeenCalled();
    expect(persistence.update).not.toHaveBeenCalled();
    expect(onAutoUnsubscribe).not.toHaveBeenCalled();

    const deliveredCount = await github.deliverPendingNotifications(context);

    expect(deliveredCount).toBe(1);
    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect(((sendSignal.mock.calls as any[])[1] as any[])?.[0]).toMatchObject({
      attributes: { type: 'github-pr-merged', kind: 'pr-merged', pr: 123 },
      contents: expect.stringContaining('automatically unsubscribed'),
    });
    expect(persistence.remove).toHaveBeenCalledWith(expect.objectContaining({ prNumber: 123 }));
    expect(onAutoUnsubscribe).toHaveBeenCalledWith({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    github.destroy();
  });

  it('does not queue duplicate merged PR snapshot notifications while active', async () => {
    const onAutoUnsubscribe = vi.fn();
    const mergedSnapshot = createSnapshot({
      title: 'feat: ship it',
      state: 'closed',
      merged: true,
      closedAt: '2026-01-02T00:02:00.000Z',
      mergedAt: '2026-01-02T00:02:00.000Z',
    });
    const commandRunner = createSnapshotCommandRunner([mergedSnapshot, mergedSnapshot]);
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner,
      onAutoUnsubscribe,
    });
    const sendSignal = createSendSignalMock();
    const persistence = { update: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        ...context,
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        lastCheckFingerprint: '[]',
      },
      persistence,
    );
    github.markActive(context);

    await github.poll();
    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(((sendSignal.mock.calls as any[])[0] as any[])?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });

    const deliveredCount = await github.deliverPendingNotifications(context);

    expect(deliveredCount).toBe(1);
    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect(((sendSignal.mock.calls as any[])[1] as any[])?.[0]).toMatchObject({
      attributes: { type: 'github-pr-merged', kind: 'pr-merged', pr: 123 },
    });
    expect(persistence.remove).toHaveBeenCalledTimes(1);
    expect(onAutoUnsubscribe).toHaveBeenCalledTimes(1);
    github.destroy();
  });

  it('does not auto-unsubscribe after a closed-without-merge PR notification', async () => {
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'fix: not today',
        state: 'closed',
        merged: false,
        closedAt: '2026-01-02T00:02:00.000Z',
      }),
    ]);
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const persistence = { update: vi.fn(async () => {}), remove: vi.fn(async () => {}) };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      persistence,
    );

    await github.poll();

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: expect.objectContaining({ type: 'github-pr-closed' }) }),
      expect.anything(),
    );
    expect(persistence.remove).not.toHaveBeenCalled();
    expect(persistence.update).toHaveBeenCalledWith(expect.objectContaining({ prNumber: 123 }));
    github.destroy();
  });

  it('persists a subscription, baselines existing activity, and starts idle polling', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        failedChecks: [{ name: 'lint', conclusion: 'FAILURE' }],
        comments: [{ id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' }],
        reviews: [{ id: 'review-1', body: 'old review', submittedAt: '2026-01-02T00:01:00.000Z' }],
      }),
    ]);
    const harness = createHarness();
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);

    const signal = ghSignals.prSubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    await processSignals(github, harness, [signal]);

    const metadata = (harness.thread.metadata as any).mastra.githubSignals;
    expect(metadata.processedSignalIds).toEqual([signal.id]);
    expect(metadata.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCheckFingerprint: JSON.stringify([['lint', 'FAILURE']]),
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      lastReviewTimestamp: '2026-01-02T00:01:00.000Z',
    });
    expect(sendSignal).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);

    github.destroy();
    vi.useRealTimers();
  });

  it('filters snapshot comments authored by the current GitHub user', async () => {
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'my own comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'TylerBarnes' },
            },
            {
              id: 'comment-2',
              body: 'reviewer comment',
              createdAt: '2026-01-02T00:02:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    commandRunner.mockImplementation(async (args: string[]) => {
      if (args[0] === 'api' && args[1] === 'user') return { stdout: 'TylerBarnes\n' };
      return createSnapshotCommandRunner(
        [
          createSnapshot({
            comments: [
              {
                id: 'comment-1',
                body: 'my own comment',
                createdAt: '2026-01-02T00:01:00.000Z',
                author: { login: 'TylerBarnes' },
              },
              {
                id: 'comment-2',
                body: 'reviewer comment',
                createdAt: '2026-01-02T00:02:00.000Z',
                author: { login: 'reviewer' },
              },
            ],
          }),
        ],
        { reviewer: 'write' },
      )(args);
    });
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      lastCheckFingerprint: '[]',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls as any[])[0]?.[0]).toMatchObject({
      contents: 'reviewer comment',
      attributes: { type: 'github-comment', user: 'reviewer' },
    });
    github.destroy();
  });

  it('delivers updated snapshot comments only when the body changes', async () => {
    const snapshotRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'I am going to review now',
              createdAt: '2026-01-02T00:01:00.000Z',
              updatedAt: '2026-01-02T00:02:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'I am going to review now',
              createdAt: '2026-01-02T00:01:00.000Z',
              updatedAt: '2026-01-02T00:03:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'Review complete: found one issue',
              createdAt: '2026-01-02T00:01:00.000Z',
              updatedAt: '2026-01-02T00:04:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args[0] === 'api' && args[1] === 'user') return { stdout: 'TylerBarnes\n' };
      return snapshotRunner(args);
    });
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();
    await github.poll();
    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[0]?.[0]).toMatchObject({
      contents: 'I am going to review now',
      attributes: { type: 'github-comment', user: 'reviewer' },
    });
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      contents: 'Updated comment:\n\nReview complete: found one issue',
      attributes: { type: 'github-comment', title: 'Updated GitHub comment', user: 'reviewer' },
    });
    github.destroy();
  });

  it('defers snapshot comment acknowledgement until queued delivery', async () => {
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'queued snapshot comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              updatedAt: '2026-01-02T00:01:30.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    const persistence = { update: vi.fn(async () => {}) };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        ...context,
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      persistence,
    );
    github.markActive(context);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls as any[])[0]?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });
    expect(persistence.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        lastCommentTimestamp: '2026-01-02T00:01:00.000Z',
        lastCommentFingerprints: expect.any(Object),
      }),
    );

    const deliveredCount = await github.deliverPendingNotifications(context);

    expect(deliveredCount).toBe(1);
    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      contents: 'queued snapshot comment',
      attributes: { type: 'github-comment', user: 'reviewer' },
    });
    expect(persistence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        lastCommentTimestamp: '2026-01-02T00:01:00.000Z',
        lastCommentFingerprints: {
          'comment-1': expect.objectContaining({ updatedAt: '2026-01-02T00:01:30.000Z' }),
        },
      }),
    );
    github.destroy();
  });

  it('defers updated snapshot comment fingerprint acknowledgement until queued delivery', async () => {
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'Review complete: found one issue',
              createdAt: '2026-01-02T00:01:00.000Z',
              updatedAt: '2026-01-02T00:04:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    const persistence = { update: vi.fn(async () => {}) };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        ...context,
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        lastCommentTimestamp: '2026-01-02T00:01:00.000Z',
        lastCommentFingerprints: {
          'comment-1': { updatedAt: '2026-01-02T00:02:00.000Z', bodyFingerprint: 'old-body' },
        },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      persistence,
    );
    github.markActive(context);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(persistence.update).not.toHaveBeenCalledWith(
      expect.objectContaining({
        lastCommentFingerprints: {
          'comment-1': expect.objectContaining({ updatedAt: '2026-01-02T00:04:00.000Z' }),
        },
      }),
    );

    await github.deliverPendingNotifications(context);

    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      contents: 'Updated comment:\n\nReview complete: found one issue',
      attributes: { type: 'github-comment', title: 'Updated GitHub comment', user: 'reviewer' },
    });
    expect(persistence.update).toHaveBeenCalledWith(
      expect.objectContaining({
        lastCommentFingerprints: {
          'comment-1': expect.objectContaining({ updatedAt: '2026-01-02T00:04:00.000Z' }),
        },
      }),
    );
    github.destroy();
  });

  it('defers snapshot review acknowledgement until queued delivery', async () => {
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          reviews: [
            {
              id: 'review-1',
              body: 'Looks good',
              submittedAt: '2026-01-02T00:03:00.000Z',
              state: 'APPROVED',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    const persistence = { update: vi.fn(async () => {}) };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        ...context,
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        lastReviewTimestamp: '2026-01-02T00:00:00.000Z',
        lastCheckFingerprint: '[]',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      persistence,
    );
    github.markActive(context);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(persistence.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastReviewTimestamp: '2026-01-02T00:03:00.000Z' }),
    );

    await github.deliverPendingNotifications(context);

    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      attributes: { type: 'github-review', reviewState: 'APPROVED', user: 'reviewer' },
    });
    expect(persistence.update).toHaveBeenCalledWith(
      expect.objectContaining({ lastReviewTimestamp: '2026-01-02T00:03:00.000Z' }),
    );
    github.destroy();
  });

  it('detects a queued snapshot comment again after restart when it was not acknowledged', async () => {
    const snapshot = createSnapshot({
      comments: [
        {
          id: 'comment-1',
          body: 'durable queued comment',
          createdAt: '2026-01-02T00:01:00.000Z',
          updatedAt: '2026-01-02T00:01:30.000Z',
          author: { login: 'reviewer' },
        },
      ],
    });
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    const baseSubscription = {
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const firstGithub = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner: createSnapshotCommandRunner([snapshot], { reviewer: 'write' }),
    });
    firstGithub.addAgent({ id: 'agent-1', sendSignal: createSendSignalMock() } as any);
    firstGithub.addSubscription(baseSubscription);
    firstGithub.markActive(context);

    await firstGithub.poll();
    firstGithub.destroy();

    const sendSignal = createSendSignalMock();
    const restartedGithub = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner: createSnapshotCommandRunner([snapshot], { reviewer: 'write' }),
    });
    restartedGithub.addAgent({ id: 'agent-1', sendSignal } as any);
    restartedGithub.addSubscription(baseSubscription);

    await restartedGithub.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls as any[])[0]?.[0]).toMatchObject({
      contents: 'durable queued comment',
      attributes: { type: 'github-comment', user: 'reviewer' },
    });
    restartedGithub.destroy();
  });

  it('polls subscribed idle threads on the interval after startup', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'new startup comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await vi.advanceTimersByTimeAsync(1_000);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [notification] = (sendSignal.mock.calls as any[])[0] as any[];
    expect(notification).toMatchObject({
      contents: 'new startup comment',
      attributes: { type: 'github-comment', user: 'reviewer', pr: 123 },
    });
    github.destroy();
    vi.useRealTimers();
  });

  it('processor delivers pending notifications after output result marks the thread idle', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'active comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const harness = createHarness();
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await processSignals(github, harness, []);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls as any[])[0]?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });

    await processOutputResult(github, harness, []);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    await vi.runOnlyPendingTimersAsync();
    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      contents: 'active comment',
      attributes: { type: 'github-comment', user: 'reviewer', pr: 123 },
    });
    github.destroy();
    vi.useRealTimers();
  });

  it('does not poll on every idle transition within the poll interval', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    const commandRunner = createSnapshotCommandRunner([createSnapshot(), createSnapshot()]);
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.markIdle(context);
    expect(commandRunner).toHaveBeenCalledTimes(4);

    await github.markIdle(context);
    expect(commandRunner).toHaveBeenCalledTimes(4);

    await vi.advanceTimersByTimeAsync(1_000);
    await github.markIdle(context);
    expect(commandRunner).toHaveBeenCalledTimes(8);
    github.destroy();
  });

  it('does not treat blocked merge state as a merge conflict', async () => {
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: needs main',
        mergeable: true,
        mergeableState: 'blocked',
        headSha: 'sha-blocked',
      }),
    ]);
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastMergeConflictFingerprint: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(sendSignal).not.toHaveBeenCalledWith(
      expect.objectContaining({ attributes: expect.objectContaining({ type: 'github-pr-conflict' }) }),
      expect.anything(),
    );
    expect(sendSignal).not.toHaveBeenCalled();
    github.destroy();
  });

  it('emits merge conflict notifications from a shared cached PR snapshot without per-process fallback API calls', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertPrSnapshot('account-1', {
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      title: 'Cached PR',
      url: 'https://github.com/mastra-ai/mastra/pull/123',
      state: 'open',
      merged: false,
      mergeable: false,
      mergeableState: 'dirty',
      headSha: 'sha-conflict',
      failedChecks: [],
      reviews: [],
      checkedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    await new GithubNotificationStore({ client: createClient({ url: dbUrl }), now }).acquireMasterLease(
      'account-1',
      45_000,
    );
    const commandRunner = vi.fn(async (args: string[]) => {
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      snapshotPollIntervalMs: 15 * 60_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastMergeConflictFingerprint: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(commandRunner).not.toHaveBeenCalled();
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: expect.objectContaining({ type: 'github-pr-conflict', pr: 123 }) }),
      expect.anything(),
    );
    github.destroy();
  });

  it('refreshes PR state and checks before the heavy review interval expires', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const currentTime = Date.parse('2026-01-02T00:04:00.000Z');
    const now = () => new Date(currentTime);
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertPrSnapshot('account-1', {
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      title: 'Cached PR',
      url: 'https://github.com/mastra-ai/mastra/pull/123',
      state: 'open',
      merged: false,
      mergeable: true,
      mergeableState: 'clean',
      headSha: 'sha-conflict',
      failedChecks: [{ name: 'old-check', status: 'failure', url: 'https://checks/old' }],
      reviews: [{ id: '1', author: 'coderabbitai[bot]', state: 'COMMENTED' }],
      checkedAt: '2026-01-02T00:00:00.000Z',
      heavyCheckedAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: needs merge work',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
    ]);
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      prStatePollIntervalMs: 3 * 60_000,
      snapshotPollIntervalMs: 15 * 60_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastMergeConflictFingerprint: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();

    expect(commandRunner.mock.calls.filter(call => call[0][1] === 'repos/mastra-ai/mastra/pulls/123')).toHaveLength(1);
    expect(
      commandRunner.mock.calls.filter(call => call[0][1] === 'repos/mastra-ai/mastra/pulls/123/reviews'),
    ).toHaveLength(0);
    expect(
      commandRunner.mock.calls.filter(call => call[0][1] === 'repos/mastra-ai/mastra/commits/sha-conflict/check-runs'),
    ).toHaveLength(1);
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({ attributes: expect.objectContaining({ type: 'github-pr-conflict', pr: 123 }) }),
      expect.anything(),
    );
    github.destroy();
  });

  it('emits real conflicts from the shared-inbox snapshot fallback when no inbox row changes', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: needs merge work',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
    ]);
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastMergeConflictFingerprint: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();
    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: 'PR #123 has merge conflicts: feat: needs merge work',
        attributes: expect.objectContaining({ type: 'github-pr-conflict', kind: 'pr-conflict', pr: 123 }),
      }),
      expect.anything(),
    );
    github.destroy();
  });

  it('queues shared-inbox snapshot conflict notifications while active and drains them after output', async () => {
    vi.useFakeTimers();
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: needs merge work',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
    ]);
    const harness = createHarness();
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastMergeConflictFingerprint: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    await processSignals(github, harness, []);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls as any[])[0]?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });

    await processOutputResult(github, harness, []);
    await vi.runOnlyPendingTimersAsync();

    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      contents: 'PR #123 has merge conflicts: feat: needs merge work',
      attributes: { type: 'github-pr-conflict', kind: 'pr-conflict', pr: 123 },
    });
    github.destroy();
    vi.useRealTimers();
  });

  it('polls active threads on the interval and queues full notifications behind a pending reminder', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'active comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.markActive(context);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [pendingReminder, target] = (sendSignal.mock.calls as any[])[0] as any[];
    expect(pendingReminder).toMatchObject({
      type: 'system-reminder',
      contents:
        '1 new GitHub notification is pending. If you\'re busy, keep working; when you\'re done, call the github tool with action: "pending" to review them.',
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });
    expect(target).toMatchObject({ ifActive: { behavior: 'persist' }, ifIdle: { behavior: 'persist' } });

    await github.markIdle(context);
    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      contents: 'active comment',
      attributes: { type: 'github-comment', user: 'reviewer', pr: 123 },
    });
    github.destroy();
    vi.useRealTimers();
  });

  it('does not acknowledge active-thread CI failures until the queued notification is delivered', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        failedChecks: [
          { name: 'Validate build outputs', conclusion: 'failure', detailsUrl: 'https://checks.example/fail' },
        ],
      }),
    ]);
    const harness = createHarness();
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    const persistence = { update: vi.fn(async () => {}) };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        ...context,
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        lastCheckFingerprint: '[]',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      persistence,
    );
    github.markActive(context);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [pendingReminder] = (sendSignal.mock.calls as any[])[0] as any[];
    expect(pendingReminder).toMatchObject({
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });
    expect(persistence.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ lastCheckFingerprint: JSON.stringify([['Validate build outputs', 'failure']]) }),
    );

    const result = await processSignals(github, harness, []);
    const toolResult = await (result?.tools?.github as any).execute({ action: 'pending' });

    expect(toolResult).toEqual({ success: true, message: 'notifications will now be delivered' });
    await vi.advanceTimersByTimeAsync(0);
    expect(sendSignal).toHaveBeenCalledTimes(2);
    const [notification] = (sendSignal.mock.calls as any[])[1] as any[];
    expect(notification).toMatchObject({
      contents: '- Validate build outputs: failure (https://checks.example/fail)',
      attributes: { type: 'github-ci-failure', pr: 123, checkCount: 1, url: 'https://checks.example/fail' },
    });
    expect(persistence.update).toHaveBeenCalledWith(
      expect.objectContaining({ lastCheckFingerprint: JSON.stringify([['Validate build outputs', 'failure']]) }),
    );
    github.destroy();
    vi.useRealTimers();
  });

  it('claims queued cached comment delivery only after the pending notification is delivered', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const blockerStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'comment-thread',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'CodeRabbit comment',
        subjectType: 'PullRequest',
        reason: 'comment',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        latestCommentUrl: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
        updatedAt: '2026-01-02T00:00:00.000Z',
        commentAuthor: 'coderabbitai[bot]',
        commentBody: 'queued cached comment',
        commentHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/123#discussion_r1',
      },
    ]);
    await blockerStore.acquireMasterLease('account-1', 45_000);
    const claimDelivery = vi.spyOn(store, 'claimNotificationDelivery');
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args[0] === 'api' && args[1] === 'user') return { stdout: 'TylerBarnes\n' };
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.markActive(context);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls as any[])[0]?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });
    expect(claimDelivery).not.toHaveBeenCalled();

    await github.deliverPendingNotifications(context);

    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      contents: 'queued cached comment',
      attributes: { type: 'github-comment', pr: 123 },
    });
    expect(claimDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: 'comment-thread',
        notificationUpdatedAt: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
      }),
    );
    github.destroy();
  });

  it('skips queued cached notifications that were already claimed before pending delivery', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const blockerStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'comment-thread',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'CodeRabbit comment',
        subjectType: 'PullRequest',
        reason: 'comment',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        latestCommentUrl: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
        updatedAt: '2026-01-02T00:00:00.000Z',
        commentAuthor: 'coderabbitai[bot]',
        commentBody: 'already delivered comment',
        commentHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/123#discussion_r1',
      },
    ]);
    await blockerStore.acquireMasterLease('account-1', 45_000);
    const commandRunner = vi.fn(async (args: string[]) => {
      if (args[0] === 'api' && args[1] === 'user') return { stdout: 'TylerBarnes\n' };
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.markActive(context);

    await github.poll();
    await store.claimNotificationDelivery({
      accountKey: 'account-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      notificationId: 'comment-thread',
      notificationUpdatedAt: 'https://api.github.com/repos/mastra-ai/mastra/issues/comments/1',
    });

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls as any[])[0]?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });

    await github.deliverPendingNotifications(context);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    github.destroy();
  });

  it('claims queued cached PR state delivery only after the pending notification is delivered', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const blockerStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'merged-thread',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'feat: ship it',
        subjectType: 'PullRequest',
        reason: 'state_change',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-02T00:00:00.000Z',
        prState: 'closed',
        prMerged: true,
        prClosedAt: '2026-01-02T00:00:00.000Z',
        prMergedAt: '2026-01-02T00:00:00.000Z',
        prHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/123',
      },
    ]);
    await blockerStore.acquireMasterLease('account-1', 45_000);
    const claimDelivery = vi.spyOn(store, 'claimNotificationDelivery');
    const commandRunner = vi.fn(async (args: string[]) => {
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastNotificationUpdatedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.markActive(context);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(claimDelivery).not.toHaveBeenCalled();

    await github.deliverPendingNotifications(context);

    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      attributes: { type: 'github-pr-merged', pr: 123 },
    });
    expect((sendSignal.mock.calls as any[])[1]?.[0].contents).toContain('PR #123 was merged: feat: ship it');
    expect((sendSignal.mock.calls as any[])[1]?.[0].contents).toContain('automatically unsubscribed');
    expect(claimDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: 'merged-thread',
        notificationUpdatedAt: 'pr-state:merged:2026-01-02T00:00:00.000Z',
      }),
    );
    github.destroy();
  });

  it('claims queued cached PR conflict delivery only after the pending notification is delivered', async () => {
    const dbUrl = `file:${join(mkdtempSync(join(tmpdir(), 'github-signals-cache-')), 'cache.db')}`;
    const now = () => new Date('2026-01-02T00:00:01.000Z');
    const store = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    const blockerStore = new GithubNotificationStore({ client: createClient({ url: dbUrl }), now });
    await store.upsertNotifications('account-1', [
      {
        id: 'conflicted-thread',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        title: 'feat: needs merge work',
        subjectType: 'PullRequest',
        reason: 'state_change',
        subjectUrl: 'https://api.github.com/repos/mastra-ai/mastra/pulls/123',
        updatedAt: '2026-01-02T00:00:00.000Z',
        prHtmlUrl: 'https://github.com/mastra-ai/mastra/pull/123',
        prMergeable: false,
        prMergeableState: 'dirty',
        prHeadSha: 'sha-1',
      },
    ]);
    await blockerStore.acquireMasterLease('account-1', 45_000);
    const claimDelivery = vi.spyOn(store, 'claimNotificationDelivery');
    const commandRunner = vi.fn(async (args: string[]) => {
      throw new Error(`Unexpected command: ${args.join(' ')}`);
    });
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      notificationPoller: new GithubNotificationPoller({ store, commandRunner, accountKey: 'account-1', now }),
      commandRunner,
      now,
    });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastNotificationUpdatedAt: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.markActive(context);

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(claimDelivery).not.toHaveBeenCalled();

    await github.deliverPendingNotifications(context);

    expect(sendSignal).toHaveBeenCalledTimes(2);
    expect((sendSignal.mock.calls as any[])[1]?.[0]).toMatchObject({
      contents: 'PR #123 has merge conflicts: feat: needs merge work',
      attributes: { type: 'github-pr-conflict', pr: 123 },
    });
    expect(claimDelivery).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationId: 'conflicted-thread',
        notificationUpdatedAt: 'pr-conflict:dirty:sha-1',
      }),
    );
    github.destroy();
  });

  it('delivers queued notifications from the github pending tool', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'queued comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const harness = createHarness();
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.markActive(context);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendSignal).toHaveBeenCalledTimes(1);

    const result = await processSignals(github, harness, []);
    const toolResult = await (result?.tools?.github as any).execute({ action: 'pending' });

    expect(toolResult).toEqual({ success: true, message: 'notifications will now be delivered' });
    expect(sendSignal).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(0);
    expect(sendSignal).toHaveBeenCalledTimes(2);
    const [notification] = (sendSignal.mock.calls as any[])[1] as any[];
    expect(notification).toMatchObject({
      contents: 'queued comment',
      attributes: { type: 'github-comment', user: 'reviewer', pr: 123 },
    });
    github.destroy();
    vi.useRealTimers();
  });

  it('returns a clear message when no pending notifications are queued', async () => {
    const harness = createHarness();
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra' });
    const result = await processSignals(github, harness, []);

    await expect((result?.tools?.github as any).execute({ action: 'pending' })).resolves.toEqual({
      success: true,
      message: 'No pending GitHub notifications.',
    });
    github.destroy();
  });

  it('filters pending delivery by PR number', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'first queued comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
        createSnapshot({
          comments: [
            {
              id: 'comment-2',
              body: 'second queued comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const harness = createHarness();
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    for (const prNumber of [123, 456]) {
      github.addSubscription({
        ...context,
        repo: 'mastra-ai/mastra',
        prNumber,
        lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      });
    }
    github.markActive(context);

    await github.poll();
    expect(sendSignal).toHaveBeenCalledTimes(2);

    const result = await processSignals(github, harness, []);
    const toolResult = await (result?.tools?.github as any).execute({ action: 'pending', prNumber: 456 });

    expect(toolResult).toEqual({ success: true, message: 'notifications will now be delivered' });
    expect(sendSignal).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(0);
    expect(sendSignal).toHaveBeenCalledTimes(3);
    const [notification] = (sendSignal.mock.calls as any[])[2] as any[];
    expect(notification).toMatchObject({ contents: 'second queued comment', attributes: { pr: 456 } });
    github.destroy();
    vi.useRealTimers();
  });

  it('flushes pending notifications after the pending flush timeout', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T00:00:00.000Z'));
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'flushed comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      pendingFlushMs: 5 * 60_000,
      repo: 'mastra-ai/mastra',
      commandRunner,
    });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.markActive(context);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendSignal).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(sendSignal).toHaveBeenCalledTimes(2);
    const [notification] = (sendSignal.mock.calls as any[])[1] as any[];
    expect(notification).toMatchObject({ contents: 'flushed comment', attributes: { type: 'github-comment' } });
    github.destroy();
    vi.useRealTimers();
  });

  it('clears queued pending notifications when unsubscribing', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'cleared comment',
              createdAt: '2026-01-02T00:01:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      ...context,
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    github.markActive(context);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    github.removeSubscription({ ...context, repo: 'mastra-ai/mastra', prNumber: 123 });

    await github.deliverPendingNotifications(context);
    await vi.advanceTimersByTimeAsync(0);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    github.destroy();
    vi.useRealTimers();
  });

  it('does not silently baseline real conflicts for existing persisted subscriptions on startup', async () => {
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        title: 'feat: needs merge work',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
      createSnapshot({
        title: 'feat: needs merge work',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
    ]);
    const github = new GithubSignals({ pollIntervalMs: 1_000, commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    const subscription = {
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const memory = {
      listThreads: vi.fn(async () => ({
        threads: [
          {
            id: 'thread-1',
            title: 'Thread 1',
            metadata: {
              mastra: {
                githubSignals: {
                  processedSignalIds: [],
                  subscriptions: { 'mastra-ai/mastra:123': subscription },
                },
              },
            },
          },
        ],
        total: 1,
        page: 0,
        perPage: 100,
        hasMore: false,
      })),
      updateThread: vi.fn(async () => undefined),
    };

    await github.init({ memory, resourceId: 'resource-1' });
    await github.poll();

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: 'PR #123 has merge conflicts: feat: needs merge work',
        attributes: expect.objectContaining({ type: 'github-pr-conflict', kind: 'pr-conflict', pr: 123 }),
      }),
      expect.anything(),
    );
    github.destroy();
  });

  it('rehydrates persisted subscriptions with a silent startup baseline', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        failedChecks: [{ name: 'lint', conclusion: 'FAILURE' }],
        comments: [{ id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' }],
        reviews: [{ id: 'review-1', body: 'old review', submittedAt: '2026-01-02T00:01:00.000Z' }],
      }),
    ]);
    const github = new GithubSignals({ pollIntervalMs: 1_000, commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    const subscription = {
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const memory = {
      listThreads: vi.fn(async () => ({
        threads: [
          {
            id: 'thread-1',
            title: 'Thread 1',
            metadata: {
              mastra: {
                githubSignals: {
                  processedSignalIds: [],
                  subscriptions: { 'mastra-ai/mastra:123': subscription },
                },
              },
            },
          },
        ],
        total: 1,
        page: 0,
        perPage: 100,
        hasMore: false,
      })),
      updateThread: vi.fn(async () => undefined),
    };

    const subscriptions = await github.init({ memory, resourceId: 'resource-1' });
    await github.poll();

    expect(memory.listThreads).toHaveBeenCalledWith({ page: 0, perPage: 100, filter: { resourceId: 'resource-1' } });
    expect(subscriptions).toEqual([
      expect.objectContaining({
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        createdAt: '2026-01-01T00:00:00.000Z',
        lastCheckFingerprint: JSON.stringify([['lint', 'FAILURE']]),
        lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
        lastReviewTimestamp: '2026-01-02T00:01:00.000Z',
      }),
    ]);
    expect(memory.updateThread).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'thread-1',
        title: 'Thread 1',
        metadata: expect.objectContaining({ mastra: expect.any(Object) }),
      }),
    );
    expect(sendSignal).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(1);
    github.destroy();
    vi.useRealTimers();
  });

  it('rehydrates only the requested current thread when a threadId is provided', async () => {
    const commandRunner = createSnapshotCommandRunner([createSnapshot()]);
    const github = new GithubSignals({ commandRunner });
    github.addAgent({ id: 'agent-1', sendSignal: createSendSignalMock() } as any);
    const subscription = {
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const memory = {
      getThreadById: vi.fn(async () => ({
        id: 'thread-1',
        title: 'Thread 1',
        metadata: {
          mastra: {
            githubSignals: {
              processedSignalIds: [],
              subscriptions: { 'mastra-ai/mastra:123': subscription },
            },
          },
        },
      })),
      listThreads: vi.fn(async () => {
        throw new Error('init should not scan every thread when threadId is provided');
      }),
      updateThread: vi.fn(async () => undefined),
    };

    const subscriptions = await github.init({ memory, resourceId: 'resource-1', threadId: 'thread-1' });

    expect(memory.getThreadById).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(memory.listThreads).not.toHaveBeenCalled();
    expect(subscriptions).toEqual([expect.objectContaining({ threadId: 'thread-1', prNumber: 123 })]);
    github.destroy();
  });

  it('dedupes processed subscribe signals', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner: createSnapshotCommandRunner([createSnapshot()]),
    });
    github.addAgent({ id: 'agent-1', sendSignal: createSendSignalMock() } as any);
    const signal = ghSignals.prSubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    await processSignals(github, harness, [signal]);
    await processSignals(github, harness, [signal]);

    expect(harness.memory.updateThread).toHaveBeenCalledTimes(1);
    github.destroy();
    vi.useRealTimers();
  });

  it('removes a subscription from an unsubscribe signal and stops polling', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner: createSnapshotCommandRunner([createSnapshot()]),
    });
    github.addAgent({ id: 'agent-1', sendSignal: createSendSignalMock() } as any);
    const subscribe = ghSignals.prSubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });
    const unsubscribe = ghSignals.prUnsubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    await processSignals(github, harness, [subscribe]);
    (harness.thread.metadata as any).mastra.githubSignals.subscriptionHintShown = true;
    expect(vi.getTimerCount()).toBe(1);
    await processSignals(github, harness, [subscribe, unsubscribe]);

    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions).toEqual({});
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptionHintShown).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('activates subscriptions immediately when the github tool sends a signal', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner: createSnapshotCommandRunner([
        createSnapshot({
          title: 'feat: ship it',
          reviews: [
            {
              id: 'review-1',
              state: 'APPROVED',
              submittedAt: '2026-01-02T00:01:00.000Z',
              user: { login: 'TylerBarnes' },
            },
          ],
          failedChecks: [{ name: 'lint', conclusion: 'failure' }],
        }),
      ]),
    });
    github.addAgent({ id: 'agent-1', sendSignal: createSendSignalMock() } as any);
    const sendSignal = vi.fn(async signal => signal);

    const result = await processSignals(github, harness, [], { sendSignal });
    await (result?.tools?.github as any).execute({ action: 'subscribe', prNumber: 123 });

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system-reminder',
        contents: expect.stringContaining('Latest review: APPROVED by TylerBarnes'),
        attributes: expect.objectContaining({ type: 'github-pr-subscribe' }),
        metadata: expect.objectContaining({ summary: expect.stringContaining('CI: 1 failed: lint') }),
      }),
    );
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    expect(vi.getTimerCount()).toBe(1);

    await (result?.tools?.github as any).execute({ action: 'unsubscribe', prNumber: 123 });
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions).toEqual({});
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('falls back to agent sendSignal so subscribe tool updates live TUI subscribers', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner: createSnapshotCommandRunner([createSnapshot()]),
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);

    const result = await processSignals(github, harness, []);
    await (result?.tools?.github as any).execute({ action: 'subscribe', prNumber: 123 });

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system-reminder',
        attributes: expect.objectContaining({ type: 'github-pr-subscribe', prNumber: 123 }),
      }),
      expect.objectContaining({
        resourceId: 'resource-1',
        threadId: 'thread-1',
        ifActive: { behavior: 'deliver' },
        ifIdle: { behavior: 'persist' },
      }),
    );
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      prNumber: 123,
    });
    vi.useRealTimers();
  });

  it('emits one compact notification for failing checks and dedupes repeated polls', async () => {
    vi.useFakeTimers();
    const commandRunner = createSnapshotCommandRunner([
      createSnapshot({
        failedChecks: [{ name: 'unit tests', conclusion: 'FAILURE', detailsUrl: 'https://example.com/check' }],
      }),
    ]);
    const getStreamOptions = vi.fn(async () => ({
      requestContext: new RequestContext(),
      memory: { resource: 'resource-1', thread: 'thread-1' },
      maxSteps: 1000,
    }));
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any, { getStreamOptions });
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();
    await github.poll();

    expect(commandRunner).toHaveBeenCalledWith(['api', 'repos/mastra-ai/mastra/pulls/123']);
    expect(commandRunner).toHaveBeenCalledWith([
      'api',
      'repos/mastra-ai/mastra/issues/123/comments',
      '--paginate',
      '--slurp',
    ]);
    expect(commandRunner).toHaveBeenCalledWith([
      'api',
      'repos/mastra-ai/mastra/pulls/123/reviews',
      '--paginate',
      '--slurp',
    ]);
    expect(commandRunner).toHaveBeenCalledWith(['api', 'repos/mastra-ai/mastra/commits/sha-1/check-runs']);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(getStreamOptions).toHaveBeenCalledWith({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    const [notification, target] = (sendSignal.mock.calls as any[])[0] as any[];
    expect(notification).toMatchObject({
      type: 'system-reminder',
      contents: '- unit tests: FAILURE (https://example.com/check)',
      attributes: {
        type: 'github-ci-failure',
        kind: 'ci-failure',
        pr: 123,
        repo: 'mastra-ai/mastra',
        checkCount: 1,
      },
    });
    expect(target).toMatchObject({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      ifIdle: {
        behavior: 'wake',
        streamOptions: {
          memory: { resource: 'resource-1', thread: 'thread-1' },
          maxSteps: 1000,
        },
      },
      ifActive: { behavior: 'deliver' },
    });

    github.destroy();
    vi.useRealTimers();
  });

  it('persists polling watermarks back to thread metadata', async () => {
    const snapshots = [
      createSnapshot({
        comments: [{ id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' }],
      }),
      createSnapshot({
        comments: [
          { id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' },
          {
            id: 'comment-2',
            body: 'new comment',
            createdAt: '2026-01-02T00:02:00.000Z',
            author: { login: 'reviewer' },
          },
        ],
      }),
    ];
    const commandRunner = createSnapshotCommandRunner(snapshots, { reviewer: 'write' });
    const harness = createHarness();
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    const signal = ghSignals.prSubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    await processSignals(github, harness, [signal]);
    await github.markIdle({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });

    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      lastCommentTimestamp: '2026-01-02T00:02:00.000Z',
    });
    expect(harness.memory.updateThread).toHaveBeenCalledTimes(3);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    github.destroy();
  });

  it('baselines existing activity on subscribe and only emits future comments and reviews from authorized users', async () => {
    const snapshots = [
      createSnapshot({
        comments: [{ id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' }],
        reviews: [{ id: 'review-1', body: 'old review', submittedAt: '2026-01-02T00:01:00.000Z' }],
      }),
      createSnapshot({
        comments: [
          { id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' },
          {
            id: 'comment-2',
            body: 'Please fix this',
            createdAt: '2026-01-02T00:02:00.000Z',
            author: { login: 'reviewer' },
            url: 'https://example.com/comment',
          },
        ],
        reviews: [
          { id: 'review-1', body: 'old review', submittedAt: '2026-01-02T00:01:00.000Z' },
          {
            id: 'review-2',
            body: 'Requested changes',
            submittedAt: '2026-01-02T00:03:00.000Z',
            author: { login: 'reviewer' },
            state: 'CHANGES_REQUESTED',
            url: 'https://example.com/review',
          },
        ],
      }),
    ];
    const commandRunner = createSnapshotCommandRunner(snapshots, { reviewer: 'write' });
    const harness = createHarness();
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    const signal = ghSignals.prSubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    await processSignals(github, harness, [signal]);
    expect(sendSignal).not.toHaveBeenCalled();

    await github.markIdle({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });

    expect(sendSignal).toHaveBeenCalledTimes(2);
    const [commentNotification] = (sendSignal.mock.calls as any[])[0] as any[];
    const [reviewNotification] = (sendSignal.mock.calls as any[])[1] as any[];
    expect(commentNotification).toMatchObject({
      contents: 'Please fix this',
      attributes: { type: 'github-comment', user: 'reviewer', pr: 123 },
    });
    expect(reviewNotification).toMatchObject({
      contents: 'Requested changes',
      attributes: { type: 'github-review', user: 'reviewer', reviewState: 'CHANGES_REQUESTED', pr: 123 },
    });
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      lastCommentTimestamp: '2026-01-02T00:02:00.000Z',
      lastReviewTimestamp: '2026-01-02T00:03:00.000Z',
    });
    github.destroy();
  });

  it('silently baselines existing conflicts on fresh subscribe', async () => {
    const snapshots = [
      createSnapshot({
        title: 'feat: already conflicted',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
      createSnapshot({
        title: 'feat: already conflicted',
        mergeable: false,
        mergeableState: 'dirty',
        headSha: 'sha-conflict',
      }),
    ];
    const commandRunner = createSnapshotCommandRunner(snapshots);
    const harness = createHarness();
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    const signal = ghSignals.prSubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    await processSignals(github, harness, [signal]);
    await github.markIdle({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });

    expect(sendSignal).not.toHaveBeenCalled();
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      lastMergeConflictFingerprint: 'pr-conflict:dirty:sha-conflict',
    });
    github.destroy();
  });

  it('filters unauthorized commenters and allows configured bots', async () => {
    const snapshots = [
      createSnapshot(),
      createSnapshot({
        comments: [
          {
            id: 'comment-1',
            body: 'random comment',
            createdAt: '2026-06-02T00:00:00.000Z',
            author: { login: 'random-user' },
          },
          {
            id: 'comment-2',
            body: 'bot comment',
            createdAt: '2026-06-02T00:01:00.000Z',
            author: { login: 'coderabbitai[bot]' },
          },
        ],
      }),
    ];
    const commandRunner = createSnapshotCommandRunner(snapshots, { 'random-user': 'read' });
    const harness = createHarness();
    const github = new GithubSignals({
      repo: 'mastra-ai/mastra',
      commandRunner,
      authorizedBots: ['coderabbitai[bot]'],
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    const signal = ghSignals.prSubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });

    await processSignals(github, harness, [signal]);
    await github.markIdle({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });

    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [notification] = (sendSignal.mock.calls as any[])[0] as any[];
    expect(notification).toMatchObject({
      contents: 'bot comment',
      attributes: { type: 'github-comment', user: 'coderabbitai[bot]', pr: 123 },
    });
    expect(commandRunner).toHaveBeenCalledWith([
      'api',
      'repos/mastra-ai/mastra/collaborators/random-user/permission',
      '--jq',
      '.permission',
    ]);
    github.destroy();
  });

  it('does not persist watermarks while active-thread notifications are still queued', async () => {
    const commandRunner = createSnapshotCommandRunner(
      [
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'old comment',
              createdAt: '2026-01-02T00:00:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
        createSnapshot({
          comments: [
            {
              id: 'comment-1',
              body: 'old comment',
              createdAt: '2026-01-02T00:00:00.000Z',
              author: { login: 'reviewer' },
            },
            {
              id: 'comment-2',
              body: 'new comment',
              createdAt: '2026-01-02T00:02:00.000Z',
              author: { login: 'reviewer' },
            },
          ],
        }),
      ],
      { reviewer: 'write' },
    );
    const harness = createHarness();
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    const signal = ghSignals.prSubscribe({ prNumber: 123 }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    await processSignals(github, harness, [signal]);

    const context = { agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' };
    github.markActive(context);
    await github.poll();
    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(((sendSignal.mock.calls as any[])[0] as any[])?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications' },
    });
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      lastCommentTimestamp: '2026-01-02T00:00:00.000Z',
    });

    await github.deliverPendingNotifications(context);

    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      lastCommentTimestamp: '2026-01-02T00:02:00.000Z',
    });
    github.destroy();
  });

  it('sends the PR subscription hint once when recent messages include strong PR work evidence', async () => {
    const harness = createHarness();
    const github = new GithubSignals({
      repo: 'mastra-ai/mastra',
      commandRunner: createSnapshotCommandRunner([createSnapshot()]),
    });
    github.processor.__registerMastra(harness.mastra as any);
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);

    await processOutputStep(github, harness, [], {
      toolCalls: [{ toolName: 'execute_command', args: { command: 'gh pr checks 123 --repo mastra-ai/mastra' } }],
    });
    await processOutputStep(github, harness, [], {
      toolCalls: [{ toolName: 'execute_command', args: { command: 'gh pr checks 123 --repo mastra-ai/mastra' } }],
    });

    const unsubscribe = ghSignals.prUnsubscribe({ prNumber: 123, repo: 'mastra-ai/mastra' }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });
    await processSignals(github, harness, [unsubscribe]);
    await processOutputStep(github, harness, [], {
      toolCalls: [{ toolName: 'execute_command', args: { command: 'gh pr checks 123 --repo mastra-ai/mastra' } }],
    });

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(((sendSignal.mock.calls as any[])[0] as any[])?.[0]).toMatchObject({
      type: 'system-reminder',
      attributes: { type: 'github-subscription-hint' },
    });
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptionHintShown).toBe(true);
  });

  it('does not send the PR subscription hint for bare git push activity', async () => {
    const harness = createHarness();
    const github = new GithubSignals({
      repo: 'mastra-ai/mastra',
      commandRunner: createSnapshotCommandRunner([createSnapshot()]),
    });
    github.processor.__registerMastra(harness.mastra as any);
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);

    await processOutputStep(github, harness, [], {
      toolCalls: [{ toolName: 'execute_command', args: { command: 'git push origin feat/github-signals' } }],
    });

    expect(sendSignal).not.toHaveBeenCalled();
    expect((harness.thread.metadata as any).mastra?.githubSignals?.subscriptionHintShown).toBeUndefined();
  });

  it('backs off and dedupes GitHub rate limit failures', async () => {
    let now = new Date('2026-01-01T00:00:00.000Z');
    const commandRunner = vi
      .fn()
      .mockRejectedValueOnce(
        new Error(
          'Command failed: gh api repos/mastra-ai/mastra/pulls/123\ngh: API rate limit exceeded for user ID 14190743. request ID A (HTTP 403)',
        ),
      )
      .mockRejectedValueOnce(
        new Error(
          'Command failed: gh api repos/mastra-ai/mastra/pulls/123\ngh: API rate limit exceeded for user ID 14190743. request ID B (HTTP 403)',
        ),
      );
    const persistence = { update: vi.fn() };
    const github = new GithubSignals({
      repo: 'mastra-ai/mastra',
      commandRunner,
      now: () => now,
    });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      persistence,
    );

    await github.poll();
    await github.poll();

    expect(commandRunner).toHaveBeenCalledTimes(1);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [notification] = (sendSignal.mock.calls as any[])[0] as any[];
    expect(notification).toMatchObject({
      type: 'system-reminder',
      contents: 'GitHub API rate limit exceeded. Polling is paused for this PR until 2026-01-01T01:00:00.000Z.',
      attributes: { type: 'github-command-error', kind: 'command-error', title: 'GitHub polling paused' },
    });
    expect(persistence.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lastErrorFingerprint: JSON.stringify({ message: 'github-rate-limit' }),
        nextPollAt: '2026-01-01T01:00:00.000Z',
      }),
    );

    now = new Date('2026-01-01T01:00:01.000Z');
    await github.poll();

    expect(commandRunner).toHaveBeenCalledTimes(2);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(persistence.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        lastErrorFingerprint: JSON.stringify({ message: 'github-rate-limit' }),
        nextPollAt: '2026-01-01T02:00:01.000Z',
      }),
    );
    github.destroy();
  });

  it('suppresses transient GitHub connection errors from shared inbox polling', async () => {
    const poller = {
      poll: vi.fn(async () => {
        throw new Error(
          'Command failed: gh api --method GET /notifications -i -F participating=true -F all=false -F per_page=100\nerror connecting to api.github.com\ncheck your internet connection or https://githubstatus.com',
        );
      }),
    } as unknown as GithubNotificationPoller;
    const persistence = { update: vi.fn() };
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', notificationPoller: poller });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription(
      {
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      persistence,
    );

    await github.poll();

    expect(poller.poll).toHaveBeenCalledTimes(1);
    expect(sendSignal).not.toHaveBeenCalled();
    expect(persistence.update).not.toHaveBeenCalled();
    github.destroy();
  });

  it('dedupes command failures', async () => {
    const commandRunner = vi.fn(async () => {
      throw new Error('gh auth required');
    });
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = createSendSignalMock();
    github.addAgent({ id: 'agent-1', sendSignal } as any);
    github.addSubscription({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    await github.poll();
    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    const [notification] = (sendSignal.mock.calls as any[])[0] as any[];
    expect(notification).toMatchObject({
      type: 'system-reminder',
      contents: 'gh auth required',
      attributes: { type: 'github-command-error', kind: 'command-error' },
    });
    github.destroy();
  });
});
