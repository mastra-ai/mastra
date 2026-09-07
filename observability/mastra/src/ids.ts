/**
 * Signal and span id helpers.
 *
 * These two utilities also exist in `@mastra/core/observability`. This package
 * deliberately keeps local copies rather than importing them.
 *
 * Importing a helper from core ties this package's real minimum core version to
 * whichever release happened to add that helper. A named ESM import of an export
 * that does not exist fails at link time, before any application code runs, so
 * the mismatch surfaces as a startup crash rather than a resolvable install
 * error. That is how `resolveExportedSpanId` (added in `@mastra/core@1.63.0`)
 * broke deployments pinned to an older core while the declared peer floor still
 * said `>=1.16.0`; `generateSignalId` (added in `@mastra/core@1.26.0`) had
 * already raised the true floor the same way, unnoticed.
 *
 * Both helpers are self-contained: `generateSignalId` wraps `crypto.randomUUID`,
 * and `resolveExportedSpanId` is structurally typed against an optional method
 * rather than any core class. A local copy costs a few lines and lets the
 * declared peer range stay honest.
 *
 * Keep them local. Re-importing either from core silently raises this package's
 * minimum core version again.
 *
 * TODO(mastra-v2): delete this file and import both helpers from
 * `@mastra/core/observability` again.
 *
 * The duplication exists only because a peer floor cannot be raised inside a
 * major version without breaking consumers pinned to an older core. A v2
 * release resets that floor anyway, so importing from core stops being a
 * compatibility hazard at that point. On v2:
 *
 *   1. Set the `@mastra/core` peer range to the v2 line.
 *   2. Re-point the four import sites -- `generateSignalId` in
 *      `context/logger.ts`, `context/metrics.ts` and `recorded.ts`, and
 *      `resolveExportedSpanId` in `instances/base.ts`.
 *   3. Delete this file.
 *
 * Do not undo it before then: both helpers are still missing from cores inside
 * this package's currently declared range (`generateSignalId` landed in core
 * 1.26.0, `resolveExportedSpanId` in 1.63.0, floor is 1.16.0).
 *
 * Context: https://github.com/mastra-ai/mastra/issues/22885
 */

/** Generate a unique id for an observability signal (log, metric, score, feedback). */
export function generateSignalId(): string {
  return crypto.randomUUID();
}

/**
 * Resolve the spanId an observability signal should reference for a span.
 *
 * Signals (logs, metrics, and a suspending run's resume link) must name a span
 * that actually reached exporters. An internal or excluded span is never stored,
 * so referencing its raw id leaves the signal pointing at nothing: log/metric
 * span lookups 404, and a resumed run's exported children inherit a dangling
 * parentSpanId and land as orphans. `undefined` is a valid answer, omitting the
 * reference rather than pointing it at a span that does not exist.
 *
 * `getExportedSpanId` is optional on the `Span` interface, so the typeof guard
 * separates "this implementation predates the method" (keep the old behavior of
 * referencing the span's own id) from "the method ran and found nothing
 * exportable" (undefined). Without it the two collapse and custom span
 * implementations silently lose correlation.
 */
export function resolveExportedSpanId(
  span: { id?: string; getExportedSpanId?: () => string | undefined } | undefined | null,
): string | undefined {
  if (!span) return undefined;
  return typeof span.getExportedSpanId === 'function' ? span.getExportedSpanId() : span.id;
}
