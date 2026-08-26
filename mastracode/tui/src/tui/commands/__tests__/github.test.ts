import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleGithubCommand } from '../github.js';
import type { SlashCommandContext } from '../types.js';

const askModalQuestionMock = vi.fn();
const execFileMock = vi.fn();
const loadSettingsMock = vi.fn();

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => execFileMock(...args),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: () => loadSettingsMock(),
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: (...args: unknown[]) => askModalQuestionMock(...args),
}));

function createContext() {
  const sendSignal = vi.fn(() => ({ id: 'signal-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
  const syncThreadNow = vi.fn(async () => 1);
  const subscribeThreadToPR = vi.fn(async () => ({
    owner: 'mastra-ai',
    repo: 'mastra',
    number: 17447,
    mode: 'working',
  }));
  const unsubscribeThreadFromPR = vi.fn(async () => ({
    owner: 'mastra-ai',
    repo: 'mastra',
    number: 17447,
    removed: true,
    remainingSubscriptions: 0,
  }));
  const session = {
    sendSignal,
    identity: { getResourceId: vi.fn(() => 'resource-1') },
    thread: { getId: vi.fn(() => 'thread-1'), list: vi.fn(async () => []) },
  };
  const ctx = {
    state: {
      session,
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
    controller: {
      sendSignal,
      session,
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
    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: 17447,
      mode: 'working',
    });
    expect(ctx.showInfo).toHaveBeenCalledWith('Subscribed to mastra-ai/mastra#17447 in working mode.');
  });

  it('sends owner and repo when provided inline', async () => {
    const { ctx, subscribeThreadToPR } = createContext();

    await handleGithubCommand(ctx, ['mastra-ai/mastra#17447']);

    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      mode: 'working',
    });
  });

  it('supports the explicit subscribe subcommand', async () => {
    const { ctx, subscribeThreadToPR } = createContext();

    await handleGithubCommand(ctx, ['subscribe', '17447']);

    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: 17447,
      mode: 'working',
    });
  });

  it('subscribes in explicit review mode and strips the flag before parsing the PR', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    subscribeThreadToPR.mockResolvedValue({ owner: 'mastra-ai', repo: 'mastra', number: 17447, mode: 'review' });

    await handleGithubCommand(ctx, ['subscribe', 'mastra-ai/mastra#17447', '--mode', 'review']);

    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      mode: 'review',
    });
    expect(ctx.showInfo).toHaveBeenCalledWith('Subscribed to mastra-ai/mastra#17447 in review mode.');
  });

  it('accepts explicit working mode in the shorthand form', async () => {
    const { ctx, subscribeThreadToPR } = createContext();

    await handleGithubCommand(ctx, ['--mode', 'working', '17447']);

    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: 17447,
      mode: 'working',
    });
  });

  it('reports an already-terminal review subscription without confirming success', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    subscribeThreadToPR.mockResolvedValue({
      owner: 'mastra-ai',
      repo: 'mastra',
      number: 17447,
      mode: 'review',
      terminalState: 'merged',
    } as any);

    await handleGithubCommand(ctx, ['17447', '--mode', 'review']);

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'Not subscribed to mastra-ai/mastra#17447 in review mode because it is already merged.',
    );
    expect(ctx.showInfo).not.toHaveBeenCalledWith(expect.stringContaining('Subscribed to'));
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
      mode: 'working',
    });
  });

  it('applies an inline mode flag to a PR selected in the modal', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    subscribeThreadToPR.mockResolvedValue({ owner: 'mastra-ai', repo: 'mastra', number: 17447, mode: 'review' });
    askModalQuestionMock.mockResolvedValue('https://github.com/mastra-ai/mastra/pull/17447');

    await handleGithubCommand(ctx, ['subscribe', '--mode', 'review']);

    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      mode: 'review',
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
      mode: 'working',
    });
  });

  it('unsubscribes the only current subscription without prompting', async () => {
    const { ctx, unsubscribeThreadFromPR } = createContext();
    vi.mocked((ctx.controller as any).session.thread.list).mockResolvedValue([
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
    vi.mocked((ctx.controller as any).session.thread.list).mockResolvedValue([
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
    vi.mocked((ctx.controller as any).session.thread.list).mockResolvedValue([
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
                  mode: 'legacy-invalid',
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
      `GitHub Signals debug for thread-1: 1 subscription, polling=active, interval=5m\n- mastra-ai/mastra#17447 mode=working sync=success lastPoll=${formatLocal('2026-06-02T18:03:12Z')} (githubUpdated=${formatLocal('2026-06-02T18:01:58Z')}, ci=failure, merge=dirty)\n  lastNotification=pull-request-ci-failure/high at ${formatLocal('2026-06-02T18:03:13Z')}: mastra-ai/mastra#17447 has failing CI: Quality assurance`,
    );
  });

  it.each([
    {
      name: 'equals syntax',
      args: ['17447', '--mode=review'],
      error: 'Use the spaced form --mode review or --mode working; --mode=... is not supported.',
    },
    {
      name: 'missing value',
      args: ['17447', '--mode'],
      error: 'Missing value for --mode. Use review or working.',
    },
    {
      name: 'unknown value',
      args: ['17447', '--mode', 'observe'],
      error: 'Unknown GitHub subscription mode "observe". Use review or working.',
    },
    {
      name: 'duplicate flags',
      args: ['17447', '--mode', 'review', '--mode', 'working'],
      error: 'Specify --mode only once.',
    },
  ])('rejects invalid mode flags: $name', async ({ args, error }) => {
    const { ctx, subscribeThreadToPR } = createContext();

    await handleGithubCommand(ctx, args);

    expect(subscribeThreadToPR).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining(error));
    expect(ctx.showError).toHaveBeenCalledWith(
      expect.stringContaining('/github subscribe <PR> [--mode review|working]'),
    );
  });

  it('rejects mode flags on unsubscribe without changing unsubscribe semantics', async () => {
    const { ctx, unsubscribeThreadFromPR } = createContext();

    await handleGithubCommand(ctx, ['unsubscribe', '17447', '--mode', 'review']);

    expect(unsubscribeThreadFromPR).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('--mode applies only when subscribing.'));
  });

  it('shows an error for invalid PR references', async () => {
    const { ctx, sendSignal } = createContext();

    await handleGithubCommand(ctx, ['not-a-pr']);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(
      'Usage: /github subscribe <PR> [--mode review|working], /github <PR> [--mode review|working], /github unsubscribe <PR>, /github sync, or /github debug. <PR> can be 123, owner/repo#123, or a GitHub pull request URL.',
    );
  });
});
