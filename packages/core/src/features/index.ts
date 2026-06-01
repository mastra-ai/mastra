/**
 * Core feature flags for @mastra/core
 *
 * This set tracks which features are available in the current version of @mastra/core.
 * Dependent packages can check for feature availability to ensure compatibility.
 *
 * @example
 * ```ts
 * import { coreFeatures } from "@mastra/core/features"
 *
 * if (coreFeatures.has('workspaces-v1')) {
 *   // Workspace features available
 * }
 * ```
 */
// Add feature flags here as new features are introduced
export const coreFeatures = new Set<string>([
  'observationalMemory',
  'asyncBuffering',
  'request-response-id-rotation',
  'workspaces-v1',
  'datasets',
  'observability:v1.13.2',
  // 'observability-delta-polling' intentionally NOT enabled by default.
  //
  // Delta polling reads via `WHERE cursorId > $after` over a `bigserial`
  // cursor that is assigned outside of transactions. When two writes overlap,
  // a row with a lower cursorId can become visible AFTER a row with a higher
  // cursorId — but the poller has already advanced past the lower id, so the
  // late-committer is permanently skipped. Empirically the loss rate scales
  // with concurrent writers (≈0.6%–6% at 2 writers, ≈58% at 16 writers).
  //
  // The fix is documented in stores/pg/src/storage/domains/observability/
  // v-next/polling.ts: cap the cursor at a safe horizon derived from
  // `pg_snapshot_xmin(pg_current_snapshot())` and pair it with a drain step.
  // Until that ships, callers can still opt in explicitly:
  //
  //   import { coreFeatures } from '@mastra/core/features';
  //   coreFeatures.add('observability-delta-polling');
  'channels',
  'deploy-diagnosis',
  'model-inference-span',
  'internal-usage-rollup',
]);
