/**
 * Feature flags for @mastra/observability
 *
 * Tracks which features are available in the current version of
 * @mastra/observability. Downstream exporter packages (e.g.
 * @mastra/datadog, @mastra/laminar) can check for feature availability
 * before relying on a span shape, attribute, or hierarchy that this
 * package may not yet emit.
 *
 * @example
 * ```ts
 * import { observabilityFeatures } from "@mastra/observability/features"
 * import { coreFeatures } from "@mastra/core/features"
 *
 * // Both packages must support the feature
 * if (
 *   observabilityFeatures.has('model-inference-span') &&
 *   coreFeatures.has('model-inference-span')
 * ) {
 *   // safe to read SpanType.MODEL_INFERENCE and assume the tracker emits it
 * }
 * ```
 */
// Add feature flags here as new features are introduced
export const observabilityFeatures = new Set<string>(['model-inference-span']);
