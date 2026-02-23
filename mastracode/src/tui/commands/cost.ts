import type { SlashCommandContext } from './types.js';

export function handleCostCommand(ctx: SlashCommandContext): void {
  const formatNumber = (n: number) => n.toLocaleString();

  let omTokensText = '';
  if (ctx.state.omProgress.observationTokens > 0) {
    omTokensText = `
  Memory:     ${formatNumber(ctx.state.omProgress.observationTokens)} tokens`;
  }

  ctx.showInfo(`Token Usage (Current Thread):
  Input:      ${formatNumber(ctx.state.tokenUsage.promptTokens)} tokens
  Output:     ${formatNumber(ctx.state.tokenUsage.completionTokens)} tokens${omTokensText}
  ─────────────────────────────────────────
  Total:      ${formatNumber(ctx.state.tokenUsage.totalTokens)} tokens
  
  Note: For cost estimates, check your provider's pricing page.`);
}
