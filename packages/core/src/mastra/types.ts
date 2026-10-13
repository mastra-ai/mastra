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
  /** Label used for every agent without an explicit entry, including the directly invoked agent. */
  defaultLabel?: string;
  agents?: Record<string, VersionSelector>;
  /** Fallback status when neither an explicit agent entry nor a default label is provided. */
  defaultStatus?: 'draft' | 'published';
  // Future: tools, workflows, etc.
};

/** @internal Apply one selection policy to both the root agent and its dependencies. */
export function getAgentVersionSelector(
  versions: VersionOverrides | undefined,
  agentId: string,
): VersionSelector | undefined {
  return (
    versions?.agents?.[agentId] ??
    (versions?.defaultLabel !== undefined ? { label: versions.defaultLabel } : undefined) ??
    (versions?.defaultStatus !== undefined ? { status: versions.defaultStatus } : undefined)
  );
}

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
