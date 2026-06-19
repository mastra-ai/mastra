import {
  addPendingUserMessage,
  confirmPendingSlashCommandMessage,
  removePendingUserMessage,
} from '../render-messages.js';
import type { SlashCommandContext } from './types.js';

function getSlashCommandPayload(content: string): { commandName: string; commandContent: string } | undefined {
  const match = content.trim().match(/^<slash-command\s+name="([^"]*)">([\s\S]*?)<\/slash-command>$/);
  if (!match) return undefined;
  return {
    commandName: match[1]!,
    commandContent: match[2]!.trim(),
  };
}

export function isCurrentThreadActive(ctx: SlashCommandContext): boolean {
  return ctx.harness.session?.stream?.isActive?.() ?? ctx.harness.session?.displayState?.get?.().isRunning ?? false;
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
      const slashPayload = getSlashCommandPayload(content);
      if (slashPayload) {
        confirmPendingSlashCommandMessage(ctx.state, signal.id, slashPayload.commandName, slashPayload.commandContent);
      }
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
