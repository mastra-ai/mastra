import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useApiConfig } from '../api/config';
import { queryKeys } from '../api/keys';
import type { FactoryProjectPayload } from '../ui/domains/workspaces/services/github';
import { updateFactoryAutomation } from '../ui/domains/workspaces/services/github';

type AutomationSetting = keyof Pick<FactoryProjectPayload, 'autoRunEnabled' | 'autoApprovePlans'>;

/** Toggle one of a Factory's automation settings: rule-started runs, plan approval. */
export function useSetFactoryAutomationMutation(factoryProjectId: string, setting: AutomationSetting) {
  const { baseUrl } = useApiConfig();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (enabled: boolean) => updateFactoryAutomation(baseUrl, factoryProjectId, { [setting]: enabled }),
    onSuccess: project => {
      queryClient.setQueryData(queryKeys.factoryProject(factoryProjectId), project);
      void queryClient.invalidateQueries({ queryKey: queryKeys.factories() });
    },
  });
}
