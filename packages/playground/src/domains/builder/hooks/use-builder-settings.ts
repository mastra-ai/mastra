import type { BuilderModelPolicy } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

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
 * Returns the server-derived `BuilderModelPolicy`.
 *
 * Thin selector — the server is the single owner of policy derivation. Callers
 * that need to know whether the model picker is visible, what's allowed, or
 * what the admin's default is should consume this hook directly.
 *
 * Defaults to `{ active: false }` while loading or when the server didn't
 * include a `modelPolicy` field (older servers / OSS builds), so consumers
 * can rely on `policy.active === false` as the "no admin policy" guard.
 */
export const useBuilderModelPolicy = (): BuilderModelPolicy => {
  const { data } = useBuilderSettings();
  return data?.modelPolicy ?? INACTIVE_POLICY;
};
