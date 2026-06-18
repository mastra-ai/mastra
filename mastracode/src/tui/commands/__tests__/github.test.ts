import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleGithubCommand } from '../github.js';
import type { SlashCommandContext } from '../types.js';

const askModalQuestionMock = vi.fn();
const execFileMock = vi.fn();
const loadSettingsMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

vi.mock('../../../onboarding/settings.js', () => ({
  loadSettings: () => loadSettingsMock(),
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: (...args: unknown[]) => askModalQuestionMock(...args),
}));

function createContext() {
  const sendSignal = vi.fn(() => ({ id: 'signal-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
  const syncThreadNow = vi.fn(async () => 1);
  const subscribeThreadToPR = vi.fn(async () => ({ owner: 'mastra-ai', repo: 'mastra', number: 17447 }));
  const unsubscribeThreadFromPR = vi.fn(async () => ({
    owner: 'mastra-ai',
    repo: 'mastra',
    number: 17447,
    removed: true,
    remainingSubscriptions: 0,
  }));
  const ctx = {
    state: {
      ui: { requestRender: vi.fn() },
      projectInfo: { rootPath: '/repo' },
      options: {
        githubSignals: {
          isPollingThread: vi.fn(() => false),
          getPollIntervalMs: vi.fn(() => 300_000),
          syncThreadNow,
          subscribeThreadToPR,
          unsubscribeThreadFromPR,
        },
      },
    },
    harness: {
      sendSignal,
      session: { identity: { getResourceId: vi.fn(() => 'resource-1') }, thread: { getId: vi.fn(() => 'thread-1') } },
      listThreads: vi.fn(async () => []),
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
  } as unknown as SlashCommandContext;
  return { ctx, sendSignal, syncThreadNow, subscribeThreadToPR, unsubscribeThreadFromPR };
}

describe('handleGithubCommand', () => {
  beforeEach(() => {
    askModalQuestionMock.mockReset();
    execFileMock.mockReset();
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue({ signals: { experimentalGithubSignals: true } });
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(new Error('no current PR'));
    });
  });

  it('subscribes the current thread to an inline PR number', async () => {
    const { ctx, sendSignal, subscribeThreadToPR } = createContext();

    await handleGithubCommand(ctx, ['17447']);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(subscribeThreadToPR).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1', pr: 17447 });
    expect(ctx.showInfo).toHaveBeenCalledWith('Subscribed to mastra-ai/mastra#17447.');
  });

  it('sends owner and repo when provided inline', async () => {
    const { ctx, subscribeThreadToPR } = createContext();

    await handleGithubCommand(ctx, ['mastra-ai/mastra#17447']);

    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
    });
  });

  it('supports the explicit subscribe subcommand', async () => {
    const { ctx, subscribeThreadToPR } = createContext();

    await handleGithubCommand(ctx, ['subscribe', '17447']);

    expect(subscribeThreadToPR).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1', pr: 17447 });
  });

  it('unsubscribes the current thread from an inline PR', async () => {
    const { ctx, sendSignal, unsubscribeThreadFromPR } = createContext();

    await handleGithubCommand(ctx, ['unsubscribe', 'mastra-ai/mastra#17447']);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(unsubscribeThreadFromPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
    });
    expect(ctx.showInfo).toHaveBeenCalledWith('Unsubscribed from mastra-ai/mastra#17447.');
  });

  it('does not send a signal when experimental GitHub signals are disabled', async () => {
    const { ctx, sendSignal } = createContext();
    loadSettingsMock.mockReturnValue({ signals: { experimentalGithubSignals: false } });

    await handleGithubCommand(ctx, ['17447']);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(
      'Experimental GitHub signals are disabled. Enable them in /settings and restart MastraCode.',
    );
  });

  it('asks for a PR reference when no inline args are provided', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    askModalQuestionMock.mockResolvedValue('https://github.com/mastra-ai/mastra/pull/17447');

    await handleGithubCommand(ctx, []);

    expect(askModalQuestionMock).toHaveBeenCalled();
    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
    });
  });

  it('prefills the prompt from gh pr view when possible', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    execFileMock.mockImplementation((_command, _args, _options, callback) => {
      callback(null, 'https://github.com/mastra-ai/mastra/pull/17447\n', '');
    });
    askModalQuestionMock.mockResolvedValue('https://github.com/mastra-ai/mastra/pull/17447');

    await handleGithubCommand(ctx, []);

    expect(execFileMock).toHaveBeenCalledWith(
      'gh',
      ['pr', 'view', '--json', 'url', '--jq', '.url'],
      { cwd: '/repo' },
      expect.any(Function),
    );
    expect(askModalQuestionMock).toHaveBeenCalledWith(
      ctx.state.ui,
      expect.objectContaining({ defaultValue: 'https://github.com/mastra-ai/mastra/pull/17447' }),
    );
    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
    });
  });

  it('unsubscribes the only current subscription without prompting', async () => {
    const { ctx, unsubscribeThreadFromPR } = createContext();
    vi.mocked((ctx.harness as any).listThreads).mockResolvedValue([
      {
        id: 'thread-1',
        resourceId: 'resource-1',
        metadata: {
          mastra: {
            githubSignals: {
              subscriptions: [{ owner: 'mastra-ai', repo: 'mastra', number: 17447 }],
            },
          },
        },
      },
    ]);

    await handleGithubCommand(ctx, ['unsubscribe']);

    expect(askModalQuestionMock).not.toHaveBeenCalled();
    expect(unsubscribeThreadFromPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
    });
  });

  it('syncs GitHub subscriptions for the current thread', async () => {
    const { ctx, sendSignal, syncThreadNow } = createContext();
    vi.mocked((ctx.harness as any).listThreads).mockResolvedValue([
      { id: 'thread-1', resourceId: 'resource-from-thread' },
    ]);

    await handleGithubCommand(ctx, ['sync']);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(syncThreadNow).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-from-thread' });
    expect(ctx.showInfo).not.toHaveBeenCalled();
  });

  it('shows a no-op message when /github sync has no subscriptions', async () => {
    const { ctx, syncThreadNow } = createContext();
    syncThreadNow.mockResolvedValue(0);

    await handleGithubCommand(ctx, ['sync']);

    expect(ctx.showInfo).toHaveBeenCalledWith('No GitHub PR subscriptions to sync.');
  });

  it('shows GitHub subscription debug information for the current thread', async () => {
    const { ctx, sendSignal } = createContext();
    vi.mocked((ctx.state as any).options.githubSignals.isPollingThread).mockReturnValue(true);
    vi.mocked((ctx.harness as any).listThreads).mockResolvedValue([
      {
        id: 'thread-1',
        resourceId: 'resource-1',
        metadata: {
          mastra: {
            githubSignals: {
              subscriptions: [
                {
                  owner: 'mastra-ai',
                  repo: 'mastra',
                  number: 17447,
                  lastSyncStatus: 'success',
                  lastSyncAt: '2026-06-02T18:03:12Z',
                  lastObservedGithubUpdatedAt: '2026-06-02T18:01:58Z',
                  lastObservedCiState: 'failure',
                  lastObservedMergeableState: 'dirty',
                  lastNotificationAt: '2026-06-02T18:03:13Z',
                  lastNotificationKind: 'pull-request-ci-failure',
                  lastNotificationPriority: 'high',
                  lastNotificationSummary: 'mastra-ai/mastra#17447 has failing CI: Quality assurance',
                },
              ],
            },
          },
        },
      },
    ]);

    await handleGithubCommand(ctx, ['debug']);

    expect(sendSignal).not.toHaveBeenCalled();
    const formatLocal = (value: string) =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium',
        timeStyle: 'medium',
        hour12: true,
      }).format(new Date(value));
    expect(ctx.showInfo).toHaveBeenCalledWith(
      `GitHub Signals debug for thread-1: 1 subscription, polling=active, interval=5m\n- mastra-ai/mastra#17447 sync=success lastPoll=${formatLocal('2026-06-02T18:03:12Z')} (githubUpdated=${formatLocal('2026-06-02T18:01:58Z')}, ci=failure, merge=dirty)\n  lastNotification=pull-request-ci-failure/high at ${formatLocal('2026-06-02T18:03:13Z')}: mastra-ai/mastra#17447 has failing CI: Quality assurance`,
    );
  });

  it('shows an error for invalid PR references', async () => {
    const { ctx, sendSignal } = createContext();

    await handleGithubCommand(ctx, ['not-a-pr']);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(
      'Usage: /github 123, /github owner/repo#123, /github unsubscribe 123, /github sync, /github debug, or /github https://github.com/owner/repo/pull/123',
    );
  });
});
