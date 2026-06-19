import { beforeEach, describe, expect, it, vi } from 'vitest';

import { handleSlackCommand } from '../slack.js';
import type { SlashCommandContext } from '../types.js';

const askModalQuestionMock = vi.fn();
const loadSettingsMock = vi.fn();
const saveSettingsMock = vi.fn();

vi.mock('../../../onboarding/settings.js', () => ({
  loadSettings: () => loadSettingsMock(),
  saveSettings: (settings: unknown) => saveSettingsMock(settings),
}));

vi.mock('../../modal-question.js', () => ({
  askModalQuestion: (...args: unknown[]) => askModalQuestionMock(...args),
}));

function createContext(overrides?: {
  slackSignals?: Record<string, unknown> | null;
  threadMetadata?: Record<string, unknown>;
  storedToken?: string | null;
}) {
  const subscribeThreadToSlack = vi.fn(async () => ({
    workspaceId: 'T123456',
    workspaceName: 'Test Workspace',
    alreadySubscribed: false,
  }));
  const unsubscribeThreadFromSlack = vi.fn(async () => ({
    workspaceId: 'T123456',
    workspaceName: 'Test Workspace',
    removed: true,
  }));

  const slackSignals = overrides?.slackSignals === null
    ? undefined
    : {
        pollInterval: 60_000,
        subscribeThreadToSlack,
        unsubscribeThreadFromSlack,
        ...overrides?.slackSignals,
      };

  const getStoredApiKey = vi.fn(() => overrides?.storedToken ?? undefined);
  const setStoredApiKey = vi.fn();
  const removeApiKey = vi.fn();

  const ctx = {
    state: {
      ui: { requestRender: vi.fn() },
      options: slackSignals ? { slackSignals } : {},
      activeSlackSubscription: undefined as { workspaceId: string; workspaceName?: string; conversationTypes: string[]; channelCount: number } | undefined,
    },
    harness: {
      session: {
        identity: { getResourceId: vi.fn(() => 'resource-1') },
        thread: {
          getId: vi.fn(() => 'thread-1'),
          list: vi.fn(async () => [
            {
              id: 'thread-1',
              resourceId: 'resource-1',
              metadata: overrides?.threadMetadata,
            },
          ]),
        },
      },
    },
    authStorage: {
      getStoredApiKey,
      setStoredApiKey,
      remove: removeApiKey,
    },
    showInfo: vi.fn(),
    showError: vi.fn(),
    updateStatusLine: vi.fn(),
  } as unknown as SlashCommandContext;
  return { ctx, subscribeThreadToSlack, unsubscribeThreadFromSlack, getStoredApiKey, setStoredApiKey, removeApiKey };
}

describe('handleSlackCommand', () => {
  beforeEach(() => {
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue({ signals: { experimentalSlackSignals: true, slackPollIntervalMs: 60_000 } });
    saveSettingsMock.mockReset();
    askModalQuestionMock.mockReset();
    askModalQuestionMock.mockReset();
  });

  it('subscribes the current thread to Slack', async () => {
    const { ctx, subscribeThreadToSlack } = createContext();

    await handleSlackCommand(ctx, ['subscribe']);

    expect(subscribeThreadToSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(ctx.showInfo).toHaveBeenCalledWith('Subscribed this thread to Slack workspace Test Workspace.');
  });

  it('supports the "sub" alias', async () => {
    const { ctx, subscribeThreadToSlack } = createContext();

    await handleSlackCommand(ctx, ['sub']);

    expect(subscribeThreadToSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
  });

  it('shows already-subscribed message when re-subscribing', async () => {
    const { ctx } = createContext({
      slackSignals: {
        subscribeThreadToSlack: vi.fn(async () => ({
          workspaceId: 'T123456',
          workspaceName: 'Test Workspace',
          alreadySubscribed: true,
        })),
      },
    });

    await handleSlackCommand(ctx, ['subscribe']);

    expect(ctx.showInfo).toHaveBeenCalledWith('This thread is already subscribed to Slack workspace Test Workspace.');
  });

  it('unsubscribes the current thread from Slack', async () => {
    const { ctx, unsubscribeThreadFromSlack } = createContext();

    await handleSlackCommand(ctx, ['unsubscribe']);

    expect(unsubscribeThreadFromSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(ctx.showInfo).toHaveBeenCalledWith('Unsubscribed this thread from Slack workspace Test Workspace.');
  });

  it('updates statusline badge immediately on subscribe', async () => {
    const { ctx } = createContext();

    await handleSlackCommand(ctx, ['subscribe']);

    expect(ctx.state.activeSlackSubscription).toEqual({
      workspaceId: 'T123456',
      workspaceName: 'Test Workspace',
      conversationTypes: [],
      channelCount: 0,
    });
    expect(ctx.updateStatusLine).toHaveBeenCalled();
  });

  it('clears statusline badge immediately on unsubscribe', async () => {
    const { ctx } = createContext();

    await handleSlackCommand(ctx, ['unsubscribe']);

    expect(ctx.state.activeSlackSubscription).toBeUndefined();
    expect(ctx.updateStatusLine).toHaveBeenCalled();
  });

  it('supports the "unsub" alias', async () => {
    const { ctx, unsubscribeThreadFromSlack } = createContext();

    await handleSlackCommand(ctx, ['unsub']);

    expect(unsubscribeThreadFromSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
  });

  it('shows not-subscribed message when unsubscribing without a subscription', async () => {
    const { ctx } = createContext({
      slackSignals: {
        unsubscribeThreadFromSlack: vi.fn(async () => ({
          workspaceId: 'T123456',
          workspaceName: 'Test Workspace',
          removed: false,
        })),
      },
    });

    await handleSlackCommand(ctx, ['unsubscribe']);

    expect(ctx.showInfo).toHaveBeenCalledWith('This thread is not subscribed to Slack.');
  });

  it('shows config info with no subscription', async () => {
    const { ctx } = createContext();

    await handleSlackCommand(ctx, ['config']);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('not subscribed'));
  });

  it('shows config info with an active subscription', async () => {
    const { ctx } = createContext({
      threadMetadata: {
        mastra: {
          slackSignals: {
            subscription: {
              workspaceId: 'T123456',
              workspaceName: 'My Team',
              conversationTypes: ['public_channel', 'im'],
              subscribedAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              lastSubscribeSignalId: 'sig-1',
              channels: {
                C001: { latestTs: '1700000000.000000' },
                D001: { latestTs: '1700000001.000000' },
              },
              lastSyncAt: '2024-01-02T00:00:00.000Z',
              lastSyncStatus: 'success',
            },
          },
        },
      },
    });

    await handleSlackCommand(ctx, ['config']);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('My Team'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Channels tracked: 2'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('public_channel, im'));
  });

  it('defaults to config when no action is provided', async () => {
    const { ctx } = createContext();

    await handleSlackCommand(ctx, []);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('not subscribed'));
  });

  it('shows usage hint for unknown subcommands', async () => {
    const { ctx } = createContext();

    await handleSlackCommand(ctx, ['bogus']);

    expect(ctx.showError).toHaveBeenCalledWith('Usage: /slack subscribe, /slack unsubscribe, /slack config, /slack token, /slack poll');
  });

  it('shows error when experimental Slack signals are disabled', async () => {
    const { ctx } = createContext();
    loadSettingsMock.mockReturnValue({ signals: { experimentalSlackSignals: false } });

    await handleSlackCommand(ctx, ['subscribe']);

    expect(ctx.showError).toHaveBeenCalledWith(
      'Experimental Slack signals are disabled. Enable them in /settings and restart MastraCode.',
    );
  });

  it('shows error when slack signals processor is not available', async () => {
    const { ctx } = createContext({ slackSignals: null });

    await handleSlackCommand(ctx, ['subscribe']);

    expect(ctx.showError).toHaveBeenCalledWith(
      'Slack signals are not available. Enable them in /settings and restart MastraCode.',
    );
  });

  it('shows error when there is no current thread', async () => {
    const ctx = {
      state: {
        ui: { requestRender: vi.fn() },
        options: { slackSignals: { subscribeThreadToSlack: vi.fn() } },
      },
      harness: {
        session: {
          identity: { getResourceId: vi.fn(() => 'resource-1') },
          thread: { getId: vi.fn(() => undefined), list: vi.fn(async () => []) },
        },
      },
      showInfo: vi.fn(),
      showError: vi.fn(),
    } as unknown as SlashCommandContext;

    await handleSlackCommand(ctx, ['subscribe']);

    expect(ctx.showError).toHaveBeenCalledWith('Slack subscribe requires a current thread.');
  });

  it('handles subscribe errors gracefully', async () => {
    const { ctx } = createContext({
      slackSignals: {
        subscribeThreadToSlack: vi.fn(async () => {
          throw new Error('auth failed');
        }),
      },
    });

    await handleSlackCommand(ctx, ['subscribe']);

    expect(ctx.showError).toHaveBeenCalledWith('Failed to subscribe to Slack: auth failed');
  });

  it('handles unsubscribe errors gracefully', async () => {
    const { ctx } = createContext({
      slackSignals: {
        unsubscribeThreadFromSlack: vi.fn(async () => {
          throw new Error('network error');
        }),
      },
    });

    await handleSlackCommand(ctx, ['unsubscribe']);

    expect(ctx.showError).toHaveBeenCalledWith('Failed to unsubscribe from Slack: network error');
  });

  it('shows token status in config when no token is configured', async () => {
    const { ctx } = createContext({ storedToken: null });

    await handleSlackCommand(ctx, ['config']);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Token: not configured'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('use /slack token'));
  });

  it('shows masked token in config when token is stored', async () => {
    const { ctx } = createContext({ storedToken: 'xoxp-1234567890abcdef' });

    await handleSlackCommand(ctx, ['config']);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Token: xoxp-'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('(stored)'));
  });

  it('saves a new token via /slack token when none exists', async () => {
    const { ctx, setStoredApiKey } = createContext({ storedToken: null });
    askModalQuestionMock.mockResolvedValue('xoxp-my-new-token');

    await handleSlackCommand(ctx, ['token']);

    expect(setStoredApiKey).toHaveBeenCalledWith('slack-signals', 'xoxp-my-new-token', 'SLACK_USER_TOKEN');
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Slack token saved'));
  });

  it('rejects invalid token via /slack token when none exists', async () => {
    const { ctx, setStoredApiKey } = createContext({ storedToken: null });
    askModalQuestionMock.mockResolvedValue('not-a-token');

    await handleSlackCommand(ctx, ['token']);

    expect(setStoredApiKey).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith('A valid Slack user token (starting with xoxp-) is required.');
  });

  it('updates an existing token via /slack token', async () => {
    const { ctx, setStoredApiKey } = createContext({ storedToken: 'xoxp-old-token' });
    askModalQuestionMock
      .mockResolvedValueOnce('Update token')
      .mockResolvedValueOnce('xoxp-new-token-value');

    await handleSlackCommand(ctx, ['token']);

    expect(setStoredApiKey).toHaveBeenCalledWith('slack-signals', 'xoxp-new-token-value', 'SLACK_USER_TOKEN');
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Slack token updated'));
  });

  it('clears an existing token via /slack token', async () => {
    const { ctx, removeApiKey } = createContext({ storedToken: 'xoxp-old-token' });
    askModalQuestionMock.mockResolvedValueOnce('Clear token');

    await handleSlackCommand(ctx, ['token']);

    expect(removeApiKey).toHaveBeenCalledWith('apikey:slack-signals');
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Slack token cleared'));
  });

  it('does nothing when token modal is cancelled', async () => {
    const { ctx, setStoredApiKey, removeApiKey } = createContext({ storedToken: 'xoxp-old-token' });
    askModalQuestionMock.mockResolvedValueOnce(null);

    await handleSlackCommand(ctx, ['token']);

    expect(setStoredApiKey).not.toHaveBeenCalled();
    expect(removeApiKey).not.toHaveBeenCalled();
  });

  it('changes poll interval via /slack poll with preset choice', async () => {
    const { ctx } = createContext();
    askModalQuestionMock.mockResolvedValueOnce('30s');

    await handleSlackCommand(ctx, ['poll']);

    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ signals: expect.objectContaining({ slackPollIntervalMs: 30_000 }) }),
    );
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('30s'));
  });

  it('changes poll interval via /slack poll with custom seconds', async () => {
    const { ctx } = createContext();
    askModalQuestionMock.mockResolvedValueOnce('Custom').mockResolvedValueOnce('90');

    await handleSlackCommand(ctx, ['poll']);

    expect(saveSettingsMock).toHaveBeenCalledWith(
      expect.objectContaining({ signals: expect.objectContaining({ slackPollIntervalMs: 90_000 }) }),
    );
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('1.5m'));
  });

  it('rejects custom poll interval outside valid range', async () => {
    const { ctx } = createContext();
    askModalQuestionMock.mockResolvedValueOnce('Custom').mockResolvedValueOnce('5');

    await handleSlackCommand(ctx, ['poll']);

    expect(saveSettingsMock).not.toHaveBeenCalled();
    expect(ctx.showError).toHaveBeenCalledWith(expect.stringContaining('between 10 and 3600'));
  });

  it('does nothing when poll interval modal is cancelled', async () => {
    const { ctx } = createContext();
    askModalQuestionMock.mockResolvedValueOnce(null);

    await handleSlackCommand(ctx, ['poll']);

    expect(saveSettingsMock).not.toHaveBeenCalled();
  });

  it('shows poll interval in config output when not subscribed', async () => {
    const { ctx } = createContext({ threadMetadata: undefined });
    loadSettingsMock.mockReturnValue({ signals: { experimentalSlackSignals: true, slackPollIntervalMs: 120_000 } });

    await handleSlackCommand(ctx, ['config']);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Poll interval: 2m'));
  });
});