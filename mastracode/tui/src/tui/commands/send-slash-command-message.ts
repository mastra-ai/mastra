import { addPendingUserMessage, removePendingUserMessage } from '../render-messages.js';
import type { SlashCommandContext } from './types.js';

export function isCurrentThreadActive(ctx: SlashCommandContext): boolean {
  return ctx.state.session?.stream?.isActive?.() ?? ctx.state.session?.displayState?.get?.().isRunning ?? false;
}

export async function sendSlashCommandMessage(
  ctx: SlashCommandContext,
  displayText: string,
  content: string,
  options: { renderIdleUserMessage?: boolean } = {},
): Promise<void> {
  if (ctx.state.pendingNewThread) {
    await ctx.state.session.thread.create();
    ctx.state.pendingNewThread = false;
  }

  if (isCurrentThreadActive(ctx)) {
    const signal = ctx.state.session.sendSignal({ content });
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
      content: { format: 2, parts: [{ type: 'text', text: displayText }] },
      createdAt: new Date(),
    });
    ctx.state.ui.requestRender();
  }
  await ctx.state.session.sendMessage({ content });
}
