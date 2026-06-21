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
    addedChannels: ['general'],
    subscription: { conversationTypes: ['public_channel', 'im'], channels: { C001: { id: 'C001', name: 'general', type: 'public_channel' } } },
  }));
  const unsubscribeThreadFromSlack = vi.fn(async () => ({
    workspaceId: 'T123456',
    workspaceName: 'Test Workspace',
    removed: true,
  }));
  const listAvailableChannels = vi.fn(async () => [
    { id: 'C001', name: 'general', type: 'public_channel' },
    { id: 'C002', name: 'random', type: 'public_channel' },
    { id: 'D001', name: 'Sam', type: 'im' },
    { id: 'G001', name: 'project dm', type: 'mpim' },
  ]);

  const slackSignals = overrides?.slackSignals === null
    ? undefined
    : {
        isPollingThread: vi.fn(() => false),
        pollInterval: 60_000,
        subscribeThreadToSlack,
        unsubscribeThreadFromSlack,
        listAvailableChannels,
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
  return { ctx, subscribeThreadToSlack, unsubscribeThreadFromSlack, listAvailableChannels, getStoredApiKey, setStoredApiKey, removeApiKey };
}

describe('handleSlackCommand', () => {
  beforeEach(() => {
    loadSettingsMock.mockReset();
    loadSettingsMock.mockReturnValue({ signals: { experimentalSlackSignals: true } });
    saveSettingsMock.mockReset();
    askModalQuestionMock.mockReset();
    askModalQuestionMock.mockReset();
  });

  it('subscribes to a Slack channel by name', async () => {
    const { ctx, subscribeThreadToSlack } = createContext();

    await handleSlackCommand(ctx, ['subscribe', '#general']);

    expect(subscribeThreadToSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1', channels: ['general'] });
    expect(ctx.showInfo).toHaveBeenCalledWith('Added 1 channel(s): #general');
  });

  it('supports the "sub" alias', async () => {
    const { ctx, subscribeThreadToSlack } = createContext();

    await handleSlackCommand(ctx, ['sub', 'random']);

    expect(subscribeThreadToSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1', channels: ['random'] });
  });

  it('shows already-subscribed message when re-subscribing', async () => {
    const { ctx } = createContext({
      slackSignals: {
        subscribeThreadToSlack: vi.fn(async () => ({
          workspaceId: 'T123456',
          workspaceName: 'Test Workspace',
          alreadySubscribed: true,
          subscription: { conversationTypes: [], channels: {} },
        })),
      },
    });

    await handleSlackCommand(ctx, ['subscribe', '#general']);

    expect(ctx.showInfo).toHaveBeenCalledWith('No new channels added (already subscribed).');
  });

  it('unsubscribes the current thread from Slack', async () => {
    const { ctx, unsubscribeThreadFromSlack } = createContext();

    await handleSlackCommand(ctx, ['unsubscribe']);

    expect(unsubscribeThreadFromSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1' });
    expect(ctx.showInfo).toHaveBeenCalledWith('Unsubscribed this thread from Slack workspace Test Workspace.');
  });

  it('updates statusline badge immediately on subscribe', async () => {
    const { ctx } = createContext();

    await handleSlackCommand(ctx, ['subscribe', '#general']);

    expect(ctx.state.activeSlackSubscription).toEqual({
      workspaceId: 'T123456',
      workspaceName: 'Test Workspace',
      conversationTypes: ['public_channel', 'im'],
      channelCount: 1,
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
                C001: { id: 'C001', type: 'public_channel', subscribedAt: '2024-01-01T00:00:00.000Z', latestTs: '1700000000.000000' },
                D001: { id: 'D001', type: 'im', subscribedAt: '2024-01-01T00:00:00.000Z', latestTs: '1700000001.000000' },
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
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Polling: inactive'));
  });

  it('shows action menu when no action is provided', async () => {
    const { ctx } = createContext();
    askModalQuestionMock.mockResolvedValue(null);

    await handleSlackCommand(ctx, []);

    expect(askModalQuestionMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ question: expect.stringContaining('what would you like to do?') }),
    );
  });

  it('shows debug info when not subscribed', async () => {
    const { ctx } = createContext({ threadMetadata: undefined });

    await handleSlackCommand(ctx, ['debug']);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('not subscribed'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('pollInterval=60s'));
  });

  it('shows debug info with subscription details', async () => {
    const { ctx } = createContext({
      threadMetadata: {
        mastra: {
          slackSignals: {
            subscription: {
              workspaceId: 'T123',
              workspaceName: 'Test Workspace',
              conversationTypes: ['public_channel', 'im'],
              subscribedAt: '2024-01-01T00:00:00.000Z',
              updatedAt: '2024-01-01T00:00:00.000Z',
              lastSubscribeSignalId: 'sig-1',
              channels: {
                C001: { id: 'C001', name: 'general', type: 'public_channel', subscribedAt: '2024-01-01T00:00:00.000Z', latestTs: '1700000000.000000', lastSyncStatus: 'success' },
              },
            },
          },
        },
      },
    });

    await handleSlackCommand(ctx, ['debug']);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Test Workspace'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Poll interval: 60s'));
  });

  it('updates Slack poll interval from /slack poll', async () => {
    const { ctx } = createContext();
    loadSettingsMock.mockReturnValue({ signals: { experimentalSlackSignals: true, slackPollIntervalMs: 60_000 } });
    askModalQuestionMock.mockResolvedValue('30s');

    await handleSlackCommand(ctx, ['poll']);

    expect(saveSettingsMock).toHaveBeenCalledWith({
      signals: { experimentalSlackSignals: true, slackPollIntervalMs: 30_000 },
    });
    expect(ctx.showInfo).toHaveBeenCalledWith('Slack poll interval set to 30s. Restart MastraCode for the new interval to take effect.');
  });

  it('shows usage hint for unknown subcommands', async () => {
    const { ctx } = createContext();

    await handleSlackCommand(ctx, ['bogus']);

    expect(ctx.showError).toHaveBeenCalledWith('Usage: /slack subscribe [#channel...], /slack unsubscribe [#channel...], /slack channels, /slack config, /slack token, /slack poll, /slack debug');
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

    await handleSlackCommand(ctx, ['subscribe', '#general']);

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

  it('shows polling state in config output when not subscribed', async () => {
    const { ctx } = createContext({ threadMetadata: undefined });

    await handleSlackCommand(ctx, ['config']);

    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Polling: inactive'));
  });

  it('subscribes to specific channels when channel args provided', async () => {
    const subscribeThreadToSlack = vi.fn(async () => ({
      workspaceId: 'T123456',
      workspaceName: 'Test Workspace',
      addedChannels: ['general', 'random'],
      subscription: { conversationTypes: ['public_channel'], channels: { C001: {}, C002: {} } },
    }));
    const { ctx } = createContext({
      slackSignals: { subscribeThreadToSlack },
    });

    await handleSlackCommand(ctx, ['subscribe', 'general', 'random']);

    expect(subscribeThreadToSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1', channels: ['general', 'random'] });
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Added 2 channel(s)'));
  });

  it('strips # prefix from channel args', async () => {
    const { ctx, subscribeThreadToSlack } = createContext();

    await handleSlackCommand(ctx, ['subscribe', '#general']);

    expect(subscribeThreadToSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1', channels: ['general'] });
  });

  it('unsubscribes from specific channels when channel args provided', async () => {
    const unsubscribeThreadFromSlack = vi.fn(async () => ({
      workspaceId: 'T123456',
      workspaceName: 'Test Workspace',
      removedChannels: ['general'],
      subscription: { conversationTypes: ['public_channel'], channels: { C002: {} } },
    }));
    const { ctx } = createContext({
      slackSignals: { unsubscribeThreadFromSlack },
    });

    await handleSlackCommand(ctx, ['unsubscribe', 'general']);

    expect(unsubscribeThreadFromSlack).toHaveBeenCalledWith({ threadId: 'thread-1', resourceId: 'resource-1', channels: ['general'] });
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Removed 1 channel(s)'));
  });

  it('lists available channels', async () => {
    const { ctx, listAvailableChannels } = createContext();

    await handleSlackCommand(ctx, ['channels']);

    expect(listAvailableChannels).toHaveBeenCalled();
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('Types: channels 2, private 0, DMs 1, group DMs 1'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('#general'));
    expect(ctx.showInfo).toHaveBeenCalledWith(expect.stringContaining('#random'));
  });

  it('supports "list" alias for channels', async () => {
    const { ctx, listAvailableChannels } = createContext();

    await handleSlackCommand(ctx, ['list']);

    expect(listAvailableChannels).toHaveBeenCalled();
  });
});