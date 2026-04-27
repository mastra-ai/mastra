import { createTool } from '@mastra/core/tools';

import { getX402StationClient   } from './client.js';
import type {X402StationClient, X402StationClientOptions} from './client.js';
import { CatalogDecoysInputSchema, CatalogDecoysOutputSchema } from './schemas.js';
import type { CatalogDecoysResponse } from './types.js';

/**
 * Decoy / zombie blacklist tool. Pulls every active x402 endpoint
 * currently flagged `decoy_price_extreme` / `zombie` / `dead_7d` /
 * `mostly_dead` in one JSON payload, plus per-reason counts.
 *
 * **Cost: $0.005 USDC.** Refreshed every ~10 min server-side. Pull
 * periodically (hourly/daily) and cache locally as a blacklist —
 * cheaper than preflighting every URL the agent encounters.
 */
export function createX402StationCatalogDecoysTool(config: X402StationClientOptions = {}) {
  let client: X402StationClient | null = null;
  function getClient(): X402StationClient {
    if (!client) client = getX402StationClient(config);
    return client;
  }

  return createTool({
    id: 'x402station-catalog-decoys',
    description:
      'Returns every active x402 endpoint currently flagged decoy_price_extreme / zombie / dead_7d / ' +
      'mostly_dead in one JSON payload, plus per-reason counts. Costs $0.005 USDC. Refreshed every ~10 ' +
      'min server-side. Pull periodically (hourly/daily) and cache locally as a blacklist — cheaper than ' +
      'preflighting every URL.',
    inputSchema: CatalogDecoysInputSchema,
    outputSchema: CatalogDecoysOutputSchema,
    execute: async () => {
      const c = getClient();
      const out = await c.callPaid<CatalogDecoysResponse>('/api/v1/catalog/decoys', {});
      return out;
    },
  });
}
