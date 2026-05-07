import { useState } from 'react';
import { useMastraClient } from '@mastra/react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from '@mastra/playground-ui';
import { usePlaygroundStore } from '@/store/playground-store';

export const useCloneAgent = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();
  const [isCloning, setIsCloning] = useState(false);

  const cloneAgent = async (agentId: string) => {
    setIsCloning(true);
    try {
      const result = await client.getAgent(agentId).clone({ requestContext });
      queryClient.invalidateQueries({ queryKey: ['agents'] });
      queryClient.invalidateQueries({ queryKey: ['stored-agents'] });
      toast.success(`Agent cloned successfully`);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to clone agent';
      toast.error(message);
      return null;
    } finally {
      setIsCloning(false);
    }
  };

  return { cloneAgent, isCloning };
};
