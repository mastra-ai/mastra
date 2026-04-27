import { createTool } from '@mastra/core/tools';

import { getX402StationClient   } from './client.js';
import type {X402StationClient, X402StationClientOptions} from './client.js';
import { ForensicsInputSchema, ForensicsOutputSchema } from './schemas.js';
import type { ForensicsResponse } from './types.js';

/**
 * Deep 7-day forensics tool. Posts a target URL to
 * `https://x402station.io/api/v1/forensics` and returns hourly uptime,
 * latency p50/p90/p99, status-code distribution, concentration-group
 * stats, and a `decoy_probability` score in `[0, 1]`.
 *
 * **Cost: $0.001 USDC.** Superset of preflight — if you're running
 * forensics you don't also need preflight on the same URL.
 */
export function createX402StationForensicsTool(config: X402StationClientOptions = {}) {
  let client: X402StationClient | null = null;
  function getClient(): X402StationClient {
    if (!client) client = getX402StationClient(config);
    return client;
  }

  return createTool({
    id: 'x402station-forensics',
    description:
      'Deep 7-day report on one x402 endpoint: hourly uptime, latency p50/p90/p99, status-code distribution, ' +
      'concentration-group stats (how crowded the provider namespace is), and a decoy_probability score [0,1]. ' +
      'Costs $0.001 USDC. Superset of preflight — running forensics removes the need to also preflight.',
    inputSchema: ForensicsInputSchema,
    outputSchema: ForensicsOutputSchema,
    execute: async ({ url }) => {
      const c = getClient();
      const out = await c.callPaid<ForensicsResponse>('/api/v1/forensics', { url });
      return out;
    },
  });
}
