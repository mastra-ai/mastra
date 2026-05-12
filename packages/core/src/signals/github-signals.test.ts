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

async function processSignals(github: GithubSignals, harness: ReturnType<typeof createHarness>, messages: any[]) {
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
  });
}

describe('GithubSignals', () => {
  it('creates subscribe and unsubscribe signals', () => {
    const subscribe = ghSignals.prSubscribe({ prNumber: 123, repo: 'mastra-ai/mastra' });
    const unsubscribe = ghSignals.prUnsubscribe({ prNumber: 123, repo: 'mastra-ai/mastra' });

    expect(subscribe.type).toBe('github-pr-subscribe');
    expect(subscribe.attributes).toMatchObject({ prNumber: 123, repo: 'mastra-ai/mastra' });
    expect(subscribe.contents).toContain('subscribed to Github PR #123');
    expect(unsubscribe.type).toBe('github-pr-unsubscribe');
  });

  it('persists a subscription from a subscribe signal and starts polling', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra' });
    const agent = { id: 'agent-1', sendSignal: vi.fn() };
    github.addAgent(agent as any);

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
    });
    expect(vi.getTimerCount()).toBe(1);

    github.destroy();
    vi.useRealTimers();
  });

  it('starts polling with explicit subscriptions for rehydration', () => {
    vi.useFakeTimers();
    const github = new GithubSignals({ pollIntervalMs: 1_000 });

    github.start([
      {
        agentId: 'agent-1',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        repo: 'mastra-ai/mastra',
        prNumber: 123,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);

    expect(vi.getTimerCount()).toBe(1);
    github.destroy();
    vi.useRealTimers();
  });

  it('dedupes processed subscribe signals', async () => {
    vi.useFakeTimers();
    const harness = createHarness();
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra' });
    github.addAgent({ id: 'agent-1', sendSignal: vi.fn() } as any);
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
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra' });
    github.addAgent({ id: 'agent-1', sendSignal: vi.fn() } as any);
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

  it('emits one notification for failing checks and dedupes repeated polls', async () => {
    vi.useFakeTimers();
    const commandRunner = vi.fn(async () => ({
      stdout: JSON.stringify({
        statusCheckRollup: [{ name: 'unit tests', conclusion: 'FAILURE', detailsUrl: 'https://example.com/check' }],
        comments: [],
        reviews: [],
      }),
    }));
    const github = new GithubSignals({ pollIntervalMs: 1_000, repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = vi.fn(() => ({
      accepted: true,
      runId: 'run-1',
      signal: {} as any,
      persisted: Promise.resolve(),
    }));
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
    const [notification, target] = sendSignal.mock.calls[0] as any[];
    expect(notification).toMatchObject({
      type: 'github-pr-notification',
      attributes: { kind: 'ci-failure', prNumber: 123, repo: 'mastra-ai/mastra' },
    });
    expect(target).toMatchObject({
      resourceId: 'resource-1',
      threadId: 'thread-1',
      ifIdle: { behavior: 'wake' },
      ifActive: { behavior: 'deliver' },
    });

    github.destroy();
    vi.useRealTimers();
  });

  it('emits notifications for new comments and reviews', async () => {
    const commandRunner = vi.fn(async () => ({
      stdout: JSON.stringify({
        statusCheckRollup: [],
        comments: [
          {
            id: 'comment-1',
            body: 'Please fix this',
            createdAt: '2026-01-02T00:00:00.000Z',
            author: { login: 'reviewer' },
            url: 'https://example.com/comment',
          },
        ],
        reviews: [
          {
            id: 'review-1',
            body: 'Requested changes',
            submittedAt: '2026-01-02T00:01:00.000Z',
            author: { login: 'reviewer' },
            state: 'CHANGES_REQUESTED',
            url: 'https://example.com/review',
          },
        ],
      }),
    }));
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = vi.fn(() => ({
      accepted: true,
      runId: 'run-1',
      signal: {} as any,
      persisted: Promise.resolve(),
    }));
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

    expect(sendSignal).toHaveBeenCalledTimes(2);
    const [commentNotification] = sendSignal.mock.calls[0] as any[];
    const [reviewNotification] = sendSignal.mock.calls[1] as any[];
    expect(commentNotification.contents).toContain('Please fix this');
    expect(reviewNotification.contents).toContain('Requested changes');
    github.destroy();
  });

  it('dedupes command failures', async () => {
    const commandRunner = vi.fn(async () => {
      throw new Error('gh auth required');
    });
    const github = new GithubSignals({ repo: 'mastra-ai/mastra', commandRunner });
    const sendSignal = vi.fn(() => ({
      accepted: true,
      runId: 'run-1',
      signal: {} as any,
      persisted: Promise.resolve(),
    }));
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
      type: 'github-pr-notification',
      attributes: { kind: 'command-error' },
    });
    github.destroy();
  });
});
