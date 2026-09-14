import type { SlashCommandContext } from './types.js';

export function handleExitCommand(ctx: SlashCommandContext): void {
  ctx.stop();
  if (ctx.exit) ctx.exit(0);
  else process.exit(0);
}
