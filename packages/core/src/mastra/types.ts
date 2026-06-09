/**
 * Selects a specific version of a primitive by ID or by publication status.
 */
export type VersionSelector = { versionId: string } | { status: 'draft' | 'published' };

/**
 * Per-primitive version overrides.
 * Keys are primitive IDs, values select which version to resolve.
 */
export type VersionOverrides = {
  agents?: Record<string, VersionSelector>;
  /** Fallback status for sub-agents (and future primitives) without an explicit entry. */
  defaultStatus?: 'draft' | 'published';
  // Future: tools, workflows, etc.
};

/**
 * Shallow-merge two VersionOverrides objects.
 * Per-category, entries in `overrides` win over entries in `base`.
 */
export function mergeVersionOverrides(
  base: VersionOverrides | undefined,
  overrides: VersionOverrides | undefined,
): VersionOverrides | undefined {
  if (!base) return overrides;
  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    agents: {
      ...base.agents,
      ...overrides.agents,
    },
    // overrides.defaultStatus wins; fall back to base.defaultStatus
    ...(overrides.defaultStatus
      ? { defaultStatus: overrides.defaultStatus }
      : base.defaultStatus
        ? { defaultStatus: base.defaultStatus }
        : {}),
  };
}
