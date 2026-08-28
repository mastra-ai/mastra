import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { updateFactoryAutomation } from '../ui/domains/workspaces/services/github';

export function useSetFactoryAutoRunMutation(factoryProjectId: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => updateFactoryAutomation(baseUrl, factoryProjectId, { autoRunEnabled: enabled }),
    onSuccess: project => {
      queryClient.setQueryData(queryKeys.factoryProject(factoryProjectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
    },
  });
}

/** Whether a started run must pause at its plan for review before building. */
export function useSetFactoryPlanReviewMutation(factoryProjectId: string) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) =>
      updateFactoryAutomation(baseUrl, factoryProjectId, { planReviewEnabled: enabled }),
    onSuccess: project => {
      queryClient.setQueryData(queryKeys.factoryProject(factoryProjectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
    },
  });
}
