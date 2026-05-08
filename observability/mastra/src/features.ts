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
 * @example Old-version-safe usage
 *
 * A static named import of `observabilityFeatures` will throw a link-time
 * `SyntaxError` in strict Node ESM when paired with an `@mastra/observability`
 * that predates this export. Use a dynamic import so the exporter degrades
 * gracefully against any version of `@mastra/observability`:
 *
 * ```ts
 * import { coreFeatures } from "@mastra/core/features"
 *
 * let observabilityFeatures: Set<string> | undefined
 * try {
 *   ({ observabilityFeatures } = await import("@mastra/observability"))
 * } catch {
 *   // older @mastra/observability that does not export this symbol
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
export const observabilityFeatures: ReadonlySet<string> = new Set(['model-inference-span']);
