import { describe, expect, it, vi } from 'vitest';

import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import { GithubSignals, ghSignals } from './github-signals';

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
  failedChecks = [],
  comments = [],
  reviews = [],
}: {
  failedChecks?: unknown[];
  comments?: unknown[];
  reviews?: unknown[];
} = {}) {
  return {
    stdout: JSON.stringify({
      statusCheckRollup: failedChecks,
      comments,
      reviews,
    }),
  };
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

  it('persists a subscription, baselines existing activity, and starts polling', async () => {
    vi.useFakeTimers();
    const commandRunner = vi.fn(async () =>
      createSnapshot({
        failedChecks: [{ name: 'lint', conclusion: 'FAILURE' }],
        comments: [{ id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' }],
        reviews: [{ id: 'review-1', body: 'old review', submittedAt: '2026-01-02T00:01:00.000Z' }],
      }),
    );
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

  it('rehydrates persisted subscriptions with a silent startup baseline', async () => {
    vi.useFakeTimers();
    const commandRunner = vi.fn(async () =>
      createSnapshot({
        failedChecks: [{ name: 'lint', conclusion: 'FAILURE' }],
        comments: [{ id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' }],
        reviews: [{ id: 'review-1', body: 'old review', submittedAt: '2026-01-02T00:01:00.000Z' }],
      }),
    );
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

  it('dedupes processed subscribe signals', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner: vi.fn(async () => createSnapshot()),
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
      commandRunner: vi.fn(async () => createSnapshot()),
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
    expect(vi.getTimerCount()).toBe(1);
    await processSignals(github, harness, [subscribe, unsubscribe]);

    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions).toEqual({});
    expect(vi.getTimerCount()).toBe(0);
    vi.useRealTimers();
  });

  it('activates subscriptions immediately when the github tool sends a signal', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const github = new GithubSignals({
      pollIntervalMs: 1_000,
      repo: 'mastra-ai/mastra',
      commandRunner: vi.fn(async () => createSnapshot()),
    });
    github.addAgent({ id: 'agent-1', sendSignal: createSendSignalMock() } as any);
    const sendSignal = vi.fn(async signal => signal);

    const result = await processSignals(github, harness, [], { sendSignal });
    await (result?.tools?.github as any).execute({ action: 'subscribe', prNumber: 123 });

    expect(sendSignal).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'system-reminder',
        attributes: expect.objectContaining({ type: 'github-pr-subscribe' }),
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

  it('emits one compact notification for failing checks and dedupes repeated polls', async () => {
    vi.useFakeTimers();
    const commandRunner = vi.fn(async () =>
      createSnapshot({
        failedChecks: [{ name: 'unit tests', conclusion: 'FAILURE', detailsUrl: 'https://example.com/check' }],
      }),
    );
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

    expect(commandRunner).toHaveBeenCalledWith([
      'pr',
      'view',
      '123',
      '--json',
      'statusCheckRollup,comments,reviews',
      '--repo',
      'mastra-ai/mastra',
    ]);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect(getStreamOptions).toHaveBeenCalledWith({
      agentId: 'agent-1',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      repo: 'mastra-ai/mastra',
      prNumber: 123,
    });
    const [notification, target] = sendSignal.mock.calls[0] as any[];
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

  it('baselines existing activity on subscribe and only emits future comments and reviews', async () => {
    const commandRunner = vi
      .fn()
      .mockResolvedValueOnce(
        createSnapshot({
          comments: [{ id: 'comment-1', body: 'old comment', createdAt: '2026-01-02T00:00:00.000Z' }],
          reviews: [{ id: 'review-1', body: 'old review', submittedAt: '2026-01-02T00:01:00.000Z' }],
        }),
      )
      .mockResolvedValueOnce(
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
      );
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

    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(2);
    const [commentNotification] = sendSignal.mock.calls[0] as any[];
    const [reviewNotification] = sendSignal.mock.calls[1] as any[];
    expect(commentNotification).toMatchObject({
      contents: 'Please fix this',
      attributes: { type: 'github-comment', user: 'reviewer', pr: 123 },
    });
    expect(reviewNotification).toMatchObject({
      contents: 'Requested changes',
      attributes: { type: 'github-review', user: 'reviewer', reviewState: 'CHANGES_REQUESTED', pr: 123 },
    });
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
    const [notification] = sendSignal.mock.calls[0] as any[];
    expect(notification).toMatchObject({
      type: 'system-reminder',
      contents: 'gh auth required',
      attributes: { type: 'github-command-error', kind: 'command-error' },
    });
    github.destroy();
  });
});
