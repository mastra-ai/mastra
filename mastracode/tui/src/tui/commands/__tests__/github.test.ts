import { GITHUB_SIGNALS_METADATA_KEY } from '@mastra/github-signals';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleGithubCommand } from '../github.js';
import type { SlashCommandContext } from '../types.js';

const mocks = vi.hoisted(() => ({
  askModalQuestion: vi.fn(),
  execFile: vi.fn(),
  loadSettings: vi.fn(),
  saveSettings: vi.fn(),
  pickerSelections: [] as unknown[][],
  pickerOptions: [] as Array<Record<string, unknown>>,
}));

vi.mock('node:child_process', () => ({
  execFile: (...args: unknown[]) => mocks.execFile(...args),
}));

vi.mock('@mastra/code-sdk/onboarding/settings', () => ({
  loadSettings: () => mocks.loadSettings(),
  saveSettings: (settings: unknown) => mocks.saveSettings(settings),
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: (...args: unknown[]) => mocks.askModalQuestion(...args),
}));

vi.mock('../../overlay.js', () => ({
  showModalOverlay: vi.fn(),
}));

vi.mock('../../components/github-pr-picker.js', () => ({
  githubPRId: (pr: { owner?: string; repo?: string; number: number }) =>
    pr.owner && pr.repo ? `${pr.owner}/${pr.repo}#${pr.number}` : `#${pr.number}`,
  GithubPRPickerDialog: class GithubPRPickerDialog {
    focused = false;
    private options: Record<string, unknown>;

    constructor(options: Record<string, unknown>) {
      this.options = options;
      mocks.pickerOptions.push(options);
      if (!options.loadingMessage) this.completePicker();
    }

    setPullRequests(_input: { mine: unknown[]; search?: unknown[]; errorMessage?: string }) {
      this.completePicker();
    }

    private completePicker() {
      const selection = mocks.pickerSelections.shift();
      queueMicrotask(() => {
        if (selection) (this.options.onConfirm as (items: unknown[]) => void)(selection);
        else (this.options.onCancel as () => void)();
      });
    }
  },
}));

function createContext() {
  const sendSignal = vi.fn(() => ({ id: 'signal-1', accepted: Promise.resolve({ accepted: true, runId: 'run-1' }) }));
  const syncThreadNow = vi.fn(async () => 1);
  const subscribeThreadToPR = vi.fn(
    async ({ pr, mode }: { pr: number | { owner?: string; repo?: string; number: number }; mode?: string }) => ({
      owner: typeof pr === 'number' ? 'mastra-ai' : (pr.owner ?? 'mastra-ai'),
      repo: typeof pr === 'number' ? 'mastra' : (pr.repo ?? 'mastra'),
      number: typeof pr === 'number' ? pr : pr.number,
      mode: mode ?? 'working',
    }),
  );
  const unsubscribeThreadFromPR = vi.fn(
    async ({ pr }: { pr: number | { owner?: string; repo?: string; number: number } }) => ({
      owner: typeof pr === 'number' ? 'mastra-ai' : (pr.owner ?? 'mastra-ai'),
      repo: typeof pr === 'number' ? 'mastra' : (pr.repo ?? 'mastra'),
      number: typeof pr === 'number' ? pr : pr.number,
      removed: true,
      remainingSubscriptions: 0,
    }),
  );
  const session = {
    sendSignal,
    identity: { getResourceId: vi.fn(() => 'resource-1') },
    thread: { getId: vi.fn(() => 'thread-1'), list: vi.fn(async () => []) },
  };
  const ctx = {
    state: {
      session,
      ui: { requestRender: vi.fn(), hideOverlay: vi.fn() },
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

function mockGhSuccess() {
  mocks.execFile.mockImplementation((_command, args: string[], _options, callback) => {
    if (args[0] === 'repo') {
      callback(null, JSON.stringify({ owner: { login: 'mastra-ai' }, name: 'mastra' }), '');
      return;
    }
    if (args[0] === 'pr' && args[1] === 'list') {
      callback(
        null,
        JSON.stringify([
          {
            number: 17447,
            title: 'First PR',
            author: { login: 'tyler' },
            updatedAt: '2026-06-20T00:00:00Z',
            url: 'https://github.com/mastra-ai/mastra/pull/17447',
            headRefName: 'feat/a',
            baseRefName: 'main',
          },
          {
            number: 17448,
            title: 'Second PR',
            author: { login: 'tyler' },
            updatedAt: '2026-06-20T00:00:00Z',
            url: 'https://github.com/mastra-ai/mastra/pull/17448',
            headRefName: 'feat/b',
            baseRefName: 'main',
          },
        ]),
        '',
      );
      return;
    }
    callback(new Error('unexpected gh call'));
  });
}

function mockThreadSubscriptions(
  ctx: SlashCommandContext,
  subscriptions: Array<{ owner?: string; repo?: string; number: number; mode?: string }>,
) {
  vi.mocked((ctx.state.session as any).thread.list).mockResolvedValue([
    {
      id: 'thread-1',
      resourceId: 'resource-1',
      metadata: {
        mastra: {
          [GITHUB_SIGNALS_METADATA_KEY]: { subscriptions },
        },
      },
    },
  ]);
}

describe('handleGithubCommand', () => {
  beforeEach(() => {
    mocks.askModalQuestion.mockReset();
    mocks.execFile.mockReset();
    mocks.loadSettings.mockReset();
    mocks.saveSettings.mockReset();
    mocks.pickerSelections.length = 0;
    mocks.pickerOptions.length = 0;
    mocks.loadSettings.mockReturnValue({ signals: { experimentalGithubSignals: true, githubPollIntervalMs: 300_000 } });
    mocks.execFile.mockImplementation((_command, _args, _options, callback) => {
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
    mocks.loadSettings.mockReturnValue({ signals: { experimentalGithubSignals: false } });

    await handleGithubCommand(ctx, ['17447']);

    expect(sendSignal).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(
      'Experimental GitHub signals are disabled. Enable them in /settings and restart MastraCode.',
    );
  });

  it('asks for a PR reference when explicit subscribe has no inline args', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    mocks.askModalQuestion.mockResolvedValue('https://github.com/mastra-ai/mastra/pull/17447');

    await handleGithubCommand(ctx, ['subscribe']);

    expect(mocks.askModalQuestion).toHaveBeenCalled();
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
    mocks.askModalQuestion.mockResolvedValue('https://github.com/mastra-ai/mastra/pull/17447');

    await handleGithubCommand(ctx, ['subscribe', '--mode', 'review']);

    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      mode: 'review',
    });
  });

  it('prefills the prompt from gh pr view when explicit subscribe has no inline args', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    mocks.execFile.mockImplementation((_command, _args, _options, callback) => {
      callback(null, 'https://github.com/mastra-ai/mastra/pull/17447\n', '');
    });
    mocks.askModalQuestion.mockResolvedValue('https://github.com/mastra-ai/mastra/pull/17447');

    await handleGithubCommand(ctx, ['subscribe']);

    expect(mocks.execFile).toHaveBeenCalledWith(
      'gh',
      ['pr', 'view', '--json', 'url', '--jq', '.url'],
      { cwd: '/repo', timeout: 15_000 },
      expect.any(Function),
    );
    expect(mocks.askModalQuestion).toHaveBeenCalledWith(
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

  it('shows the no-arg GitHub action menu', async () => {
    const { ctx } = createContext();
    mocks.askModalQuestion.mockResolvedValue('List subscriptions');

    await handleGithubCommand(ctx, []);

    expect(mocks.askModalQuestion).toHaveBeenCalledWith(
      ctx.state.ui,
      expect.objectContaining({
        question: 'GitHub Signals',
        options: expect.arrayContaining([expect.objectContaining({ label: 'Subscribe' })]),
      }),
    );
    expect(ctx.showInfo).toHaveBeenCalledWith('GitHub Signals debug for thread-1: no subscribed PRs.');
  });

  it('subscribes multiple PRs selected from the picker', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    mockGhSuccess();
    mocks.askModalQuestion.mockResolvedValue('Subscribe');
    mocks.pickerSelections.push([
      { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
    ]);

    await handleGithubCommand(ctx, []);
    await vi.waitFor(() => expect(subscribeThreadToPR).toHaveBeenCalledTimes(2));

    expect(mocks.pickerOptions[0]).toMatchObject({
      title: 'Subscribe to GitHub PRs',
      loadingMessage: 'Loading GitHub PRs…',
      pullRequests: [],
    });
    expect(subscribeThreadToPR).toHaveBeenNthCalledWith(1, {
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      mode: 'working',
    });
    expect(subscribeThreadToPR).toHaveBeenNthCalledWith(2, {
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
      mode: 'working',
    });
    expect(ctx.showInfo).toHaveBeenCalledWith(
      'GitHub PR batch complete: mastra-ai/mastra#17447: subscribed; mastra-ai/mastra#17448: subscribed.',
    );
  });

  it('reports partial failures in multi-PR operations', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    mockGhSuccess();
    subscribeThreadToPR.mockRejectedValueOnce(new Error('sync failed'));
    mocks.askModalQuestion.mockResolvedValue('Subscribe');
    mocks.pickerSelections.push([
      { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
    ]);

    await handleGithubCommand(ctx, []);
    await vi.waitFor(() => expect(subscribeThreadToPR).toHaveBeenCalledTimes(2));

    expect(ctx.showInfo).toHaveBeenCalledWith(
      'GitHub PR batch complete: mastra-ai/mastra#17447: failed (sync failed); mastra-ai/mastra#17448: subscribed.',
    );
  });

  it('does not re-subscribe existing review-mode selections from the subscribe picker', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    mockGhSuccess();
    mockThreadSubscriptions(ctx, [{ owner: 'mastra-ai', repo: 'mastra', number: 17447, mode: 'review' }]);
    mocks.askModalQuestion.mockResolvedValue('Subscribe');
    mocks.pickerSelections.push([
      { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
    ]);

    await handleGithubCommand(ctx, []);
    await vi.waitFor(() => expect(subscribeThreadToPR).toHaveBeenCalledTimes(1));

    expect(mocks.pickerOptions[0]?.subscribedIds).toEqual(new Set(['mastra-ai/mastra#17447']));
    expect(subscribeThreadToPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
      mode: 'working',
    });
    expect(subscribeThreadToPR).not.toHaveBeenCalledWith(
      expect.objectContaining({
        pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      }),
    );
    expect(ctx.showInfo).toHaveBeenCalledWith('Subscribed to mastra-ai/mastra#17448 in working mode.');
  });

  it('surfaces repository search failures separately from authored PRs', async () => {
    const { ctx } = createContext();
    mocks.askModalQuestion.mockResolvedValue('Subscribe');
    mocks.execFile.mockImplementation((_command, args: string[], _options, callback) => {
      if (args[0] === 'repo') {
        callback(null, JSON.stringify({ owner: { login: 'mastra-ai' }, name: 'mastra' }), '');
        return;
      }
      if (args.includes('--author') || args.includes('--assignee')) {
        callback(null, JSON.stringify([]), '');
        return;
      }
      callback(new Error('search failed'), '', 'search failed');
    });

    await handleGithubCommand(ctx, []);
    await vi.waitFor(() => expect(mocks.pickerOptions).toHaveLength(1));

    expect(ctx.showError).toHaveBeenCalledWith(
      expect.stringContaining('GitHub PR discovery failed: GitHub repository search failed:'),
    );
  });

  it('shows PR discovery failures without throwing', async () => {
    const { ctx, subscribeThreadToPR } = createContext();
    mocks.askModalQuestion.mockResolvedValue('Subscribe');

    await handleGithubCommand(ctx, []);
    await vi.waitFor(() => expect(mocks.pickerOptions).toHaveLength(1));

    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('GitHub PR discovery failed:'));
    expect(subscribeThreadToPR).not.toHaveBeenCalled();
  });

  it('unsubscribes multiple selected subscriptions from the picker', async () => {
    const { ctx, unsubscribeThreadFromPR } = createContext();
    mockThreadSubscriptions(ctx, [
      { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
    ]);
    mocks.askModalQuestion.mockResolvedValue('Unsubscribe');
    mocks.pickerSelections.push([
      { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
    ]);

    await handleGithubCommand(ctx, []);
    await vi.waitFor(() => expect(unsubscribeThreadFromPR).toHaveBeenCalledTimes(2));

    expect(unsubscribeThreadFromPR).toHaveBeenNthCalledWith(1, {
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
    });
    expect(unsubscribeThreadFromPR).toHaveBeenNthCalledWith(2, {
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
    });
  });

  it('keeps ownerless subscriptions available in unsubscribe picker flows', async () => {
    const { ctx, unsubscribeThreadFromPR } = createContext();
    mockThreadSubscriptions(ctx, [{ number: 17447 }]);
    mocks.askModalQuestion.mockResolvedValue('Unsubscribe');
    mocks.pickerSelections.push([{ number: 17447 }]);

    await handleGithubCommand(ctx, []);
    await vi.waitFor(() => expect(unsubscribeThreadFromPR).toHaveBeenCalledTimes(1));

    expect(unsubscribeThreadFromPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: undefined, repo: undefined, number: 17447 },
    });
  });

  it('unsubscribes all current subscriptions after confirmation', async () => {
    const { ctx, unsubscribeThreadFromPR } = createContext();
    mockThreadSubscriptions(ctx, [
      { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
      { owner: 'mastra-ai', repo: 'mastra', number: 17448 },
    ]);
    mocks.askModalQuestion.mockResolvedValueOnce('Unsubscribe all').mockResolvedValueOnce('Unsubscribe all');

    await handleGithubCommand(ctx, []);

    expect(unsubscribeThreadFromPR).toHaveBeenCalledTimes(2);
  });

  it('saves a GitHub poll interval preset', async () => {
    const { ctx } = createContext();
    const settings = { signals: { experimentalGithubSignals: true, githubPollIntervalMs: 300_000 } };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.askModalQuestion.mockResolvedValueOnce('Poll interval').mockResolvedValueOnce('1m');

    await handleGithubCommand(ctx, []);

    expect(mocks.askModalQuestion).toHaveBeenNthCalledWith(
      2,
      ctx.state.ui,
      expect.objectContaining({
        question: 'GitHub polling interval (current: 5m)',
        selectedOptionLabel: '5m',
        options: expect.arrayContaining([
          expect.objectContaining({ label: '5m', description: 'Check every five minutes (current)' }),
        ]),
      }),
    );
    expect(settings.signals.githubPollIntervalMs).toBe(60_000);
    expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
    expect(ctx.showInfo).toHaveBeenCalledWith(
      'GitHub polling interval set to 1m. Restart MastraCode for this to take effect.',
    );
  });

  it('shows custom current GitHub poll intervals in the poll interval modal', async () => {
    const { ctx } = createContext();
    const settings = { signals: { experimentalGithubSignals: true, githubPollIntervalMs: 45_000 } };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.askModalQuestion.mockResolvedValueOnce('Poll interval').mockResolvedValueOnce(null);

    await handleGithubCommand(ctx, []);

    expect(mocks.askModalQuestion).toHaveBeenNthCalledWith(
      2,
      ctx.state.ui,
      expect.objectContaining({
        question: 'GitHub polling interval (current: 45s)',
        options: expect.arrayContaining([
          expect.objectContaining({ label: 'Custom', description: 'Enter seconds (current)' }),
        ]),
        selectedOptionLabel: 'Custom',
      }),
    );
    expect(mocks.saveSettings).not.toHaveBeenCalled();
  });

  it('saves a custom GitHub poll interval', async () => {
    const { ctx } = createContext();
    const settings = { signals: { experimentalGithubSignals: true, githubPollIntervalMs: 45_000 } };
    mocks.loadSettings.mockReturnValue(settings);
    mocks.askModalQuestion
      .mockResolvedValueOnce('Poll interval')
      .mockResolvedValueOnce('Custom')
      .mockResolvedValueOnce('75');

    await handleGithubCommand(ctx, []);

    expect(mocks.askModalQuestion).toHaveBeenNthCalledWith(
      2,
      ctx.state.ui,
      expect.objectContaining({
        question: 'GitHub polling interval (current: 45s)',
        selectedOptionLabel: 'Custom',
        options: expect.arrayContaining([
          expect.objectContaining({ label: 'Custom', description: 'Enter seconds (current)' }),
        ]),
      }),
    );
    expect(mocks.askModalQuestion).toHaveBeenNthCalledWith(
      3,
      ctx.state.ui,
      expect.objectContaining({
        question: 'GitHub polling interval in seconds (minimum 10, current: 45s)',
        defaultValue: '45',
      }),
    );
    expect(settings.signals.githubPollIntervalMs).toBe(75_000);
    expect(mocks.saveSettings).toHaveBeenCalledWith(settings);
  });

  it('unsubscribes the only current subscription without prompting', async () => {
    const { ctx, unsubscribeThreadFromPR } = createContext();
    mockThreadSubscriptions(ctx, [{ owner: 'mastra-ai', repo: 'mastra', number: 17447 }]);

    await handleGithubCommand(ctx, ['unsubscribe']);

    expect(mocks.askModalQuestion).not.toHaveBeenCalled();
    expect(unsubscribeThreadFromPR).toHaveBeenCalledWith({
      threadId: 'thread-1',
      resourceId: 'resource-1',
      pr: { owner: 'mastra-ai', repo: 'mastra', number: 17447 },
    });
  });

  it('syncs GitHub subscriptions for the current thread', async () => {
    const { ctx, sendSignal, syncThreadNow } = createContext();
    vi.mocked((ctx.state.session as any).thread.list).mockResolvedValue([
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
    vi.mocked((ctx.state.session as any).thread.list).mockResolvedValue([
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
