/**
 * Selects a specific version of a primitive by immutable ID, movable label,
 * or publication status. Selectors are intentionally mutually exclusive.
 */
export type VersionSelector =
  | { versionId: string; label?: never; status?: never }
  | { label: string; versionId?: never; status?: never }
  | { status: 'draft' | 'published'; versionId?: never; label?: never };

/**
 * Per-primitive version overrides.
 * Keys are primitive IDs, values select which version to resolve.
 */
export type VersionOverrides = {
  /** Selects the version of the root agent receiving the execution request. */
  self?: VersionSelector;
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
