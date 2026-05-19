import type { BuilderModelPolicy } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

interface UseBuilderSettingsOptions {
  enabled?: boolean;
}

/**
 * Fetches agent builder settings from the server.
 * Returns feature flags and configuration set by admin.
 */
export const useBuilderSettings = (options?: UseBuilderSettingsOptions) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['builder-settings'],
    queryFn: () => client.getBuilderSettings(),
    enabled: options?.enabled ?? true,
  });
};

/**
 * Returns whether the agent builder is enabled.
 * Handles loading and error states gracefully.
 */
export const useIsBuilderEnabled = () => {
  const { data, isLoading, error } = useBuilderSettings();

  return {
    isEnabled: data?.enabled === true,
    isLoading,
    error,
  };
};

const INACTIVE_POLICY: BuilderModelPolicy = { active: false };

/**
 * Returns the server-derived `BuilderModelPolicy` for the builder surface
 * specifically. Reads the legacy `/editor/builder/settings` response, so it
 * applies regardless of which UI surface is rendering it.
 *
 * @deprecated Use {@link useModelPolicy} from `@/domains/llm` instead — it
 * reads the surface-scoped policy from the enclosing `<ModelPolicyProvider>`
 * so the editor and composer don't accidentally inherit builder restrictions.
 * This hook is preserved for in-flight callers and will be removed once all
 * consumers have migrated.
 */
export const useBuilderModelPolicy = (): BuilderModelPolicy => {
  const { data } = useBuilderSettings();
  return data?.modelPolicy ?? INACTIVE_POLICY;
};

export interface BuilderPickerVisibility {
  /** `null` ⇒ unrestricted; `Set` ⇒ explicit allowlist (may be empty). */
  visibleTools: Set<string> | null;
  /** `null` ⇒ unrestricted; `Set` ⇒ explicit allowlist (may be empty). */
  visibleAgents: Set<string> | null;
  /** `null` ⇒ unrestricted; `Set` ⇒ explicit allowlist (may be empty). */
  visibleWorkflows: Set<string> | null;
}

const UNRESTRICTED_PICKER: BuilderPickerVisibility = {
  visibleTools: null,
  visibleAgents: null,
  visibleWorkflows: null,
};

/**
 * Returns the server-resolved picker visibility for tools / agents / workflows.
 *
 * Defaults to fully unrestricted when the server didn't include a `picker`
 * field (older servers, builder disabled). When restricted for a kind, the
 * corresponding `visible*` Set holds the allowed IDs in admin-provided order.
 */
export const useBuilderPickerVisibility = (): BuilderPickerVisibility => {
  const { data } = useBuilderSettings();
  const picker = data?.picker;
  return useMemo<BuilderPickerVisibility>(() => {
    if (!picker) return UNRESTRICTED_PICKER;
    return {
      visibleTools: picker.visibleTools === null ? null : new Set(picker.visibleTools),
      visibleAgents: picker.visibleAgents === null ? null : new Set(picker.visibleAgents),
      visibleWorkflows: picker.visibleWorkflows === null ? null : new Set(picker.visibleWorkflows),
    };
  }, [picker]);
};
