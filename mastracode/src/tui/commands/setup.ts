import type { SlashCommandContext } from './types.js';

export async function handleSetupCommand(ctx: SlashCommandContext): Promise<void> {
  await ctx.showOnboarding();
}
