/**
 * Feature detection for paired @mastra/core and @mastra/observability versions.
 *
 * Both are resolved synchronously so span classification is stable from the
 * very first span: `OtelBridge.createSpan()` picks the OTEL SpanKind at
 * `startSpan()` time, where it can no longer change, so detection must not
 * depend on a pending dynamic import.
 *
 * `@mastra/observability` is a hard dependency, but older versions do not
 * export `observabilityFeatures`. The namespace import reads it as `undefined`
 * in that case instead of failing to link, which is the graceful fallback
 * documented in `observability/mastra/src/features.ts`.
 */

import { coreFeatures } from '@mastra/core/features';
import * as observability from '@mastra/observability';

const FEATURE = 'model-inference-span';

let observabilityFeatures: ReadonlySet<string> | undefined = (
  observability as { observabilityFeatures?: ReadonlySet<string> }
).observabilityFeatures;

/**
 * Returns true when both packages report the `model-inference-span` feature,
 * meaning MODEL_INFERENCE spans are emitted by the tracker. Drives which span
 * is exported as the GenAI `chat` call (new: MODEL_INFERENCE; legacy:
 * MODEL_GENERATION).
 */
export function isModelInferenceEnabled(): boolean {
  return observabilityFeatures?.has(FEATURE) === true && coreFeatures.has(FEATURE);
}

/**
 * @internal Test-only override. Allows tests to simulate a paired older or
 * newer `@mastra/observability` without juggling module mocks.
 */
export function __setObservabilityFeaturesForTest(features: ReadonlySet<string> | undefined): void {
  observabilityFeatures = features;
}
