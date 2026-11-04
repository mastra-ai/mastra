/**
 * Provider-agnostic reasoning identity for cache keys.
 *
 * Several providers return reasoning blocks whose text can be empty while their identity
 * lives in provider metadata (e.g. `openai.itemId`, `anthropic.signature`,
 * `anthropic.redactedData`, `google.thoughtSignature`). Without that identity, distinct
 * empty-text reasoning parts collapse onto one cache key and are deduped during merge.
 *
 * Only identity-like fields are used (not the whole namespace) so that non-identity metadata
 * drift such as `cacheControl` or usage does not split otherwise identical parts.
 */
const IDENTITY_KEY =
  /^(itemId|signature|redactedData|encryptedContent|reasoningEncryptedContent|\w*Signature|\w*Digest)$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** cyrb53: fast, deterministic, runtime-agnostic 53-bit string hash. */
export function hashIdentityValue(value: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < value.length; i++) {
    const ch = value.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Collect `field:hash` identity entries from provider metadata/options objects.
 * The namespace is deliberately omitted so the same identity mirrored under several
 * namespaces (e.g. `azure.itemId` and `openai.itemId`) yields one entry.
 * Output is sorted and de-duplicated so it is independent of key order and source order.
 */
export function getReasoningIdentityKeys(...sources: unknown[]): string[] {
  const keys = new Set<string>();
  for (const source of sources) {
    if (!isPlainObject(source)) continue;
    for (const block of Object.values(source)) {
      if (!isPlainObject(block)) continue;
      for (const [field, value] of Object.entries(block)) {
        if (typeof value !== 'string' || value.length === 0 || !IDENTITY_KEY.test(field)) continue;
        keys.add(`${field}:${hashIdentityValue(value)}`);
      }
    }
  }
  return [...keys].sort();
}

export function appendReasoningIdentityKeys(cacheKey: string, ...sources: unknown[]): string {
  for (const identityKey of getReasoningIdentityKeys(...sources)) {
    cacheKey += `|${identityKey}`;
  }
  return cacheKey;
}
