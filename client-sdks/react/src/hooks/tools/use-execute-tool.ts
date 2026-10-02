import { RequestContext } from '@mastra/core/di';

import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '../../mastra-client-context';

export const useExecuteTool = () => {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({
      toolId,
      input,
      requestContext: playgroundRequestContext,
    }: {
      toolId: string;
      input: any;
      requestContext?: Record<string, any>;
    }) => {
      const requestContext = new RequestContext();
      Object.entries(playgroundRequestContext ?? {}).forEach(([key, value]) => {
        requestContext.set(key, value);
      });

      const tool = client.getTool(toolId);
      return tool.execute({ data: input, requestContext });
    },
  });
};
