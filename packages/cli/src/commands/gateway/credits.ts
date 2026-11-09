import * as p from '@clack/prompts';
import color from 'picocolors';
import { openBrowser } from '../auth/credentials.js';
import { creditsPageUrl } from './api.js';
import type { GatewayCredits } from './api.js';

export function formatCredits(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Offer to add credits when the organization has none. Credits (and auto top-up) are bought in the
 * dashboard, which opens in the browser; setup carries on without waiting for the purchase.
 * Resolves to whether the dashboard was opened.
 */
export async function offerGatewayCredits({
  orgId,
  credits,
  signal,
}: {
  orgId: string;
  credits: GatewayCredits;
  signal?: AbortSignal;
}): Promise<boolean> {
  if (credits.unlimited || credits.remaining > 0) return false;

  const choice = await p.select({
    message: `Your Gateway balance is ${formatCredits(credits.remaining)}. Model calls are paid per token from credits.`,
    options: [
      { value: 'buy', label: 'Add credits', hint: 'opens the Mastra dashboard' },
      { value: 'skip', label: 'Skip for now' },
    ],
    initialValue: 'buy',
    showInstructions: false,
    signal,
  });
  if (p.isCancel(choice) || choice === 'skip') return false;

  const url = creditsPageUrl(orgId);
  try {
    openBrowser(url);
    p.log.info(`Opened the Mastra dashboard. Add credits there. If it didn't open, go to:\n${color.cyan(url)}`);
  } catch {
    p.log.info(`Add credits in the Mastra dashboard:\n${color.cyan(url)}`);
  }
  return true;
}
