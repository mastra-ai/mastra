/**
 * Feature detection for paired @mastra/core and @mastra/observability versions.
 *
 * `coreFeatures` is a hard peer dependency, so it can be imported statically.
 * `observabilityFeatures` is loaded via dynamic import so this exporter degrades
 * gracefully against older `@mastra/observability` versions that don't export it
 * (per the pattern documented in `observability/mastra/src/features.ts`).
 *
 * Detection runs once at module load. Callers consume the result through the
 * sync `isModelInferenceEnabled()` accessor, which conservatively returns
 * `false` until detection settles — long enough only to cover the microtask
 * window before any spans are emitted in practice.
 */

import { coreFeatures } from '@mastra/core/features';

const FEATURE = 'model-inference-span';

let observabilityFeatures: ReadonlySet<string> | undefined;
let featureLoadPromise: Promise<void> | undefined;

function loadObservabilityFeatures(): Promise<void> {
  if (!featureLoadPromise) {
    featureLoadPromise = import('@mastra/observability')
      .then(mod => {
        observabilityFeatures = (mod as { observabilityFeatures?: ReadonlySet<string> }).observabilityFeatures;
      })
      .catch(() => {
        // Older @mastra/observability without the `observabilityFeatures` export.
      });
  }
  return featureLoadPromise;
}

// Kick off detection at module load so the cached value is ready by the time
// the first span is emitted.
void loadObservabilityFeatures();

/**
 * Returns true when both packages report the `model-inference-span` feature,
 * meaning MODEL_INFERENCE spans are emitted by the tracker. Drives the
 * Datadog kind mapping and usage-source switch (legacy: MODEL_STEP carries
 * 'llm' kind + usage; new: MODEL_INFERENCE does).
 */
export function isModelInferenceEnabled(): boolean {
  return observabilityFeatures?.has(FEATURE) === true && coreFeatures.has(FEATURE);
}

/**
 * @internal Test-only override. Allows tests to simulate a paired older or
 * newer `@mastra/observability` without juggling dynamic imports.
 */
export function __setObservabilityFeaturesForTest(features: ReadonlySet<string> | undefined): void {
  observabilityFeatures = features;
  // Mark detection complete so isModelInferenceEnabled stops waiting.
  featureLoadPromise = Promise.resolve();
}
