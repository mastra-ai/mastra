import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { CreateStoredMCPServerParams, UpdateStoredMCPServerParams } from '@mastra/client-js';

export const useStoredMCPServer = (serverId?: string, options?: { status?: 'draft' | 'published' }) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery({
    queryKey: ['stored-mcp-server', serverId, options?.status, requestContext],
    queryFn: async () => {
      if (!serverId) return null;
      const res = client.getStoredMCPServer(serverId).details(requestContext);
      return res;
    },
    enabled: Boolean(serverId),
  });
};

export const useStoredMCPServerMutations = (serverId?: string) => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['mcp-servers'] });
    queryClient.invalidateQueries({ queryKey: ['workspaces'] });
    if (serverId) {
      queryClient.invalidateQueries({ queryKey: ['mcp-server', serverId] });
      queryClient.invalidateQueries({ queryKey: ['stored-mcp-server', serverId] });
      queryClient.invalidateQueries({ queryKey: ['mcpserver-tools', serverId] });
    }
  };

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredMCPServerParams) => client.createStoredMCPServer(params),
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: (params: UpdateStoredMCPServerParams) => {
      if (!serverId) throw new Error('serverId is required for update');
      return client.getStoredMCPServer(serverId).update(params, requestContext);
    },
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: () => {
      if (!serverId) throw new Error('serverId is required for delete');
      return client.getStoredMCPServer(serverId).delete(requestContext);
    },
    onSuccess: invalidateAll,
  });

  return {
    createStoredMCPServer: createMutation,
    updateStoredMCPServer: updateMutation,
    deleteStoredMCPServer: deleteMutation,
  };
};
