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
export const coreFeatures = new Set<string>(['workspaces-v1']);
