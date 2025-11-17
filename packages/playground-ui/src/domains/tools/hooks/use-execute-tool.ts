import { RequestContext } from '@mastra/core/di';

import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { toast } from 'sonner';

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

      try {
        const tool = client.getTool(toolId);

        const response = await tool.execute({ data: input, requestContext });

        return response;
      } catch (error) {
        toast.error('Error executing dev tool');
        console.error('Error executing dev tool:', error);
        throw error;
      }
    },
  });
};
