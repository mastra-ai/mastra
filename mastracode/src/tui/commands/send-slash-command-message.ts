import { addPendingUserMessage, removePendingUserMessage } from '../render-messages.js';
import { tryAutoSubscribeToBranchPR } from './github.js';
import type { SlashCommandContext } from './types.js';

export function isCurrentThreadActive(ctx: SlashCommandContext): boolean {
  return ctx.harness.isCurrentThreadStreamActive?.() ?? ctx.harness.getDisplayState?.().isRunning ?? false;
}

/** Thread IDs that have already been checked for branch-level PR auto-subscribe. */
const autoSubscribeCheckedThreads = new Set<string>();

/**
 * If GitHub Signals are enabled and the current git branch has an open PR,
 * auto-subscribe this thread to that PR.  Runs at most once per thread
 * (tracked via a module-level Set) and is completely fire-and-forget.
 */
function maybeAutoSubscribeThread(ctx: SlashCommandContext): void {
  const threadId = ctx.harness.getCurrentThreadId?.();
  if (!threadId || autoSubscribeCheckedThreads.has(threadId)) return;
  autoSubscribeCheckedThreads.add(threadId);
  tryAutoSubscribeToBranchPR(ctx).catch(() => {});
}

export async function sendSlashCommandMessage(
  ctx: SlashCommandContext,
  displayText: string,
  content: string,
  options: { renderIdleUserMessage?: boolean } = {},
): Promise<void> {
  if (ctx.state.pendingNewThread) {
    await ctx.harness.createThread();
    ctx.state.pendingNewThread = false;
  }

  // Auto-subscribe to the current branch's PR when GitHub Signals are enabled.
  maybeAutoSubscribeThread(ctx);

  if (isCurrentThreadActive(ctx)) {
    const signal = ctx.harness.sendSignal({ content });
    addPendingUserMessage(ctx.state, signal.id, displayText);
    try {
      await signal.accepted;
    } catch (error) {
      removePendingUserMessage(ctx.state, signal.id);
      throw error;
    }
    return;
  }

  if (options.renderIdleUserMessage ?? true) {
    ctx.addUserMessage({
      id: `user-${Date.now()}`,
      role: 'user',
      content: [{ type: 'text', text: displayText }],
      createdAt: new Date(),
    });
    ctx.state.ui.requestRender();
  }
  await ctx.harness.sendMessage({ content });
}
