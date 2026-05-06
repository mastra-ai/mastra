/**
 * Feature flags for @mastra/observability
 *
 * Tracks which features are available in the current version of
 * @mastra/observability. Downstream exporter packages (e.g.
 * @mastra/datadog, @mastra/laminar) can check for feature availability
 * before relying on a span shape, attribute, or hierarchy that this
 * package may not yet emit.
 *
 * Pair these checks with `coreFeatures` from `@mastra/core/features` so a
 * consumer only opts in when BOTH packages support the feature.
 *
 * @example Happy-path usage (when you control the version floor)
 * ```ts
 * import { observabilityFeatures } from "@mastra/observability/features"
 * import { coreFeatures } from "@mastra/core/features"
 *
 * if (
 *   observabilityFeatures.has('model-inference-span') &&
 *   coreFeatures.has('model-inference-span')
 * ) {
 *   // safe to assume MODEL_INFERENCE spans are emitted
 * }
 * ```
 *
 * @example Old-version-safe usage (recommended for shipped exporters)
 *
 * Static imports of this module hard-fail at module load when paired with
 * an `@mastra/observability` that predates the `./features` subpath:
 * - importing `@mastra/observability/features` throws
 *   `ERR_PACKAGE_PATH_NOT_EXPORTED` (no `./features` in package exports)
 * - a named import of `observabilityFeatures` from the main entry can throw
 *   a link-time `SyntaxError` in strict Node ESM if the symbol is missing
 *
 * Use a dynamic import with try/catch so the exporter degrades gracefully
 * against any `@mastra/observability` version:
 *
 * ```ts
 * import { coreFeatures } from "@mastra/core/features"
 *
 * let observabilityFeatures: Set<string> | undefined
 * try {
 *   ({ observabilityFeatures } = await import("@mastra/observability/features"))
 * } catch {
 *   // older @mastra/observability without the features subpath
 * }
 *
 * if (
 *   observabilityFeatures?.has("model-inference-span") &&
 *   coreFeatures.has("model-inference-span")
 * ) {
 *   // safe
 * }
 * ```
 */
// Add feature flags here as new features are introduced
export const observabilityFeatures = new Set<string>(['model-inference-span']);
