import { defaultGithubCommandRunner, ghSignals } from '../../github-signals/index.js';
import { addGithubPrSubscriptionBadge, removeGithubPrSubscriptionBadge } from '../state.js';
import type { GithubPrSubscriptionBadge } from '../state.js';
import type { SlashCommandContext } from './types.js';

const USAGE = `Usage:
  /github subscribe [prNumber] [repo]
  /github unsubscribe <prNumber> [repo]
  /github sync [prNumber] [repo]`;

function parsePrNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const prNumber = Number(value);
  return Number.isInteger(prNumber) && prNumber > 0 ? prNumber : undefined;
}

function parseRepoFromPullRequestUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  const match = /^https?:\/\/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/.exec(url);
  return match?.[1];
}

function getGithubCommandErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function ensureGithubCliAuthenticated(): Promise<string | undefined> {
  try {
    await defaultGithubCommandRunner(['auth', 'status']);
    return undefined;
  } catch (error) {
    const message = getGithubCommandErrorMessage(error);
    if (/ENOENT|not found|command not found|spawn gh/i.test(message)) {
      return 'GitHub PR notifications require the GitHub CLI (`gh`). Install it, then run `gh auth login`.';
    }
    if (/not logged|authentication|auth login|no.*hosts|could not resolve to a github host/i.test(message)) {
      return 'GitHub PR notifications require GitHub CLI authentication. Run `gh auth login`, then try again.';
    }
    return `GitHub CLI is not ready: ${message}`;
  }
}

async function discoverCurrentPullRequest(): Promise<{ prNumber: number; repo?: string } | undefined> {
  try {
    const result = await defaultGithubCommandRunner(['pr', 'view', '--json', 'number,url']);
    const parsed = JSON.parse(result.stdout) as { number?: unknown; url?: unknown };
    const prNumber = typeof parsed.number === 'number' ? parsed.number : undefined;
    if (!prNumber || !Number.isInteger(prNumber) || prNumber <= 0) return undefined;

    return {
      prNumber,
      ...(typeof parsed.url === 'string' ? { repo: parseRepoFromPullRequestUrl(parsed.url) } : {}),
    };
  } catch {
    return undefined;
  }
}

async function getSubscribeSummary(prNumber: number, repo: string | undefined): Promise<string | undefined> {
  try {
    const args = [
      'pr',
      'view',
      String(prNumber),
      '--json',
      'title,state,mergedAt,reviewDecision,latestReviews,statusCheckRollup,url',
    ];
    if (repo) args.push('--repo', repo);
    const result = await defaultGithubCommandRunner(args);
    const parsed = JSON.parse(result.stdout) as Record<string, unknown>;
    return formatSubscribeSummary(parsed);
  } catch {
    return undefined;
  }
}

function formatSubscribeSummary(pr: Record<string, unknown>): string {
  const lines = ['Current PR snapshot:'];
  const title = typeof pr.title === 'string' ? pr.title : undefined;
  const state = typeof pr.state === 'string' ? pr.state : undefined;
  const mergedAt = typeof pr.mergedAt === 'string' ? pr.mergedAt : undefined;
  lines.push(`- State: ${state ?? 'unknown'}${mergedAt ? ` at ${mergedAt}` : ''}${title ? ` — ${title}` : ''}`);

  const latestReview = Array.isArray(pr.latestReviews) ? pr.latestReviews.at(-1) : undefined;
  if (latestReview && typeof latestReview === 'object') {
    const review = latestReview as Record<string, unknown>;
    const author =
      review.author && typeof review.author === 'object' ? (review.author as Record<string, unknown>).login : undefined;
    const reviewState = typeof review.state === 'string' ? review.state : undefined;
    const submittedAt = typeof review.submittedAt === 'string' ? review.submittedAt : undefined;
    lines.push(
      `- Latest review: ${reviewState ?? 'unknown'}${author ? ` by ${author}` : ''}${submittedAt ? ` at ${submittedAt}` : ''}`,
    );
  } else {
    const reviewDecision = typeof pr.reviewDecision === 'string' ? pr.reviewDecision : undefined;
    lines.push(`- Review: ${reviewDecision ?? 'none yet'}`);
  }

  lines.push(`- CI: ${formatStatusCheckSummary(pr.statusCheckRollup)}`);
  return lines.join('\n');
}

function resolveRepoFromActiveBadges(
  badges: GithubPrSubscriptionBadge[],
  prNumber: number | undefined,
): { repo?: string; error?: string } {
  if (!prNumber) return {};
  const matchingBadges = badges.filter(badge => badge.prNumber === prNumber);
  const repos = [...new Set(matchingBadges.map(badge => badge.repo).filter((repo): repo is string => !!repo))];
  if (repos.length === 1) return { repo: repos[0] };
  if (repos.length > 1) {
    return { error: `Multiple active GitHub PR #${prNumber} subscriptions exist. Pass the repo explicitly.` };
  }
  return {};
}

function formatStatusCheckSummary(statusCheckRollup: unknown): string {
  if (!Array.isArray(statusCheckRollup) || statusCheckRollup.length === 0) return 'no checks reported';
  const counts = { failed: 0, pending: 0, passed: 0 };
  const failedNames: string[] = [];
  for (const check of statusCheckRollup) {
    if (!check || typeof check !== 'object') continue;
    const record = check as Record<string, unknown>;
    const state = typeof record.state === 'string' ? record.state.toLowerCase() : undefined;
    const conclusion = typeof record.conclusion === 'string' ? record.conclusion.toLowerCase() : undefined;
    const name = typeof record.name === 'string' ? record.name : undefined;
    if (state === 'failure' || conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'cancelled') {
      counts.failed += 1;
      if (name) failedNames.push(name);
    } else if (state === 'pending' || state === 'queued' || state === 'in_progress' || !conclusion) {
      counts.pending += 1;
    } else if (state === 'success' || conclusion === 'success') {
      counts.passed += 1;
    }
  }
  const parts = [`${counts.passed} passed`, `${counts.pending} pending`, `${counts.failed} failed`];
  if (failedNames.length > 0) parts.push(`failed: ${failedNames.slice(0, 3).join(', ')}`);
  return parts.join(', ');
}

async function getGithubMemory(ctx: SlashCommandContext) {
  return ctx.harness.getMastra()?.getStorage()?.getStore('memory');
}

function getCurrentGithubThread(ctx: SlashCommandContext) {
  const threadId = ctx.harness.getCurrentThreadId();
  const resourceId = ctx.harness.getResourceId();
  if (!threadId) return undefined;
  return { threadId, resourceId };
}

export async function handleGithubCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const action = args[0];
  if (!action || !['subscribe', 'unsubscribe', 'sync'].includes(action)) {
    ctx.showInfo(USAGE);
    return;
  }

  if (!ctx.githubSignals) {
    ctx.showError('GitHub PR notifications are disabled. Enable Experimental GitHub PR notifications in /settings.');
    return;
  }

  const thread = getCurrentGithubThread(ctx);
  if (!thread) {
    ctx.showError('No current thread. Send a message first, then run /github again.');
    return;
  }

  let prNumber = parsePrNumber(args[1]);
  let repo = args[2];
  if (args.length > 3) {
    ctx.showInfo(USAGE);
    return;
  }
  if ((action === 'unsubscribe' || action === 'sync') && args[1] && !prNumber) {
    ctx.showInfo(USAGE);
    return;
  }
  if (action === 'subscribe' && args[1] && !prNumber) {
    ctx.showInfo(USAGE);
    return;
  }
  if (action === 'unsubscribe' && !prNumber) {
    ctx.showInfo(USAGE);
    return;
  }
  if (action === 'subscribe' || action === 'sync') {
    const preflightError = await ensureGithubCliAuthenticated();
    if (preflightError) {
      ctx.showError(preflightError);
      return;
    }
  }

  if (action === 'subscribe' && !prNumber) {
    const discovered = await discoverCurrentPullRequest();
    if (!discovered) {
      ctx.showError('Could not find a GitHub PR for the current branch. Pass a PR number explicitly.');
      return;
    }
    prNumber = discovered.prNumber;
    repo = discovered.repo;
  }

  if ((action === 'unsubscribe' || action === 'sync') && prNumber && !repo) {
    const resolved = resolveRepoFromActiveBadges(ctx.state.activeGithubPrSubscriptions, prNumber);
    if (resolved.error) {
      ctx.showError(resolved.error);
      return;
    }
    repo = resolved.repo;
  }

  const memory = await getGithubMemory(ctx);
  if (!memory) {
    ctx.showError('GitHub PR notifications require memory storage.');
    return;
  }

  if (action === 'subscribe') {
    const subscription = await ctx.githubSignals.subscribeThread({
      memory,
      ...thread,
      repo,
      prNumber: prNumber!,
    });
    if (!subscription) {
      ctx.showError('Current thread was not found. Send a message first, then run /github again.');
      return;
    }
    ctx.state.activeGithubPrSubscriptions = addGithubPrSubscriptionBadge(ctx.state.activeGithubPrSubscriptions, {
      prNumber: subscription.prNumber,
      ...(subscription.repo ? { repo: subscription.repo } : {}),
    });
    ctx.updateStatusLine();
    const summary = await getSubscribeSummary(subscription.prNumber, subscription.repo);
    const signal = ctx.harness.sendSignal(
      ghSignals.prSubscribe({
        prNumber: subscription.prNumber,
        ...(subscription.repo ? { repo: subscription.repo } : {}),
        ...(summary ? { summary } : {}),
      }),
    );
    void signal.accepted.catch(() => undefined);
    ctx.showInfo(
      `Subscribed to GitHub PR #${subscription.prNumber}${subscription.repo ? ` (${subscription.repo})` : ''}.`,
    );
    return;
  }

  if (action === 'unsubscribe') {
    const removed = await ctx.githubSignals.unsubscribeThread({
      memory,
      ...thread,
      repo,
      prNumber: prNumber!,
    });
    ctx.state.activeGithubPrSubscriptions = removeGithubPrSubscriptionBadge(ctx.state.activeGithubPrSubscriptions, {
      prNumber: prNumber!,
      ...((removed?.repo ?? repo) ? { repo: removed?.repo ?? repo } : {}),
    });
    ctx.updateStatusLine();
    ctx.showInfo(
      `Unsubscribed from GitHub PR #${prNumber}${(removed?.repo ?? repo) ? ` (${removed?.repo ?? repo})` : ''}.`,
    );
    return;
  }

  const syncingBadge: GithubPrSubscriptionBadge | undefined = prNumber
    ? { prNumber, ...(repo ? { repo } : {}) }
    : ctx.state.activeGithubPrSubscriptions[0];
  if (syncingBadge) {
    ctx.state.githubSyncingPrSubscriptions = addGithubPrSubscriptionBadge(
      ctx.state.githubSyncingPrSubscriptions ?? [],
      syncingBadge,
    );
    ctx.updateStatusLine();
  }

  try {
    await ctx.githubSignals.init({ memory, ...thread });
    const result = await ctx.githubSignals.syncThread({ ...thread, repo, prNumber });
    ctx.showInfo(
      result.pendingDelivered > 0
        ? `Delivered ${result.pendingDelivered} pending GitHub notification${result.pendingDelivered === 1 ? '' : 's'}.`
        : 'GitHub PR notifications synced. No pending notifications.',
    );
  } finally {
    if (syncingBadge) {
      ctx.state.githubSyncingPrSubscriptions = removeGithubPrSubscriptionBadge(
        ctx.state.githubSyncingPrSubscriptions ?? [],
        syncingBadge,
      );
    }
    ctx.updateStatusLine();
  }
}
