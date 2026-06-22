import type { SlashCommandContext } from './types';

export function handleExitCommand(ctx: SlashCommandContext): void {
  ctx.stop();
  process.exit(0);
}
