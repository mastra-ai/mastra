import { afterEach, describe, expect, it, vi } from 'vitest';

import { RequestContext, MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY } from '../request-context';
import { GithubSignals, ghSignals } from './github-signals';

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
  failedChecks = [],
  comments = [],
  reviews = [],
}: {
  failedChecks?: unknown[];
  comments?: unknown[];
  reviews?: unknown[];
} = {}) {
  return { failedChecks, comments, reviews };
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

    const permissionMatch = endpoint.match(/^repos\/([^/]+\/[^/]+)\/collaborators\/([^/]+)\/permission$/);
    if (permissionMatch) {
      const user = permissionMatch[2]!;
      const permission = permissions[user] ?? 'write';
      if (permission instanceof Error) throw permission;
      return { stdout: `${permission}\n` };
    }

    if (/^repos\/[^/]+\/[^/]+\/pulls\/\d+$/.test(endpoint)) {
      currentSnapshot = snapshots[snapshotIndex++] ?? snapshots.at(-1) ?? createSnapshot();
      return { stdout: JSON.stringify({ head: { sha: `sha-${snapshotIndex}` } }) };
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
    const [notification] = sendSignal.mock.calls[0] as any[];
    expect(notification).toMatchObject({
      contents: 'new startup comment',
      attributes: { type: 'github-comment', user: 'reviewer', pr: 123 },
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
    const [pendingReminder, target] = sendSignal.mock.calls[0] as any[];
    expect(pendingReminder).toMatchObject({
      type: 'system-reminder',
      contents: '1 new GitHub notification is pending. Call the github tool with action: "pending" to deliver them.',
      attributes: { type: 'github-pending-notifications', count: 1, pr: 123 },
    });
    expect(target).toMatchObject({ ifActive: { behavior: 'deliver' }, ifIdle: { behavior: 'persist' } });

    await github.markIdle(context);
    expect(sendSignal).toHaveBeenCalledTimes(1);
    github.destroy();
    vi.useRealTimers();
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
    const [notification] = sendSignal.mock.calls[1] as any[];
    expect(notification).toMatchObject({
      contents: 'queued comment',
      attributes: { type: 'github-comment', user: 'reviewer', pr: 123 },
    });
    github.destroy();
    vi.useRealTimers();
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
    const [notification] = sendSignal.mock.calls[2] as any[];
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
    const [notification] = sendSignal.mock.calls[1] as any[];
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
    github.removeSubscription({ ...context, repo: 'mastra-ai/mastra', prNumber: 123 });

    const result = await processSignals(github, harness, []);
    await (result?.tools?.github as any).execute({ action: 'pending' });
    await vi.advanceTimersByTimeAsync(0);

    expect(sendSignal).toHaveBeenCalledTimes(1);
    github.destroy();
    vi.useRealTimers();
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
      commandRunner: createSnapshotCommandRunner([createSnapshot()]),
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
    expect(harness.memory.updateThread).toHaveBeenCalledTimes(2);
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
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      lastCommentTimestamp: '2026-01-02T00:02:00.000Z',
      lastReviewTimestamp: '2026-01-02T00:03:00.000Z',
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
            createdAt: '2026-01-02T00:00:00.000Z',
            author: { login: 'random-user' },
          },
          {
            id: 'comment-2',
            body: 'bot comment',
            createdAt: '2026-01-02T00:01:00.000Z',
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
    const [notification] = sendSignal.mock.calls[0] as any[];
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

  it('persists watermarks after queueing active-thread notifications', async () => {
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

    github.markActive({ agentId: 'agent-1', resourceId: 'resource-1', threadId: 'thread-1' });
    await github.poll();
    await github.poll();

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls[0] as any[])?.[0]).toMatchObject({
      attributes: { type: 'github-pending-notifications' },
    });
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptions['mastra-ai/mastra:123']).toMatchObject({
      lastCommentTimestamp: '2026-01-02T00:02:00.000Z',
    });
    github.destroy();
  });

  it('sends the PR subscription hint once when recent messages look like PR work', async () => {
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
    await processOutputStep(github, harness, [], {
      toolCalls: [{ toolName: 'execute_command', args: { command: 'git push origin feat/github-signals' } }],
    });

    const unsubscribe = ghSignals.prUnsubscribe({ prNumber: 123, repo: 'mastra-ai/mastra' }).toDBMessage({
      resourceId: 'resource-1',
      threadId: 'thread-1',
    });
    await processSignals(github, harness, [unsubscribe]);
    await processOutputStep(github, harness, [], {
      toolCalls: [{ toolName: 'execute_command', args: { command: 'git push origin feat/github-signals' } }],
    });

    expect(sendSignal).toHaveBeenCalledTimes(1);
    expect((sendSignal.mock.calls[0] as any[])?.[0]).toMatchObject({
      type: 'system-reminder',
      attributes: { type: 'github-subscription-hint' },
    });
    expect((harness.thread.metadata as any).mastra.githubSignals.subscriptionHintShown).toBe(true);
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
    const [notification] = sendSignal.mock.calls[0] as any[];
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
