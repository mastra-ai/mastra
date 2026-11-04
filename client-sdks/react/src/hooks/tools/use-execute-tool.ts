import type { MastraClient } from '@mastra/client-js';
import { RequestContext } from '@mastra/core/di';

import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';
import type { MastraMutationOptions } from '../shared/query-options';

type ExecuteToolResponse = Awaited<ReturnType<ReturnType<MastraClient['getTool']>['execute']>>;
type ExecuteToolVariables = { toolId: string; input: any; requestContext?: Record<string, any> };

export const useExecuteTool = ({
  queryOptions,
}: {
  queryOptions?: MastraMutationOptions<ExecuteToolResponse, ExecuteToolVariables>;
} = {}) => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ toolId, input, requestContext: playgroundRequestContext }: ExecuteToolVariables) => {
      const requestContext = new RequestContext();
      Object.entries(playgroundRequestContext ?? {}).forEach(([key, value]) => {
        requestContext.set(key, value);
      });

      const tool = client.getTool(toolId);
      return tool.execute({ data: input, requestContext });
    },
    ...queryOptions,
  });
};
