import { createHash } from 'node:crypto';

import { MastraGateway } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';

import { MASTRA_GATEWAY_CATALOG_PROVIDER } from './provider-credentials.js';

/** How long a fetched catalogue is served before the gateway is asked again. */
const FRESH_MS = 60_000;
/** After a failed fetch with nothing to fall back on, the empty answer is kept this long so each request does not retry. */
const FAILED_MS = 15_000;
/** Keys are per tenant, so the cache is bounded. The oldest entry goes first. */
const MAX_ENTRIES = 256;

type GatewayCatalog = ProviderConfig | undefined;

interface Entry {
  value?: GatewayCatalog;
  expiresAt: number;
  failing?: boolean;
  inflight?: Promise<GatewayCatalog>;
}

const entries = new Map<string, Entry>();

/**
 * The Mastra Gateway's model catalogue as `apiKey` sees it, or the server's own when no key is
 * given. A v2 key gets its organization's live list and a v1 key the bundled one, as
 * `MastraGateway.fetchProviders` decides. Answers are cached per key and base URL for a minute,
 * concurrent callers share one fetch, and a failed refresh keeps serving the last good answer.
 * A failure with nothing to fall back on yields undefined, logged once until a fetch succeeds.
 */
export async function fetchMastraGatewayCatalog({
  apiKey,
  baseUrl,
}: {
  apiKey?: string;
  baseUrl?: string;
}): Promise<GatewayCatalog> {
  // Hashed so the cache never holds a key in its index.
  const cacheKey = createHash('sha256')
    .update(`${baseUrl ?? ''}\n${apiKey ?? ''}`)
    .digest('hex');
  const now = Date.now();
  const entry = entries.get(cacheKey);
  if (entry?.inflight) return entry.inflight;
  if (entry && entry.expiresAt > now) return entry.value;

  const inflight = new MastraGateway({ apiKey, baseUrl })
    .fetchProviders()
    .then(providers => {
      const value = providers[MASTRA_GATEWAY_CATALOG_PROVIDER];
      remember(cacheKey, { value, expiresAt: Date.now() + FRESH_MS });
      return value;
    })
    .catch((error: unknown) => {
      if (!entry?.failing) {
        console.warn('[Factory Config] Mastra Gateway model catalogue unavailable', {
          error: error instanceof Error ? error.message : String(error),
          servingLastKnown: entry?.value !== undefined,
        });
      }
      remember(cacheKey, { value: entry?.value, expiresAt: Date.now() + FAILED_MS, failing: true });
      return entry?.value;
    });
  remember(cacheKey, { ...entry, expiresAt: entry?.expiresAt ?? 0, inflight });
  return inflight;
}

function remember(cacheKey: string, entry: Entry) {
  entries.delete(cacheKey);
  entries.set(cacheKey, entry);
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
}

export function resetMastraGatewayCatalogCacheForTests() {
  entries.clear();
}
