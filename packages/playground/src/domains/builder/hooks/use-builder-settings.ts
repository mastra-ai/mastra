import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

/**
 * Fetches agent builder settings from the server.
 * Returns feature flags and configuration set by admin.
 */
export const useBuilderSettings = () => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['builder-settings'],
    queryFn: () => client.getBuilderSettings(),
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
