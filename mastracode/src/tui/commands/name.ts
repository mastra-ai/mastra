import type { SlashCommandContext } from './types.js';

export async function handleNameCommand(ctx: SlashCommandContext, args: string[]): Promise<void> {
  const title = args.join(' ').trim();
  if (!title) {
    ctx.showInfo('Usage: /name <title>');
    return;
  }
  if (!ctx.harness.getCurrentThreadId()) {
    ctx.showInfo('No active thread. Send a message first.');
    return;
  }
  await ctx.harness.renameThread({ title });
  ctx.showInfo(`Thread renamed to: ${title}`);
}
