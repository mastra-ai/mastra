import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export function useDeleteMemoryThread() {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ threadId, agentId }: { threadId: string; agentId: string }) =>
      client.getMemoryThread({ threadId, agentId }).delete({ agentId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['memory', 'threads'] });
    },
  });
}
