import { createTool } from '@mastra/core/tools';

import { getX402StationClient   } from './client.js';
import type {X402StationClient, X402StationClientOptions} from './client.js';
import { PreflightInputSchema, PreflightOutputSchema } from './schemas.js';
import type { PreflightResponse } from './types.js';

/**
 * Pre-flight safety check tool. Posts a target URL to
 * `https://x402station.io/api/v1/preflight` and returns
 * `{ ok, warnings[], metadata }` plus the settled-payment receipt.
 *
 * **Cost: $0.001 USDC** (auto-signed via `@x402/fetch`). The CDP
 * facilitator settles before this tool's `execute` returns. `ok` is
 * `true` only when no critical signal fires (`dead`, `zombie`,
 * `decoy_price_extreme`).
 *
 * Agents should call this BEFORE any other paid x402 request to avoid
 * decoys (price ≥ $1k traps), zombie services (100% errors but still
 * listed), and dead endpoints.
 */
export function createX402StationPreflightTool(config: X402StationClientOptions = {}) {
  let client: X402StationClient | null = null;
  function getClient(): X402StationClient {
    if (!client) client = getX402StationClient(config);
    return client;
  }

  return createTool({
    id: 'x402station-preflight',
    description:
      'Ask x402station whether a given x402 URL is safe to pay. Returns {ok, warnings[], metadata}. ' +
      'Costs $0.001 USDC, settled via x402. Call this BEFORE paying an unfamiliar x402 endpoint to avoid ' +
      'decoys (price ≥ $1k), zombie services (100% errors), and dead endpoints. ok:true only when no ' +
      'critical warning fires.',
    inputSchema: PreflightInputSchema,
    outputSchema: PreflightOutputSchema,
    execute: async ({ url }) => {
      const c = getClient();
      const out = await c.callPaid<PreflightResponse>('/api/v1/preflight', { url });
      return out;
    },
  });
}
