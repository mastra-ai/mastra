import { execFile } from 'node:child_process';

import { GITHUB_SIGNALS_METADATA_KEY, GithubSignals } from '../../github-signals/index.js';
import type { GithubPRSignalInput } from '../../github-signals/index.js';
import { loadSettings } from '../../onboarding/settings.js';
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

async function describeGithubSubscriptions(ctx: SlashCommandContext): Promise<string> {
  const harness = ctx.harness as unknown as {
    getCurrentThreadId?: () => string | undefined;
    listThreads?: (input?: {
      allResources?: boolean;
    }) => Promise<Array<{ id: string; metadata?: Record<string, unknown> }>>;
  };
  const threadId = harness.getCurrentThreadId?.();
  if (!threadId) return 'GitHub Signals debug: no current thread.';

  const thread = (await harness.listThreads?.({ allResources: true }))?.find(item => item.id === threadId);
  const mastra = isPlainObject(thread?.metadata?.mastra) ? thread.metadata.mastra : {};
  const githubSignals = isPlainObject(mastra[GITHUB_SIGNALS_METADATA_KEY]) ? mastra[GITHUB_SIGNALS_METADATA_KEY] : {};
  const subscriptions = Array.isArray(githubSignals.subscriptions) ? githubSignals.subscriptions : [];
  if (subscriptions.length === 0) return `GitHub Signals debug for ${threadId}: no subscribed PRs.`;

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
    return `- ${pr} ${sync} ${poll}${subscription.lastSyncError ? ` error=${subscription.lastSyncError}` : ''}${observed.length ? ` (${observed.join(', ')})` : ''}\n  ${notification}`;
  });
  return [`GitHub Signals debug for ${threadId}:`, ...lines].join('\n');
}

async function detectCurrentPullRequest(ctx: SlashCommandContext): Promise<string> {
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
  const explicitSubscribe = maybeAction === 'subscribe' || maybeAction === 'sub';
  const action = maybeAction === 'unsubscribe' || maybeAction === 'unsub' ? 'unsubscribe' : 'subscribe';
  const referenceArgs = action === 'unsubscribe' || explicitSubscribe ? restArgs : args;
  const inlineReference = referenceArgs.join(' ').trim();
  const reference = inlineReference
    ? inlineReference
    : await askModalQuestion(ctx.state.ui, {
        question: `GitHub PR to ${action} ${action === 'subscribe' ? 'to' : 'from'}`,
        defaultValue: await detectCurrentPullRequest(ctx),
      });
  if (reference === null) return;

  const parsed = parseGithubPRReference(reference);
  if (!parsed) {
    ctx.showError(
      'Usage: /github 123, /github owner/repo#123, /github unsubscribe 123, /github debug, or /github https://github.com/owner/repo/pull/123',
    );
    return;
  }

  try {
    const inputSignal =
      action === 'unsubscribe'
        ? GithubSignals.signals.unsubscribeFromPR(parsed)
        : GithubSignals.signals.subscribeToPR(parsed);
    const signal = ctx.harness.sendSignal({ ...inputSignal, type: 'reactive' });
    await signal.accepted;
    const number = typeof parsed === 'number' ? parsed : parsed.number;
    ctx.showInfo(`${action === 'unsubscribe' ? 'Unsubscribed from' : 'Subscribed to'} GitHub PR #${number}.`);
  } catch (error) {
    ctx.showError(`Failed to ${action} GitHub PR: ${error instanceof Error ? error.message : String(error)}`);
  }
}
