/**
 * Observational Memory keeps a token count on each message part, in
 * `part.providerMetadata.mastra.tokenEstimate`, and reads the "trusted" entries back by presence,
 * without re-checking them against the part's content. Code that edits a part's content (or builds
 * a new part by spreading an old one) must clear those entries so the part is counted again.
 *
 * Memory checks for this marker before it trusts any entry, so an older Core that doesn't clear
 * them never pairs with a Memory that reads them.
 */
export const TRUSTED_TOKEN_ESTIMATE_INVALIDATION = 1;

const TRUSTED_VERSION = 9;
const TRUSTED_SOURCE = 'v9:tokenx';

type Entry = { v?: unknown; source?: unknown };

function isTrustedEntry(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Entry;
  return entry.v === TRUSTED_VERSION && entry.source === TRUSTED_SOURCE;
}

/**
 * The estimate without its trusted entries; v8, client and any other entries stay. Nested values
 * are scrubbed whatever the top level looks like (even an object with an unrelated `source`), so
 * nothing the reader could accept survives.
 */
function withoutTrustedEntries(estimate: unknown): unknown {
  if (isTrustedEntry(estimate)) return undefined;
  if (!estimate || typeof estimate !== 'object') return estimate;
  const entries = Object.entries(estimate as Record<string, unknown>);
  const kept = entries.filter(([, value]) => !isTrustedEntry(value));
  if (kept.length === entries.length) return estimate;
  return kept.length ? Object.fromEntries(kept) : undefined;
}

/**
 * Copy of `providerMetadata` with both levels (`providerMetadata` and `providerMetadata.mastra`)
 * as new objects and the trusted token entries removed. Copying even when nothing is removed
 * matters: a part built by `{ ...part }` shares its metadata objects with the source, and a count
 * written later onto the new part must not land on the source too.
 */
function detachProviderMetadata(providerMetadata: unknown): Record<string, unknown> | undefined {
  if (!providerMetadata || typeof providerMetadata !== 'object') return providerMetadata as undefined;
  const next: Record<string, unknown> = { ...(providerMetadata as Record<string, unknown>) };
  const mastra = next.mastra;
  if (!mastra || typeof mastra !== 'object') return next;

  const nextMastra: Record<string, unknown> = { ...(mastra as Record<string, unknown>) };
  if ('tokenEstimate' in nextMastra) {
    const remaining = withoutTrustedEntries(nextMastra.tokenEstimate);
    if (remaining === undefined) delete nextMastra.tokenEstimate;
    else nextMastra.tokenEstimate = remaining;
  }
  if (Object.keys(nextMastra).length) next.mastra = nextMastra;
  else delete next.mastra;
  return next;
}

/** A shallow copy of `part` whose metadata is detached and no longer carries trusted token counts. */
export function clearTrustedTokenEstimates<T>(part: T): T {
  if (!part || typeof part !== 'object') return part;
  const providerMetadata = (part as { providerMetadata?: unknown }).providerMetadata;
  if (providerMetadata === undefined) return part;
  const next = { ...(part as Record<string, unknown>) };
  const detached = detachProviderMetadata(providerMetadata);
  if (detached && Object.keys(detached).length) next.providerMetadata = detached;
  else delete next.providerMetadata;
  return next as T;
}

/** Same as {@link clearTrustedTokenEstimates}, applied to `part` itself, for code that edits a part in place. */
export function clearTrustedTokenEstimatesInPlace(part: unknown): void {
  if (!part || typeof part !== 'object') return;
  const target = part as { providerMetadata?: unknown };
  if (target.providerMetadata === undefined) return;
  const detached = detachProviderMetadata(target.providerMetadata);
  if (detached && Object.keys(detached).length) target.providerMetadata = detached;
  else delete target.providerMetadata;
}
