import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { CreateStoredMCPClientParams, ListStoredMCPClientsParams } from '@mastra/client-js';

export const useStoredMCPClients = (params?: ListStoredMCPClientsParams) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['stored-mcp-clients', params],
    queryFn: () => client.listStoredMCPClients(params),
  });
};

export const useStoredMCPClientMutations = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: (params: CreateStoredMCPClientParams) => client.createStoredMCPClient(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-mcp-clients'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => client.getStoredMCPClient(id).delete(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stored-mcp-clients'] });
    },
  });

  return {
    createStoredMCPClient: createMutation,
    deleteStoredMCPClient: deleteMutation,
  };
};
