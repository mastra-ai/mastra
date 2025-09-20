import { useQuery } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/playground-ui';

export const useNetworkMemory = (networkId?: string) => {
  const client = useMastraClient();

  return useQuery({
    queryKey: ['network', 'memory', networkId],
    queryFn: () => (networkId ? client.getNetworkMemoryStatus(networkId) : null),
    enabled: Boolean(networkId),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};

export const useNetworkThreads = ({
  resourceId,
  networkId,
  isMemoryEnabled,
}: {
  resourceId: string;
  networkId: string;
  isMemoryEnabled: boolean;
}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['network', 'threads', resourceId, networkId],
    queryFn: () => (isMemoryEnabled ? client.getNetworkMemoryThreads({ resourceId, networkId }) : null),
    enabled: Boolean(isMemoryEnabled),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};

export const useNetworkMessages = ({
  threadId,
  memory,
  networkId,
}: {
  threadId: string;
  memory: boolean;
  networkId: string;
}) => {
  const client = useMastraClient();
  return useQuery({
    queryKey: ['network', 'messages', threadId, networkId],
    queryFn: () => (memory ? client.getThreadMessages(threadId, { networkId }) : null),
    enabled: Boolean(memory),
    staleTime: 0,
    gcTime: 0,
    retry: false,
  });
};
