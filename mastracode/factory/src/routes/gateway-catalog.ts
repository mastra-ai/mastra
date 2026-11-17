import { createHash } from 'node:crypto';

import { MastraGateway } from '@mastra/core/llm';
import type { ProviderConfig } from '@mastra/core/llm';

import { MASTRA_GATEWAY_CATALOG_PROVIDER } from './provider-credentials.js';

/** How long a fetched catalogue is served before the gateway is asked again. */
const FRESH_MS = 60_000;
/** While the gateway fails, a catalogue this old or older is no longer served in its place. */
const MAX_STALE_MS = 60 * 60_000;
/** After a failed fetch, its answer is kept this long so each request does not retry. */
const FAILED_MS = 15_000;
/**
 * The longest a settings request waits for the gateway. The gateway client allows a fetch 10 s; a
 * caller that stops waiting gets the last good catalogue, or none, and the fetch still fills the cache.
 */
const WAIT_MS = 3_000;
/** Keys are per tenant, so the cache is bounded. The oldest entry goes first. */
const MAX_ENTRIES = 256;

type GatewayCatalog = ProviderConfig | undefined;

interface Entry {
  /** The last catalogue fetched, and when. */
  value?: GatewayCatalog;
  fetchedAt?: number;
  expiresAt: number;
  failing?: boolean;
  inflight?: Promise<GatewayCatalog>;
}

const entries = new Map<string, Entry>();

/**
 * The Mastra Gateway's model catalogue as `apiKey` sees it, or the server's own when no key is
 * given. A v2 key gets its organization's live list and a v1 key the bundled one, as
 * `MastraGateway.fetchProviders` decides. Answers are cached per key and base URL for a minute,
 * so another key never sees this one's list, and concurrent callers share one fetch.
 *
 * A timeout, network error or 5xx keeps serving the last good list for up to an hour. A 401 or 403
 * means the key itself was refused, perhaps revoked, so its cached list is dropped. A failure with
 * nothing to serve yields undefined, logged once until a fetch succeeds.
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
  const entry = entries.get(cacheKey);
  if (entry?.inflight) return withinWait(entry.inflight, servable(entry));
  if (entry && entry.expiresAt > Date.now()) return entry.failing ? servable(entry) : entry.value;

  const inflight = new MastraGateway({ apiKey, baseUrl })
    .fetchProviders()
    .then(providers => {
      const value = providers[MASTRA_GATEWAY_CATALOG_PROVIDER];
      const now = Date.now();
      remember(cacheKey, { value, fetchedAt: now, expiresAt: now + FRESH_MS });
      return value;
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      const keyRefused = KEY_REFUSED.test(message);
      const kept: Entry = keyRefused
        ? { expiresAt: Date.now() + FAILED_MS, failing: true }
        : { value: entry?.value, fetchedAt: entry?.fetchedAt, expiresAt: Date.now() + FAILED_MS, failing: true };
      if (!entry?.failing) {
        console.warn('[Factory Config] Mastra Gateway model catalogue unavailable', {
          error: message,
          servingLastKnown: servable(kept) !== undefined,
        });
      }
      remember(cacheKey, kept);
      return servable(kept);
    });
  remember(cacheKey, { ...entry, expiresAt: entry?.expiresAt ?? 0, inflight });
  return withinWait(inflight, entry ? servable(entry) : undefined);
}

/** `MastraGateway.fetchProviders` reports a refused catalogue request as `… unavailable (<status>)`. */
const KEY_REFUSED = /\((?:401|403)\)$/;

/** The last good catalogue, while it is recent enough to stand in for a failing gateway. */
function servable(entry: Entry): GatewayCatalog {
  return entry.fetchedAt !== undefined && Date.now() - entry.fetchedAt < MAX_STALE_MS ? entry.value : undefined;
}

function withinWait(fetching: Promise<GatewayCatalog>, meanwhile: GatewayCatalog): Promise<GatewayCatalog> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const waited = new Promise<GatewayCatalog>(resolve => {
    timer = setTimeout(() => resolve(meanwhile), WAIT_MS);
    timer.unref?.();
  });
  return Promise.race([fetching, waited]).finally(() => clearTimeout(timer));
}

function remember(cacheKey: string, entry: Entry) {
  entries.delete(cacheKey);
  entries.set(cacheKey, entry);
  if (entries.size > MAX_ENTRIES) entries.delete(entries.keys().next().value!);
}

export function resetMastraGatewayCatalogCacheForTests() {
  entries.clear();
}
