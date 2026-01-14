import { useMastraClient } from '@mastra/react';
import { useQuery } from '@tanstack/react-query';

import { workflowDefinitionsQueryKey } from './use-workflow-definitions';

export function useWorkflowDefinition(id: string | undefined) {
  const client = useMastraClient();

  return useQuery({
    queryKey: [...workflowDefinitionsQueryKey, id],
    queryFn: async () => {
      if (!id) throw new Error('Workflow definition ID is required');
      const definition = client.getWorkflowDefinition(id);
      return definition.details();
    },
    enabled: !!id,
  });
}
