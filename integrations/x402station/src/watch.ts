import { createTool } from '@mastra/core/tools';

import { getX402StationClient   } from './client.js';
import type {X402StationClient, X402StationClientOptions} from './client.js';
import {
  WatchSecretInputSchema,
  WatchStatusOutputSchema,
  WatchSubscribeInputSchema,
  WatchSubscribeOutputSchema,
  WatchUnsubscribeOutputSchema,
} from './schemas.js';
import type { WatchStatusResponse, WatchSubscribeResponse, WatchUnsubscribeResponse } from './types.js';

function makeClient(config: X402StationClientOptions): () => X402StationClient {
  let client: X402StationClient | null = null;
  return () => {
    if (!client) client = getX402StationClient(config);
    return client;
  };
}

/**
 * Watch-subscribe tool. Pays $0.01 USDC for a 30-day watch + 100
 * prepaid HMAC-SHA256-signed alerts on one x402 endpoint. Returns
 * `watchId` + `secret` — STORE THE SECRET, it's the HMAC seed for
 * verifying delivery payloads and is not retrievable later.
 *
 * `webhookUrl` is HTTPS-only at the schema level: HMAC-signed payloads
 * must not travel in clear text.
 */
export function createX402StationWatchSubscribeTool(config: X402StationClientOptions = {}) {
  const getClient = makeClient(config);
  return createTool({
    id: 'x402station-watch-subscribe',
    description:
      'Pay $0.01 USDC for a 30-day watch + 100 prepaid HMAC-SHA256-signed alerts on one x402 endpoint. ' +
      'When subscribed signals fire or clear (e.g. endpoint goes zombie, price flips to decoy_price_extreme), ' +
      'x402station POSTs a JSON payload signed with HMAC-SHA256 to your webhookUrl. Returns watchId + ' +
      'secret — STORE THE SECRET, it is the HMAC seed and is not retrievable later. signals defaults to ' +
      "{dead, zombie, decoy_price_extreme}; pass other names to subscribe to non-critical signals too.",
    inputSchema: WatchSubscribeInputSchema,
    outputSchema: WatchSubscribeOutputSchema,
    execute: async ({ url, webhookUrl, signals }) => {
      const c = getClient();
      const body: Record<string, unknown> = { url, webhookUrl };
      if (signals && signals.length > 0) body.signals = signals;
      const out = await c.callPaid<WatchSubscribeResponse>('/api/v1/watch', body);
      return out;
    },
  });
}

/**
 * Free, secret-gated tool that returns the current state of a watch:
 * active/expired flag, alerts remaining (out of 100 prepaid), the last
 * 10 alert deliveries with their `delivery_status`, and the last
 * computed signal snapshot.
 */
export function createX402StationWatchStatusTool(config: X402StationClientOptions = {}) {
  const getClient = makeClient(config);
  return createTool({
    id: 'x402station-watch-status',
    description:
      'Read the current state of an active watch: isActive/expired, alertsRemaining, last 10 alert ' +
      'deliveries with delivery_status, and last computed signal snapshot. Free — no payment required, ' +
      'secret-gated. The secret is the one returned by watch_subscribe.',
    inputSchema: WatchSecretInputSchema,
    outputSchema: WatchStatusOutputSchema,
    execute: async ({ watchId, secret }) => {
      const c = getClient();
      return c.callFree<WatchStatusResponse>(`/api/v1/watch/${watchId}`, 'GET', secret);
    },
  });
}

/**
 * Free, secret-gated tool that deactivates a watch — no further alerts
 * are queued or delivered. The subscription row + alert history is
 * retained for audit. There is no refund for unused prepaid alerts.
 */
export function createX402StationWatchUnsubscribeTool(config: X402StationClientOptions = {}) {
  const getClient = makeClient(config);
  return createTool({
    id: 'x402station-watch-unsubscribe',
    description:
      'Deactivate a watch — no further alerts are queued or delivered. The subscription is set to ' +
      'is_active=false but the row + alert history is retained for audit. Free — no payment required, ' +
      'secret-gated. There is no refund for unused prepaid alerts.',
    inputSchema: WatchSecretInputSchema,
    outputSchema: WatchUnsubscribeOutputSchema,
    execute: async ({ watchId, secret }) => {
      const c = getClient();
      return c.callFree<WatchUnsubscribeResponse>(`/api/v1/watch/${watchId}`, 'DELETE', secret);
    },
  });
}
