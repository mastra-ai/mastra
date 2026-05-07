import type { SlashCommandContext } from './types.js';

export function handleCostCommand(ctx: SlashCommandContext): void {
  const formatNumber = (n: number) => n.toLocaleString();

  // Read from Harness display state (canonical source)
  const ds = ctx.state.harness.getDisplayState();

  let omTokensText = '';
  if (ds.omProgress.observationTokens > 0) {
    omTokensText = `
  Memory:     ${formatNumber(ds.omProgress.observationTokens)} tokens`;
  }

  ctx.showInfo(`Token Usage (Current Thread):
  Input:      ${formatNumber(ds.tokenUsage.promptTokens)} tokens
  Output:     ${formatNumber(ds.tokenUsage.completionTokens)} tokens${omTokensText}
  ─────────────────────────────────────────
  Total:      ${formatNumber(ds.tokenUsage.totalTokens)} tokens
  
  Note: For cost estimates, check your provider's pricing page.`);
}
