import { addGithubPrSubscriptionBadge, removeGithubPrSubscriptionBadge } from '../state.js';
import type { SlashCommandContext } from './types.js';

const USAGE = `Usage:
  /github subscribe <prNumber> [repo]
  /github unsubscribe <prNumber> [repo]
  /github sync [prNumber] [repo]`;

function parsePrNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const prNumber = Number(value);
  return Number.isInteger(prNumber) && prNumber > 0 ? prNumber : undefined;
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
    ctx.showError('GitHub PR notifications are not available in this session.');
    return;
  }

  const thread = getCurrentGithubThread(ctx);
  if (!thread) {
    ctx.showError('No current thread. Send a message first, then run /github again.');
    return;
  }

  const prNumber = parsePrNumber(args[1]);
  const repo = args[2];
  if ((action === 'subscribe' || action === 'unsubscribe') && !prNumber) {
    ctx.showInfo(USAGE);
    return;
  }
  if (args.length > 3) {
    ctx.showInfo(USAGE);
    return;
  }
  if (action === 'sync' && args[1] && !prNumber) {
    ctx.showInfo(USAGE);
    return;
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

  await ctx.githubSignals.init({ memory, ...thread });
  const result = await ctx.githubSignals.syncThread({ ...thread, repo, prNumber });
  ctx.updateStatusLine();
  ctx.showInfo(
    result.pendingDelivered > 0
      ? `Delivered ${result.pendingDelivered} pending GitHub notification${result.pendingDelivered === 1 ? '' : 's'}.`
      : 'GitHub PR notifications synced. No pending notifications.',
  );
}
