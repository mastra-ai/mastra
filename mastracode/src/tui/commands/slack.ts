import { getSlackSignalsMetadata } from '@mastra/slack-signals';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { askModalQuestion } from '../modal-question.js';
import { SlackChannelPickerComponent } from '../components/slack-channel-picker.js';
import type { SlashCommandContext } from './types.js';

type SlackSignalsConversation = {
  id: string;
  name?: string;
  type: string;
  isArchived?: boolean;
  isMember?: boolean;
  user?: string;
};

function formatLocalTimestamp(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'medium',
    hour12: true,
  }).format(date);
}

async function getCurrentSlackThread(ctx: SlashCommandContext): Promise<{
  threadId?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}> {
  const harness = ctx.harness as unknown as {
    session?: {
      identity?: {
        getResourceId?: () => string | undefined;
      };
      thread?: {
        getId?: () => string | undefined;
        list?: (input?: {
          allResources?: boolean;
        }) => Promise<Array<{ id: string; resourceId?: string; metadata?: Record<string, unknown> }>>;
      };
    };
  };
  const threadId = harness.session?.thread?.getId?.();
  if (!threadId) return {};

  const thread = (await harness.session?.thread?.list?.({ allResources: true }))?.find(item => item.id === threadId);
  return {
    threadId,
    resourceId: thread?.resourceId ?? harness.session?.identity?.getResourceId?.(),
    metadata: thread?.metadata,
  };
}

function getSlackSubscriptionFromThreadMetadata(metadata: Record<string, unknown> | undefined) {
  return getSlackSignalsMetadata(metadata).subscription;
}

function maskToken(token: string): string {
  if (token.length <= 10) return 'xoxp-•••';
  return `${token.slice(0, 8)}${'•'.repeat(6)}${token.slice(-4)}`;
}

function getTokenSource(ctx: SlashCommandContext): { token: string | undefined; source: 'stored' | 'env' | 'none' } {
  const stored = ctx.authStorage?.getStoredApiKey('slack-signals');
  if (stored) return { token: stored, source: 'stored' };
  if (process.env.SLACK_USER_TOKEN) return { token: process.env.SLACK_USER_TOKEN, source: 'env' };
  return { token: undefined, source: 'none' };
}

async function describeSlackSubscription(ctx: SlashCommandContext): Promise<string> {
  const { threadId, resourceId, metadata } = await getCurrentSlackThread(ctx);
  if (!threadId) return 'Slack Signals: no current thread.';

  const { token, source } = getTokenSource(ctx);
  const tokenLine = token
    ? `Token: ${maskToken(token)} (${source})`
    : 'Token: not configured — use /slack token to set it';

  const subscription = getSlackSubscriptionFromThreadMetadata(metadata);
  const slackSignalsProcessor = ctx.state.options?.slackSignals;
  const isPolling = resourceId ? (slackSignalsProcessor?.isPollingThread?.({ threadId, resourceId }) ?? false) : false;
  const pollInterval = slackSignalsProcessor?.pollInterval ? `${Math.round(slackSignalsProcessor.pollInterval / 1000)}s` : '60s';

  if (!subscription) {
    return `Slack Signals for ${threadId}: not subscribed.
  ${tokenLine}
  Polling: ${isPolling ? `active (${pollInterval})` : 'inactive'}
  Use /slack subscribe #channel to start watching channels.`;
  }

  const channels = Object.entries(subscription.channels ?? {});
  const channelLines = channels.length === 0
    ? '  Channels: none — use /slack subscribe #channel to add channels'
    : channels.map(([id, ch]) => {
        const channel = ch as Record<string, unknown>;
        const name = channel.name ? `#${channel.name}` : id;
        const latestTs = channel.latestTs ? `latest: ${channel.latestTs}` : 'baseline pending';
        const status = channel.lastSyncStatus === 'error' ? ` ⚠ ${channel.lastSyncError}` : '';
        return `    ${name} — ${latestTs}${status}`;
      }).join('\n');

  const header = `Slack Signals for ${threadId}:
  Workspace: ${subscription.workspaceName ?? subscription.workspaceId}
  Channels tracked: ${channels.length}
  Polling: ${isPolling ? `active (${pollInterval})` : 'inactive'}
  Subscribed at: ${formatLocalTimestamp(subscription.subscribedAt) ?? 'unknown'}
  Last sync: ${subscription.lastSyncAt ? formatLocalTimestamp(subscription.lastSyncAt) : 'never'}${subscription.lastSyncStatus ? ` (${subscription.lastSyncStatus})` : ''}
  ${tokenLine}
${channelLines}`;

  return header;
}

function parseChannelArgs(args: string[]): string[] | undefined {
  if (args.length === 0) return undefined;
  return args.map(arg => arg.replace(/^#/, '').trim()).filter(Boolean);
}

function getConversationTypeLabel(type: string | undefined): string {
  return type === 'im' ? 'DM' : type === 'mpim' ? 'group DM' : type === 'private_channel' ? 'private' : 'public';
}

function getConversationLabel(conversation: Pick<SlackSignalsConversation, 'id' | 'name' | 'type'>): string {
  const name = conversation.name ?? conversation.id;
  return conversation.type === 'im' || conversation.type === 'mpim' ? name : `#${name}`;
}

function getConversationTypeCounts(conversations: SlackSignalsConversation[]): string {
  const counts = conversations.reduce(
    (acc, conversation) => {
      if (conversation.type === 'public_channel') acc.channels += 1;
      else if (conversation.type === 'private_channel') acc.privateChannels += 1;
      else if (conversation.type === 'im') acc.dms += 1;
      else if (conversation.type === 'mpim') acc.groupDms += 1;
      else acc.unknown += 1;
      return acc;
    },
    { channels: 0, privateChannels: 0, dms: 0, groupDms: 0, unknown: 0 },
  );

  const parts = [
    `channels ${counts.channels}`,
    `private ${counts.privateChannels}`,
    `DMs ${counts.dms}`,
    `group DMs ${counts.groupDms}`,
  ];
  if (counts.unknown > 0) parts.push(`unknown ${counts.unknown}`);
  return parts.join(', ');
}

async function pickSlackConversations(ctx: SlashCommandContext): Promise<SlackSignalsConversation[] | undefined> {
  const slackSignalsProcessor = ctx.state.options?.slackSignals;
  if (!slackSignalsProcessor?.listAvailableChannels) {
    ctx.showError('Slack signals are not available. Enable them in /settings and restart MastraCode.');
    return undefined;
  }

  // Gather subscribed channel IDs for this thread
  const { metadata } = await getCurrentSlackThread(ctx);
  const subscription = getSlackSubscriptionFromThreadMetadata(metadata);
  const subscribedIds = new Set(Object.keys(subscription?.channels ?? {}));

  return new Promise(resolve => {
    let done = false;
    const finish = (selected: SlackSignalsConversation[] | undefined) => {
      if (done) return;
      done = true;
      ctx.state.ui.hideOverlay();
      resolve(selected);
    };

    const picker = new SlackChannelPickerComponent({
      tui: ctx.state.ui,
      conversations: [],
      subscribedIds,
      title: 'Subscribe to Slack Conversation',
      loadingMessage: 'Loading Slack conversations...',
      onConfirm: finish,
      onCancel: () => finish(undefined),
    });

    ctx.state.ui.showOverlay(picker, {
      width: '70%',
      maxHeight: '65%',
      anchor: 'center',
    });
    picker.focused = true;

    slackSignalsProcessor.listAvailableChannels()
      .then((conversations: SlackSignalsConversation[]) => {
        if (done) return;
        if (!conversations || conversations.length === 0) {
          ctx.showInfo('No channels or DMs found. Check your token scopes.');
          finish(undefined);
          return;
        }
        picker.setConversations(conversations);
      })
      .catch((err: unknown) => {
        if (done) return;
        ctx.showError(`Failed to list Slack channels: ${err instanceof Error ? err.message : String(err)}`);
        finish(undefined);
      });
  });
}

async function pickSubscribedSlackChannel(ctx: SlashCommandContext): Promise<string[] | undefined> {
  const { metadata } = await getCurrentSlackThread(ctx);
  const subscription = getSlackSubscriptionFromThreadMetadata(metadata);
  const channels = Object.values(subscription?.channels ?? {});
  if (channels.length === 0) {
    ctx.showInfo('This thread has no Slack channels or DMs to unsubscribe.');
    return undefined;
  }

  const choices = channels.map(channel => ({
    label: getConversationLabel(channel),
    description: `${getConversationTypeLabel(channel.type)} — ${channel.id}`,
  }));
  const answer = await askModalQuestion(ctx.state.ui, {
    question: 'Unsubscribe this thread from which Slack channel or DM?',
    options: choices,
    allowCustomResponse: true,
    allowEmptyInput: false,
    overlay: { widthPercent: 0.75, maxHeight: '75%' },
  });
  const trimmed = answer?.replace(/^#/, '').trim();
  if (!trimmed) return undefined;

  const match = channels.find(channel => channel.id === trimmed || channel.name === trimmed || getConversationLabel(channel).replace(/^#/, '') === trimmed);
  return [match?.id ?? trimmed];
}

async function subscribeSlackThread(ctx: SlashCommandContext, channelArgs: string[]): Promise<void> {
  const slackSignalsProcessor = ctx.state.options?.slackSignals;
  if (!slackSignalsProcessor?.subscribeThreadToSlack) {
    ctx.showError('Slack signals are not available. Enable them in /settings and restart MastraCode.');
    return;
  }

  const { threadId, resourceId } = await getCurrentSlackThread(ctx);
  if (!threadId || !resourceId) {
    ctx.showError('Slack subscribe requires a current thread.');
    return;
  }

  let channels = parseChannelArgs(channelArgs);
  if (!channels || channels.length === 0) {
    const selected = await pickSlackConversations(ctx);
    if (!selected || selected.length === 0) return;
    channels = selected.map(c => c.id);
  }

  try {
    const result = await slackSignalsProcessor.subscribeThreadToSlack({ threadId, resourceId, channels });

    if (channels && channels.length > 0) {
      if (result.addedChannels?.length) {
        ctx.showInfo(`Added ${result.addedChannels.length} channel(s): ${result.addedChannels.map((c: string) => `#${c}`).join(', ')}`);
      } else {
        ctx.showInfo('No new channels added (already subscribed).');
      }
    } else if (result.alreadySubscribed) {
      ctx.showInfo(`This thread is already subscribed to Slack workspace ${result.workspaceName ?? result.workspaceId}. Use /slack subscribe #channel to add channels.`);
    } else {
      ctx.showInfo(`Subscribed this thread to Slack workspace ${result.workspaceName ?? result.workspaceId}. Use /slack subscribe #channel to add channels.`);
    }

    if (result.workspaceId) {
      ctx.state.activeSlackSubscription = {
        workspaceId: result.workspaceId,
        ...(result.workspaceName ? { workspaceName: result.workspaceName } : {}),
        conversationTypes: result.subscription?.conversationTypes ?? [],
        channelCount: Object.keys(result.subscription?.channels ?? {}).length,
      };
      ctx.updateStatusLine();
    }
  } catch (error) {
    ctx.showError(`Failed to subscribe to Slack: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function unsubscribeSlackThread(ctx: SlashCommandContext, channelArgs: string[]): Promise<void> {
  const slackSignalsProcessor = ctx.state.options?.slackSignals;
  if (!slackSignalsProcessor?.unsubscribeThreadFromSlack) {
    ctx.showError('Slack signals are not available. Enable them in /settings and restart MastraCode.');
    return;
  }

  const { threadId, resourceId } = await getCurrentSlackThread(ctx);
  if (!threadId || !resourceId) {
    ctx.showError('Slack unsubscribe requires a current thread.');
    return;
  }

  const channels = parseChannelArgs(channelArgs);

  try {
    const result = await slackSignalsProcessor.unsubscribeThreadFromSlack({ threadId, resourceId, channels });

    if (channels && channels.length > 0) {
      if (result.removedChannels?.length) {
        ctx.showInfo(`Removed ${result.removedChannels.length} channel(s): ${result.removedChannels.map((c: string) => `#${c}`).join(', ')}`);
      } else {
        ctx.showInfo('No matching channels found to remove.');
      }
      if (result.subscription) {
        ctx.state.activeSlackSubscription = {
          workspaceId: result.workspaceId ?? '',
          ...(result.workspaceName ? { workspaceName: result.workspaceName } : {}),
          conversationTypes: result.subscription.conversationTypes ?? [],
          channelCount: Object.keys(result.subscription.channels ?? {}).length,
        };
      } else {
        ctx.state.activeSlackSubscription = undefined;
      }
    } else if (result.removed) {
      ctx.showInfo(`Unsubscribed this thread from Slack workspace ${result.workspaceName ?? result.workspaceId}.`);
      ctx.state.activeSlackSubscription = undefined;
    } else {
      ctx.showInfo('This thread is not subscribed to Slack.');
    }
    ctx.updateStatusLine();
  } catch (error) {
    ctx.showError(`Failed to unsubscribe from Slack: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listSlackChannels(ctx: SlashCommandContext): Promise<void> {
  const slackSignalsProcessor = ctx.state.options?.slackSignals;
  if (!slackSignalsProcessor?.listAvailableChannels) {
    ctx.showError('Slack signals are not available. Enable them in /settings and restart MastraCode.');
    return;
  }

  try {
    const conversations = await slackSignalsProcessor.listAvailableChannels();
    if (conversations.length === 0) {
      ctx.showInfo('No channels found. Check your token scopes.');
      return;
    }

    const lines = conversations.slice(0, 50).map((ch: SlackSignalsConversation) => {
      return `  ${getConversationLabel(ch)} (${getConversationTypeLabel(ch.type)}) — ${ch.id}`;
    });

    ctx.showInfo(`Available conversations (${conversations.length} total, showing ${Math.min(50, conversations.length)})\nTypes: ${getConversationTypeCounts(conversations)}\n${lines.join('\n')}`);
  } catch (error) {
    ctx.showError(`Failed to list channels: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function manageSlackToken(ctx: SlashCommandContext): Promise<void> {
  const { token, source } = getTokenSource(ctx);
  const hasToken = Boolean(token);

  const choice = await askModalQuestion(ctx.state.ui, {
    question: hasToken
      ? `Slack token (${source}): ${maskToken(token!)}\n\nUpdate or clear your Slack user token?`
      : 'No Slack token configured.\n\nPaste your Slack user token (starts with xoxp-):',
    options: hasToken
      ? [
          { label: 'Update token', description: 'Paste a new user token' },
          { label: 'Clear token', description: 'Remove the stored token' },
        ]
      : [],
    allowCustomResponse: true,
    allowEmptyInput: !hasToken ? false : true,
    overlay: { widthPercent: 0.85, maxHeight: '75%' },
  });

  if (choice === null) return;

  if (hasToken && choice === 'Clear token') {
    ctx.authStorage?.remove('apikey:slack-signals');
    if (process.env.SLACK_USER_TOKEN) delete process.env.SLACK_USER_TOKEN;
    ctx.showInfo('Slack token cleared. Restart MastraCode for the change to take effect.');
    return;
  }

  if (hasToken && choice === 'Update token') {
    const newToken = await askModalQuestion(ctx.state.ui, {
      question: 'Paste your new Slack user token (starts with xoxp-):',
      allowCustomResponse: true,
      allowEmptyInput: false,
      overlay: { widthPercent: 0.85, maxHeight: '75%' },
    });
    if (!newToken || !newToken.startsWith('xoxp-')) {
      ctx.showError('A valid Slack user token (starting with xoxp-) is required.');
      return;
    }
    ctx.authStorage?.setStoredApiKey('slack-signals', newToken, 'SLACK_USER_TOKEN');
    ctx.showInfo('Slack token updated. Restart MastraCode for the change to take effect.');
    return;
  }

  if (!hasToken && choice.startsWith('xoxp-')) {
    ctx.authStorage?.setStoredApiKey('slack-signals', choice, 'SLACK_USER_TOKEN');
    ctx.showInfo('Slack token saved. Restart MastraCode for Slack signals to use it.');
    return;
  }

  ctx.showError('A valid Slack user token (starting with xoxp-) is required.');
}

function formatPollInterval(ms: number): string {
  if (ms % 60_000 === 0) return `${ms / 60_000}m`;
  if (ms % 1000 === 0) return `${ms / 1000}s`;
  return `${ms}ms`;
}

async function manageSlackPollInterval(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  const current = settings.signals.slackPollIntervalMs ?? 60_000;
  const choice = await askModalQuestion(ctx.state.ui, {
    question: `Slack poll interval is currently ${formatPollInterval(current)}. Choose a new interval:`,
    options: [
      { label: '30s', description: 'Poll selected channels every 30 seconds' },
      { label: '1m', description: 'Poll selected channels every minute' },
      { label: '2m', description: 'Poll selected channels every 2 minutes' },
      { label: '5m', description: 'Poll selected channels every 5 minutes' },
      { label: 'Custom', description: 'Enter seconds manually' },
    ],
    allowCustomResponse: true,
    allowEmptyInput: false,
    overlay: { widthPercent: 0.65, maxHeight: '65%' },
  });

  if (!choice) return;

  const preset: Record<string, number> = {
    '30s': 30_000,
    '1m': 60_000,
    '2m': 120_000,
    '5m': 300_000,
  };
  let next = preset[choice];
  if (!next) {
    const raw = choice === 'Custom'
      ? await askModalQuestion(ctx.state.ui, {
          question: 'Enter Slack poll interval in seconds (minimum 10):',
          allowCustomResponse: true,
          allowEmptyInput: false,
          overlay: { widthPercent: 0.55, maxHeight: '45%' },
        })
      : choice;
    if (!raw) return;
    const seconds = Number(raw.replace(/s$/i, '').trim());
    if (!Number.isFinite(seconds) || seconds < 10) {
      ctx.showError('Slack poll interval must be at least 10 seconds.');
      return;
    }
    next = Math.floor(seconds * 1000);
  }

  settings.signals.slackPollIntervalMs = next;
  saveSettings(settings);
  ctx.showInfo(`Slack poll interval set to ${formatPollInterval(next)}. Restart MastraCode for the new interval to take effect.`);
}

async function showSlackActionMenu(ctx: SlashCommandContext): Promise<void> {
  const choice = await askModalQuestion(ctx.state.ui, {
    question: 'Slack Signals — what would you like to do?',
    options: [
      { label: 'Subscribe', description: 'Choose a Slack channel or DM to watch in this thread' },
      { label: 'Unsubscribe', description: 'Remove a watched channel or DM from this thread' },
      { label: 'List channels', description: 'Show available Slack channels and DMs' },
      { label: 'Config', description: 'Show current Slack subscription state' },
      { label: 'Token', description: 'Update or clear your Slack user token' },
      { label: 'Poll interval', description: 'Change how often selected conversations are checked' },
      { label: 'Debug', description: 'Show detailed Slack signal diagnostics' },
    ],
    overlay: { widthPercent: 0.7, maxHeight: '75%' },
  });

  if (!choice) return;

  if (choice === 'Subscribe') {
    const selected = await pickSlackConversations(ctx);
    if (selected && selected.length > 0) await subscribeSlackThread(ctx, selected.map(c => c.id));
    return;
  }
  if (choice === 'Unsubscribe') {
    const channels = await pickSubscribedSlackChannel(ctx);
    if (channels) await unsubscribeSlackThread(ctx, channels);
    return;
  }
  if (choice === 'List channels') {
    await listSlackChannels(ctx);
    return;
  }
  if (choice === 'Config') {
    ctx.showInfo(await describeSlackSubscription(ctx));
    return;
  }
  if (choice === 'Token') {
    await manageSlackToken(ctx);
    return;
  }
  if (choice === 'Poll interval') {
    await manageSlackPollInterval(ctx);
    return;
  }
  if (choice === 'Debug') {
    ctx.showInfo(await describeSlackDebug(ctx));
  }
}

async function describeSlackDebug(ctx: SlashCommandContext): Promise<string> {
  const { threadId, metadata } = await getCurrentSlackThread(ctx);
  if (!threadId) return 'Slack Signals debug: no current thread.';

  const slackSignalsProcessor = ctx.state.options?.slackSignals;
  const pollInterval = slackSignalsProcessor?.pollInterval ? `${Math.round(slackSignalsProcessor.pollInterval / 1000)}s` : '60s';
  const { token, source } = getTokenSource(ctx);

  const slackMetadata = getSlackSignalsMetadata(metadata);
  const subscription = slackMetadata.subscription;
  if (!subscription) {
    return `Slack Signals debug for ${threadId}: not subscribed, pollInterval=${pollInterval}, token=${token ? source : 'none'}`;
  }

  const channels = Object.entries(subscription.channels ?? {});
  const channelLines = channels.length === 0
    ? '  Channels: none'
    : channels.map(([id, ch]) => {
        const channel = ch as Record<string, unknown>;
        const name = channel.name ? `#${channel.name}` : id;
        const latestTs = channel.latestTs ? `latestTs=${channel.latestTs}` : 'no baseline';
        const lastSync = channel.lastSyncAt ? `lastSync=${formatLocalTimestamp(channel.lastSyncAt)}` : 'never synced';
        const status = channel.lastSyncStatus ? ` (${channel.lastSyncStatus})` : '';
        const error = channel.lastSyncError ? ` err=${channel.lastSyncError}` : '';
        return `    ${name} — ${latestTs}, ${lastSync}${status}${error}`;
      }).join('\n');

  return `Slack Signals debug for ${threadId}:
  Workspace: ${subscription.workspaceName ?? subscription.workspaceId}
  Conversation types: ${subscription.conversationTypes.join(', ') || 'default'}
  Poll interval: ${pollInterval}
  Token: ${token ? `${maskToken(token)} (${source})` : 'none'}
  Subscribed at: ${formatLocalTimestamp(subscription.subscribedAt) ?? 'unknown'}
  Last sync: ${subscription.lastSyncAt ? formatLocalTimestamp(subscription.lastSyncAt) : 'never'}${subscription.lastSyncStatus ? ` (${subscription.lastSyncStatus})` : ''}${subscription.lastSyncError ? `\n  Last error: ${subscription.lastSyncError}` : ''}
${channelLines}`;
}

export async function handleSlackCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  if (!loadSettings().signals.experimentalSlackSignals) {
    ctx.showError('Experimental Slack signals are disabled. Enable them in /settings and restart MastraCode.');
    return;
  }

  const [action, ...rest] = args;

  if (!action) {
    await showSlackActionMenu(ctx);
    return;
  }

  if (action === 'subscribe' || action === 'sub') {
    await subscribeSlackThread(ctx, rest);
    return;
  }
  if (action === 'unsubscribe' || action === 'unsub') {
    await unsubscribeSlackThread(ctx, rest);
    return;
  }
  if (action === 'channels' || action === 'list') {
    await listSlackChannels(ctx);
    return;
  }
  if (action === 'token') {
    await manageSlackToken(ctx);
    return;
  }
  if (action === 'poll') {
    await manageSlackPollInterval(ctx);
    return;
  }
  if (action === 'debug') {
    ctx.showInfo(await describeSlackDebug(ctx));
    return;
  }
  if (action === 'config' || action === 'status') {
    ctx.showInfo(await describeSlackSubscription(ctx));
    return;
  }

  ctx.showError('Usage: /slack subscribe [#channel...], /slack unsubscribe [#channel...], /slack channels, /slack config, /slack token, /slack poll, /slack debug');
}
