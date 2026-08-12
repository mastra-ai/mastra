import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import { updateFactoryAutoRun } from '../ui/domains/workspaces/services/github';

export function useSetFactoryAutoRunMutation(factoryProjectId: string | undefined) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => {
      if (!factoryProjectId) throw new Error('Factory project is required');
      return updateFactoryAutoRun(baseUrl, factoryProjectId, enabled);
    },
    onSuccess: project => {
      queryClient.setQueryData(queryKeys.factoryProject(factoryProjectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
    },
  });
}
