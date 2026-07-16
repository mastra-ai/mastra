import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { fetchIntakeConfig, saveIntakeConfig } from '../../web/ui/domains/factory/services/intake';
import type { IntakeConfig } from '../../web/ui/domains/factory/services/intake';

/** The caller's intake source configuration (Settings › Intake). */
export function useIntakeConfigQuery(enabled: boolean = true) {
  const { baseUrl } = useApiConfig();
  return useQuery({
    queryKey: queryKeys.intakeConfig(),
    queryFn: () => fetchIntakeConfig(baseUrl),
    enabled,
  });
}

/**
 * Persist the intake config. On success the config cache is updated in place
 * and the Linear issue list is invalidated — the server applies the project
 * selection, so a config change can alter its results.
 */
export function useSaveIntakeConfigMutation() {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: IntakeConfig) => saveIntakeConfig(baseUrl, config),
    onSuccess: saved => {
      queryClient.setQueryData(queryKeys.intakeConfig(), saved);
      void queryClient.invalidateQueries({ queryKey: queryKeys.linearIssues() });
    },
  });
}
