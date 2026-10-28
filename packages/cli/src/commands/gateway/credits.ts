import * as p from '@clack/prompts';
import color from 'picocolors';
import { listenForSkipInput, openBrowser } from '../auth/credentials.js';
import { creditsPageUrl, getGatewayCredits } from './api.js';
import type { GatewayCredits } from './api.js';

const POLL_INTERVAL_MS = 3_000;
const PURCHASE_TIMEOUT_MS = 10 * 60_000;

export function formatCredits(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

export interface CreditsOutcome {
  /** Balance after the step, in dollars. */
  remaining: number;
  /** Dollars added during the step, when a purchase completed. */
  added?: number;
  unlimited?: boolean;
}

/**
 * Offer to add credits, by default only when the organization has none. Credits (and auto top-up) are
 * bought in the dashboard, which opens in the browser; the terminal waits until the new balance shows
 * up (any key stops waiting).
 */
export async function offerGatewayCredits({
  token,
  orgId,
  credits,
  signal,
  always = false,
}: {
  token: string;
  orgId: string;
  credits: GatewayCredits;
  signal?: AbortSignal;
  /** Offer even when there are credits left (`mastra gateway credits`). */
  always?: boolean;
}): Promise<CreditsOutcome> {
  if (credits.unlimited) return { remaining: credits.remaining, unlimited: true };
  if (credits.remaining > 0 && !always) return { remaining: credits.remaining };

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
  if (p.isCancel(choice) || choice === 'skip') return { remaining: credits.remaining };

  const url = creditsPageUrl(orgId);
  try {
    openBrowser(url);
    p.log.info(
      `Opened the Mastra dashboard. Add credits there, then come back. If it didn't open, go to:\n${color.cyan(url)}`,
    );
  } catch {
    p.log.info(`Add credits in the Mastra dashboard, then come back:\n${color.cyan(url)}`);
  }

  return waitForCredits({ token, orgId, before: credits.remaining, signal });
}

async function waitForCredits({
  token,
  orgId,
  before,
  signal,
}: {
  token: string;
  orgId: string;
  /** Balance before the purchase; it shows up as an increase. */
  before: number;
  signal?: AbortSignal;
}): Promise<CreditsOutcome> {
  const spinner = p.spinner();
  spinner.start('Waiting for your credits (press any key to stop waiting)');

  let stopped = false;
  const stopListening = listenForSkipInput(() => {
    stopped = true;
  });
  const deadline = Date.now() + PURCHASE_TIMEOUT_MS;
  try {
    while (!stopped && Date.now() < deadline) {
      signal?.throwIfAborted();
      await sleep(POLL_INTERVAL_MS, signal);
      if (stopped) break;
      const latest = await getGatewayCredits(token, orgId, signal).catch(error => {
        if (signal?.aborted) throw error;
        return undefined;
      });
      if (latest && (latest.unlimited || latest.remaining > before)) {
        const added = latest.remaining - before;
        spinner.stop(`Added ${formatCredits(added)} in credits.`);
        return { remaining: latest.remaining, added, unlimited: latest.unlimited || undefined };
      }
    }
  } catch (error) {
    spinner.stop('Stopped waiting for credits.');
    throw error;
  } finally {
    stopListening();
  }

  spinner.stop(stopped ? 'Stopped waiting for credits.' : 'No credits yet, continuing without them.');
  return { remaining: before };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal!.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
