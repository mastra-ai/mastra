import type { SlashCommandContext } from './types.js';

export function handleExitCommand(ctx: SlashCommandContext): void {
  ctx.stop();
  process.exit(0);
}
