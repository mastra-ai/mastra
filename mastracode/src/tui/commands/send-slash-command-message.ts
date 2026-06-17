import { addPendingUserMessage } from '../render-messages.js';
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

  const session = await ctx.harness.getCurrentSession();

  if (isCurrentThreadActive(ctx)) {
    const result = await session.sendMessage({ messages: content });
    addPendingUserMessage(ctx.state, result.signal.id, displayText);
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
  await session.queueMessage({ messages: content });
}
