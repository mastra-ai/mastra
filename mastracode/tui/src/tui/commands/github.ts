import { loadSettings } from '@mastra/code-sdk/onboarding/settings';
import { GITHUB_SIGNALS_METADATA_KEY } from '@mastra/github-signals';
import type { GithubPRSignalInput } from '@mastra/github-signals';
import { askModalQuestion } from '../modal-question.js';
import type { SlashCommandContext } from './types.js';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function formatPollInterval(value: number): string {
  if (value % 60_000 === 0) return `${value / 60_000}m`;
  return `${Math.round(value / 1000)}s`;
}

function parseGithubPRReference(input: string): GithubPRSignalInput | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;

  const numberOnly = /^#?(\d+)$/.exec(trimmed);
  if (numberOnly?.[1]) return Number(numberOnly[1]);

  const repoReference = /^(?:https:\/\/github\.com\/)?([^\s/#]+)\/([^\s/#]+)(?:\/pull\/|#)(\d+)$/.exec(trimmed);
  if (repoReference?.[1] && repoReference[2] && repoReference[3]) {
    return { owner: repoReference[1], repo: repoReference[2], number: Number(repoReference[3]) };
  }

  return undefined;
}

async function getCurrentGithubThread(ctx: SlashCommandContext): Promise<{
  threadId?: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}> {
  const session = ctx.state.session as unknown as {
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
  const threadId = session?.thread?.getId?.();
  if (!threadId) return {};

  const thread = (await session?.thread?.list?.({ allResources: true }))?.find(item => item.id === threadId);
  return {
    threadId,
    resourceId: thread?.resourceId ?? session?.identity?.getResourceId?.(),
    metadata: thread?.metadata,
  };
}

function getGithubSubscriptionsFromThreadMetadata(metadata: Record<string, unknown> | undefined): Array<{
  owner?: string;
  repo?: string;
  number: number;
}> {
  const mastra = isPlainObject(metadata?.mastra) ? metadata.mastra : {};
  const githubSignals = isPlainObject(mastra[GITHUB_SIGNALS_METADATA_KEY]) ? mastra[GITHUB_SIGNALS_METADATA_KEY] : {};
  const subscriptions = Array.isArray(githubSignals.subscriptions) ? githubSignals.subscriptions : [];
  return subscriptions.flatMap(subscription => {
    if (!isPlainObject(subscription) || typeof subscription.number !== 'number') return [];
    return [
      {
        ...(typeof subscription.owner === 'string' ? { owner: subscription.owner } : {}),
        ...(typeof subscription.repo === 'string' ? { repo: subscription.repo } : {}),
        number: subscription.number,
      },
    ];
  });
}

async function describeGithubSubscriptions(ctx: SlashCommandContext): Promise<string> {
  const { threadId, resourceId, metadata } = await getCurrentGithubThread(ctx);
  if (!threadId) return 'GitHub Signals debug: no current thread.';

  const thread = { resourceId, metadata };
  const mastra = isPlainObject(thread?.metadata?.mastra) ? thread.metadata.mastra : {};
  const githubSignals = isPlainObject(mastra[GITHUB_SIGNALS_METADATA_KEY]) ? mastra[GITHUB_SIGNALS_METADATA_KEY] : {};
  const subscriptions = Array.isArray(githubSignals.subscriptions) ? githubSignals.subscriptions : [];
  if (subscriptions.length === 0) return `GitHub Signals debug for ${threadId}: no subscribed PRs.`;

  const githubSignalsProcessor = ctx.state.options?.githubSignals;
  const pollingActive = thread?.resourceId
    ? (githubSignalsProcessor?.isPollingThread({ threadId, resourceId: thread.resourceId }) ?? false)
    : false;
  const pollIntervalMs = githubSignalsProcessor?.getPollIntervalMs?.();
  const header = `GitHub Signals debug for ${threadId}: ${subscriptions.length} subscription${subscriptions.length === 1 ? '' : 's'}, polling=${pollingActive ? 'active' : 'inactive'}${pollIntervalMs ? `, interval=${formatPollInterval(pollIntervalMs)}` : ''}`;

  const lines = subscriptions.map(subscription => {
    if (!isPlainObject(subscription)) return '- invalid subscription metadata';
    const pr = `${subscription.owner}/${subscription.repo}#${subscription.number}`;
    const sync = subscription.lastSyncStatus ? `sync=${subscription.lastSyncStatus}` : 'sync=unknown';
    const poll = subscription.lastSyncAt
      ? `lastPoll=${formatLocalTimestamp(subscription.lastSyncAt)}`
      : 'lastPoll=never';
    const observed = [
      subscription.lastObservedGithubUpdatedAt
        ? `githubUpdated=${formatLocalTimestamp(subscription.lastObservedGithubUpdatedAt)}`
        : undefined,
      subscription.lastObservedState ? `state=${subscription.lastObservedState}` : undefined,
      subscription.lastObservedCiState ? `ci=${subscription.lastObservedCiState}` : undefined,
      subscription.lastObservedMergeableState ? `merge=${subscription.lastObservedMergeableState}` : undefined,
      subscription.lastObservedReviewStateHash ? `reviews=${subscription.lastObservedReviewStateHash}` : undefined,
    ].filter(Boolean);
    const notificationTime = formatLocalTimestamp(subscription.lastNotificationAt) ?? 'unknown time';
    const notification = subscription.lastNotificationKind
      ? `lastNotification=${subscription.lastNotificationKind}/${subscription.lastNotificationPriority ?? 'unknown'} at ${notificationTime}: ${subscription.lastNotificationSummary ?? ''}`
      : 'lastNotification=none';
    return `- ${pr} ${sync} ${poll}${subscription.lastSyncError ? ` error=${subscription.lastSyncError}` : ''}${subscription.lastSnapshotError ? ` snapshotError=${subscription.lastSnapshotError}` : ''}${observed.length ? ` (${observed.join(', ')})` : ''}\n  ${notification}`;
  });
  return [header, ...lines].join('\n');
}

async function syncGithubSubscriptions(ctx: SlashCommandContext): Promise<void> {
  const githubSignalsProcessor = ctx.state.options?.githubSignals;
  if (!githubSignalsProcessor?.syncThreadNow) {
    ctx.showError('GitHub signals are not available. Enable them in /settings and restart MastraCode.');
    return;
  }

  const { threadId, resourceId } = await getCurrentGithubThread(ctx);
  if (!threadId || !resourceId) {
    ctx.showError('GitHub sync requires a current thread.');
    return;
  }

  try {
    const count = await githubSignalsProcessor.syncThreadNow({ threadId, resourceId });
    if (count === 0) {
      ctx.showInfo('No GitHub PR subscriptions to sync.');
    }
  } catch (error) {
    ctx.showError(`Failed to sync GitHub PR subscriptions: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function detectCurrentPullRequest(ctx: SlashCommandContext): Promise<string> {
  const { execFile } = await import('node:child_process');
  return new Promise(resolve => {
    execFile(
      'gh',
      ['pr', 'view', '--json', 'url', '--jq', '.url'],
      { cwd: ctx.state.projectInfo.rootPath },
      (error, stdout) => {
        resolve(error ? '' : stdout.trim());
      },
    );
  });
}

export async function handleGithubCommand(ctx: SlashCommandContext, args: string[] = []): Promise<void> {
  if (!loadSettings().signals.experimentalGithubSignals) {
    ctx.showError('Experimental GitHub signals are disabled. Enable them in /settings and restart MastraCode.');
    return;
  }

  const [maybeAction, ...restArgs] = args;
  if (maybeAction === 'debug') {
    ctx.showInfo(await describeGithubSubscriptions(ctx));
    return;
  }
  if (maybeAction === 'sync') {
    await syncGithubSubscriptions(ctx);
    return;
  }
  const explicitSubscribe = maybeAction === 'subscribe' || maybeAction === 'sub';
  const action = maybeAction === 'unsubscribe' || maybeAction === 'unsub' ? 'unsubscribe' : 'subscribe';
  const referenceArgs = action === 'unsubscribe' || explicitSubscribe ? restArgs : args;
  const inlineReference = referenceArgs.join(' ').trim();
  const currentThread = await getCurrentGithubThread(ctx);
  const existingSubscriptions = getGithubSubscriptionsFromThreadMetadata(currentThread.metadata);
  const reference = inlineReference
    ? inlineReference
    : action === 'unsubscribe' && existingSubscriptions.length === 1
      ? existingSubscriptions[0]!
      : await askModalQuestion(ctx.state.ui, {
          question: `GitHub PR to ${action} ${action === 'subscribe' ? 'to' : 'from'}`,
          defaultValue: await detectCurrentPullRequest(ctx),
        });
  if (reference === null) return;

  const parsed = typeof reference === 'string' ? parseGithubPRReference(reference) : reference;
  if (!parsed) {
    ctx.showError(
      'Usage: /github 123, /github owner/repo#123, /github unsubscribe 123, /github sync, /github debug, or /github https://github.com/owner/repo/pull/123',
    );
    return;
  }
  if (!currentThread.threadId || !currentThread.resourceId) {
    ctx.showError(`GitHub ${action} requires a current thread.`);
    return;
  }

  const githubSignalsProcessor = ctx.state.options?.githubSignals;
  const runOperation =
    action === 'unsubscribe'
      ? githubSignalsProcessor?.unsubscribeThreadFromPR
      : githubSignalsProcessor?.subscribeThreadToPR;
  if (!runOperation) {
    ctx.showError('GitHub signals are not available. Enable them in /settings and restart MastraCode.');
    return;
  }

  try {
    const result = await runOperation.call(githubSignalsProcessor, {
      threadId: currentThread.threadId,
      resourceId: currentThread.resourceId,
      pr: parsed,
    });
    const prefix =
      action === 'unsubscribe' ? (result.removed ? 'Unsubscribed from' : 'No subscription found for') : 'Subscribed to';
    ctx.showInfo(`${prefix} ${result.owner}/${result.repo}#${result.number}.`);
  } catch (error) {
    ctx.showError(`Failed to ${action} GitHub PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}
