import { getSlackSignalsMetadata } from '@mastra/slack-signals';
import { loadSettings, saveSettings } from '../../onboarding/settings.js';
import { askModalQuestion } from '../modal-question.js';
import type { SlashCommandContext } from './types.js';

function formatPollInterval(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = seconds / 60;
  return `${minutes}m`;
}

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
  // getSlackSignalsMetadata expects the full thread metadata and extracts
  // mastra.slackSignals internally — don't pre-extract the key.
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
  const { threadId, metadata } = await getCurrentSlackThread(ctx);
  if (!threadId) return 'Slack Signals: no current thread.';

  const { token, source } = getTokenSource(ctx);
  const tokenLine = token
    ? `Token: ${maskToken(token)} (${source})`
    : 'Token: not configured — use /slack token to set it';

  const subscription = getSlackSubscriptionFromThreadMetadata(metadata);
  const settingsPollMs = loadSettings().signals.slackPollIntervalMs;
  if (!subscription) {
    return `Slack Signals for ${threadId}: not subscribed.
  ${tokenLine}
  Poll interval: ${formatPollInterval(settingsPollMs)} (change with /slack poll)`;
  }

  const slackSignalsProcessor = ctx.state.options?.slackSignals;
  const pollIntervalMs = slackSignalsProcessor?.pollInterval ?? settingsPollMs;
  const channelCount = Object.keys(subscription.channels ?? {}).length;

  const header = `Slack Signals for ${threadId}:
  Workspace: ${subscription.workspaceName ?? subscription.workspaceId}
  Conversation types: ${subscription.conversationTypes?.join(', ') ?? 'default'}
  Channels tracked: ${channelCount}
  Subscribed at: ${formatLocalTimestamp(subscription.subscribedAt) ?? 'unknown'}
  Last sync: ${subscription.lastSyncAt ? formatLocalTimestamp(subscription.lastSyncAt) : 'never'}${subscription.lastSyncStatus ? ` (${subscription.lastSyncStatus})` : ''}${subscription.lastSyncError ? `\n  Last error: ${subscription.lastSyncError}` : ''}
  Poll interval: ${formatPollInterval(pollIntervalMs)} (change with /slack poll)
  ${tokenLine}`;

  return header;
}

async function subscribeSlackThread(ctx: SlashCommandContext): Promise<void> {
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

  try {
    const result = await slackSignalsProcessor.subscribeThreadToSlack({ threadId, resourceId });
    if (result.alreadySubscribed) {
      ctx.showInfo(`This thread is already subscribed to Slack workspace ${result.workspaceName ?? result.workspaceId}.`);
    } else {
      ctx.showInfo(`Subscribed this thread to Slack workspace ${result.workspaceName ?? result.workspaceId}.`);
    }
    // Update statusline badge immediately
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

async function unsubscribeSlackThread(ctx: SlashCommandContext): Promise<void> {
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

  try {
    const result = await slackSignalsProcessor.unsubscribeThreadFromSlack({ threadId, resourceId });
    if (result.removed) {
      ctx.showInfo(`Unsubscribed this thread from Slack workspace ${result.workspaceName ?? result.workspaceId}.`);
    } else {
      ctx.showInfo('This thread is not subscribed to Slack.');
    }
    // Clear statusline badge immediately
    ctx.state.activeSlackSubscription = undefined;
    ctx.updateStatusLine();
  } catch (error) {
    ctx.showError(`Failed to unsubscribe from Slack: ${error instanceof Error ? error.message : String(error)}`);
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

  // No existing token — the typed response is the new token
  if (!hasToken && choice.startsWith('xoxp-')) {
    ctx.authStorage?.setStoredApiKey('slack-signals', choice, 'SLACK_USER_TOKEN');
    ctx.showInfo('Slack token saved. Restart MastraCode for Slack signals to use it.');
    return;
  }

  ctx.showError('A valid Slack user token (starting with xoxp-) is required.');
}

async function manageSlackPollInterval(ctx: SlashCommandContext): Promise<void> {
  const settings = loadSettings();
  const currentMs = settings.signals.slackPollIntervalMs;
  const currentLabel = formatPollInterval(currentMs);

  const choice = await askModalQuestion(ctx.state.ui, {
    question: `Current poll interval: ${currentLabel}\n\nChoose a new interval:`,
    options: [
      { label: '30s', description: 'Aggressive — check every 30 seconds' },
      { label: '1m', description: 'Default — check every minute' },
      { label: '2m', description: 'Relaxed — check every 2 minutes' },
      { label: '5m', description: 'Low priority — check every 5 minutes' },
      { label: 'Custom', description: 'Enter a custom interval in seconds' },
    ],
  });

  if (!choice) return;

  let newMs: number;
  if (choice === '30s') newMs = 30_000;
  else if (choice === '1m') newMs = 60_000;
  else if (choice === '2m') newMs = 120_000;
  else if (choice === '5m') newMs = 300_000;
  else if (choice === 'Custom') {
    const input = await askModalQuestion(ctx.state.ui, {
      question: 'Enter poll interval in seconds (10–3600):',
      allowCustomResponse: true,
      allowEmptyInput: false,
    });
    if (!input) return;
    const seconds = Number(input);
    if (!Number.isFinite(seconds) || seconds < 10 || seconds > 3600) {
      ctx.showError('Interval must be between 10 and 3600 seconds.');
      return;
    }
    newMs = Math.floor(seconds * 1000);
  } else {
    return;
  }

  settings.signals.slackPollIntervalMs = newMs;
  saveSettings(settings);
  ctx.showInfo(`Poll interval changed to ${formatPollInterval(newMs)}. Restart MastraCode for it to take effect.`);
}

export async function handleSlackCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  if (!loadSettings().signals.experimentalSlackSignals) {
    ctx.showError('Experimental Slack signals are disabled. Enable them in /settings and restart MastraCode.');
    return;
  }

  const [action] = args;

  if (action === 'subscribe' || action === 'sub') {
    await subscribeSlackThread(ctx);
    return;
  }
  if (action === 'unsubscribe' || action === 'unsub') {
    await unsubscribeSlackThread(ctx);
    return;
  }
  if (action === 'token') {
    await manageSlackToken(ctx);
    return;
  }
  if (action === 'poll' || action === 'interval') {
    await manageSlackPollInterval(ctx);
    return;
  }
  if (action === 'config' || action === 'status' || !action) {
    ctx.showInfo(await describeSlackSubscription(ctx));
    return;
  }

  ctx.showError('Usage: /slack subscribe, /slack unsubscribe, /slack config, /slack token, /slack poll');
}