import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

interface UseBuilderSettingsOptions {
  /** Skip fetch when false (default: true) */
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
