/**
 * Observational Memory keeps a token count on each message part, in
 * `part.providerMetadata.mastra.tokenEstimate`, and reads its v9 entries back by presence, without
 * re-checking them against the part's content. Code that edits a part's content (or builds a new
 * part by spreading an old one) must clear those entries so the part is counted again.
 *
 * Memory looks for these clearers on this module and reads v9 entries only when they exist, so an
 * older Core that doesn't have them never pairs with a Memory that trusts stored counts.
 */

const V9_VERSION = 9;
const V9_SOURCE = 'v9:tokenx';

type Entry = { v?: unknown; source?: unknown };

function isV9Entry(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Entry;
  return entry.v === V9_VERSION && entry.source === V9_SOURCE;
}

/**
 * The estimate without its v9 entries; v8, client and any other entries stay. Nested values
 * are scrubbed whatever the top level looks like (even an object with an unrelated `source`), so
 * nothing the reader could accept survives.
 */
function withoutV9Entries(estimate: unknown): unknown {
  if (isV9Entry(estimate)) return undefined;
  if (!estimate || typeof estimate !== 'object') return estimate;
  const entries = Object.entries(estimate as Record<string, unknown>);
  const kept = entries.filter(([, value]) => !isV9Entry(value));
  if (kept.length === entries.length) return estimate;
  return kept.length ? Object.fromEntries(kept) : undefined;
}

/**
 * Copy of `providerMetadata` with both levels (`providerMetadata` and `providerMetadata.mastra`)
 * as new objects and the v9 token entries removed. Copying even when nothing is removed
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
    const remaining = withoutV9Entries(nextMastra.tokenEstimate);
    if (remaining === undefined) delete nextMastra.tokenEstimate;
    else nextMastra.tokenEstimate = remaining;
  }
  if (Object.keys(nextMastra).length) next.mastra = nextMastra;
  else delete next.mastra;
  return next;
}

/** A shallow copy of `part` whose metadata is detached and no longer carries v9 token counts. */
export function clearTokenEstimates<T>(part: T): T {
  if (!part || typeof part !== 'object') return part;
  const providerMetadata = (part as { providerMetadata?: unknown }).providerMetadata;
  if (providerMetadata === undefined) return part;
  const next = { ...(part as Record<string, unknown>) };
  const detached = detachProviderMetadata(providerMetadata);
  if (detached && Object.keys(detached).length) next.providerMetadata = detached;
  else delete next.providerMetadata;
  return next as T;
}

/** Same as {@link clearTokenEstimates}, applied to `part` itself, for code that edits a part in place. */
export function clearTokenEstimatesInPlace(part: unknown): void {
  if (!part || typeof part !== 'object') return;
  const target = part as { providerMetadata?: unknown };
  if (target.providerMetadata === undefined) return;
  const detached = detachProviderMetadata(target.providerMetadata);
  if (detached && Object.keys(detached).length) target.providerMetadata = detached;
  else delete target.providerMetadata;
}
