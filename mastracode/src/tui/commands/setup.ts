import type { SlashCommandContext } from './types';

export async function handleSetupCommand(ctx: SlashCommandContext): Promise<void> {
  await ctx.showOnboarding();
}
