import { addPendingUserMessage, removePendingUserMessage } from '../render-messages.js';
import type { SlashCommandContext } from './types.js';

export function isCurrentThreadActive(ctx: SlashCommandContext): boolean {
  return ctx.harness.isCurrentThreadStreamActive?.() ?? ctx.harness.getDisplayState?.().isRunning ?? false;
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
