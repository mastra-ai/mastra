import * as p from '@clack/prompts';
import color from 'picocolors';
import { listenForSkipInput, openBrowser } from '../auth/credentials.js';
import { DEFAULT_CREDITS_PURCHASE, getGatewayCredits, startCreditsCheckout } from './api.js';
import type { GatewayCredits } from './api.js';

const POLL_INTERVAL_MS = 3_000;
const CHECKOUT_TIMEOUT_MS = 10 * 60_000;

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
 * Offer to buy credits, by default only when the organization has none. Payment happens on the
 * checkout page in the browser; the terminal waits until the new balance shows up (any key stops waiting).
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

  const amount = DEFAULT_CREDITS_PURCHASE;
  const choice = await p.select({
    message: `Your Gateway balance is ${formatCredits(credits.remaining)}. Model calls are paid per token from credits.`,
    options: [
      { value: 'buy', label: `Add ${formatCredits(amount)} in credits`, hint: 'opens your browser' },
      { value: 'skip', label: 'Skip for now' },
    ],
    initialValue: 'buy',
    showInstructions: false,
    signal,
  });
  if (p.isCancel(choice) || choice === 'skip') return { remaining: credits.remaining };

  const paymentUrl = await startCreditsCheckout(token, orgId, credits, amount);
  try {
    openBrowser(paymentUrl);
    p.log.info(`Opened checkout in your browser. If it didn't open, go to:\n${color.cyan(paymentUrl)}`);
  } catch {
    p.log.info(`Finish checkout in your browser:\n${color.cyan(paymentUrl)}`);
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
  /** Balance before checkout; the purchase shows up as an increase. */
  before: number;
  signal?: AbortSignal;
}): Promise<CreditsOutcome> {
  const spinner = p.spinner();
  spinner.start('Waiting for checkout to finish (press any key to stop waiting)');

  let stopped = false;
  const stopListening = listenForSkipInput(() => {
    stopped = true;
  });
  const deadline = Date.now() + CHECKOUT_TIMEOUT_MS;
  try {
    while (!stopped && Date.now() < deadline) {
      signal?.throwIfAborted();
      await sleep(POLL_INTERVAL_MS, signal);
      if (stopped) break;
      const latest = await getGatewayCredits(token, orgId).catch(() => undefined);
      if (latest && (latest.unlimited || latest.remaining > before)) {
        const added = latest.remaining - before;
        spinner.stop(`Added ${formatCredits(added)} in credits.`);
        return { remaining: latest.remaining, added, unlimited: latest.unlimited || undefined };
      }
    }
  } catch (error) {
    spinner.stop('Stopped waiting for checkout.');
    throw error;
  } finally {
    stopListening();
  }

  spinner.stop(stopped ? 'Stopped waiting for checkout.' : 'Checkout is taking a while, continuing without it.');
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
