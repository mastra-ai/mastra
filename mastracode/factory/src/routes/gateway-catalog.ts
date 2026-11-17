import { createHash } from 'node:crypto';

import { MastraGateway } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';

import { MASTRA_GATEWAY_CATALOG_PROVIDER } from './provider-credentials.js';

/**
 * The longest a settings request waits for the gateway. The gateway client allows a fetch 10 s; a
 * caller that stops waiting gets no gateway models this time, and the fetch still fills the
 * gateway client's cache for the next request.
 */
const WAIT_MS = 3_000;
/** Keys are per tenant, so the set of keys already warned about is bounded. */
const MAX_WARNED = 256;

type GatewayCatalog = ProviderConfig | undefined;

/** Hashed keys whose catalogue is failing and has been logged, until a fetch succeeds again. */
const warned = new Set<string>();

/**
 * The Mastra Gateway's model catalogue as `apiKey` sees it, or the server's own when no key is
 * given. A v2 key gets its organization's live list and a v1 key the bundled one, as
 * `MastraGateway.fetchProviders` decides.
 *
 * The gateway client caches a v2 list per key and base URL, shares one fetch between concurrent
 * callers, keeps serving the last list through a timeout, network error or 5xx, and drops it when
 * the gateway refuses the key. This function adds what a settings page needs on top: it never
 * throws, it waits a bounded time, and it logs a failing gateway once per key.
 */
export async function fetchMastraGatewayCatalog({
  apiKey,
  baseUrl,
}: {
  apiKey?: string;
  baseUrl?: string;
}): Promise<GatewayCatalog> {
  // Hashed so the key itself is never held or logged.
  const logKey = createHash('sha256')
    .update(`${baseUrl ?? ''}\n${apiKey ?? ''}`)
    .digest('hex');
  const fetching = new MastraGateway({ apiKey, baseUrl })
    .fetchProviders()
    .then(providers => {
      warned.delete(logKey);
      return providers[MASTRA_GATEWAY_CATALOG_PROVIDER];
    })
    .catch((error: unknown) => {
      if (!warned.has(logKey)) {
        if (warned.size >= MAX_WARNED) warned.delete(warned.values().next().value!);
        warned.add(logKey);
        console.warn('[Factory Config] Mastra Gateway model catalogue unavailable', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
      return undefined;
    });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<GatewayCatalog>(resolve => {
    timer = setTimeout(() => resolve(undefined), WAIT_MS);
    timer.unref?.();
  });
  return Promise.race([fetching, waited]).finally(() => clearTimeout(timer));
}

export function resetMastraGatewayCatalogCacheForTests() {
  warned.clear();
}
