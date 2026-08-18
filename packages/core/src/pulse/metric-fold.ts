/**
 * Shared token/cost fold store.
 *
 * Token metrics for a model span are cached here (keyed by spanId) and
 * folded into the model's semantic END fact — by BOTH lanes: the bridge's
 * span translation and the native lifecycle emitter. `takeFold` is
 * idempotent (repeat calls return the same data), so whichever lane runs
 * first does not starve the other, and dual-emitted end facts stay
 * byte-identical. Entries are dropped on `drainLeftovers` (flush/shutdown)
 * or when the store exceeds its cap.
 *
 * Tokens only — cost is derived at read time (pulse/pricing.ts).
 *
 * Process-global (like the emitter sink): spanIds are globally unique so
 * folds cannot collide across Mastra instances; with several instances in
 * one process, leftover drains may attribute an unfolded entry to the
 * other instance's bus — benign for the prototype, noted here.
 */

interface FoldEntry {
  traceId: string;
  data: Record<string, number>;
  folded: boolean;
}

const entries = new Map<string, FoldEntry>();
const MAX_ENTRIES = 10_000;

export function recordTokenMetric(args: { spanId: string; traceId: string; foldKey: string; value?: number }): void {
  let entry = entries.get(args.spanId);
  if (!entry) {
    if (entries.size >= MAX_ENTRIES) entries.delete(entries.keys().next().value as string);
    entry = { traceId: args.traceId, data: {}, folded: false };
    entries.set(args.spanId, entry);
  }
  if (args.value !== undefined) entry.data[args.foldKey] = args.value;
}

/** Fold data for a model span's end fact. Idempotent: both lanes get the
 * same values; the entry is retained (marked folded) until drain. */
export function takeFold(spanId: string): Record<string, number> | undefined {
  const entry = entries.get(spanId);
  if (!entry) return undefined;
  entry.folded = true;
  return entry.data;
}

/** Entries never folded into a span fact (their span never ended in this
 * process). Clears the store. */
export function drainLeftovers(): Array<{ spanId: string; traceId: string; data: Record<string, number> }> {
  const leftovers: Array<{ spanId: string; traceId: string; data: Record<string, number> }> = [];
  for (const [spanId, entry] of entries) {
    if (!entry.folded) leftovers.push({ spanId, traceId: entry.traceId, data: entry.data });
  }
  entries.clear();
  return leftovers;
}
