/**
 * Core feature flags for @mastra/core
 *
 * This object tracks which features are available in the current version of @mastra/core.
 * Dependent packages can check for feature availability to ensure compatibility.
 *
 * @example
 * ```ts
 * import { coreFeatures } from "@mastra/core/features"
 *
 * if (coreFeatures.someNewThing) {
 *   doWhatever()
 * }
 * ```
 */
export const coreFeatures: Record<string, boolean> = {
  // Add feature flags here as new features are introduced
  // Example: someNewFeature: true,
};
