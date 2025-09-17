import { toast } from 'sonner';
import { useSWRConfig } from 'swr';

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

export const useDeleteNetworkThread = () => {
  const { mutate } = useSWRConfig();

  const deleteThread = async ({
    threadId,
    resourceid,
    networkId,
  }: {
    threadId: string;
    networkId: string;
    resourceid: string;
  }) => {
    const deletePromise = fetch(`/api/memory/network/threads/${threadId}?networkId=${networkId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-mastra-dev-playground': 'true',
      },
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate(`/api/memory/network/threads?resourceid=${resourceid}&networkId=${networkId}`);
        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });
  };

  return { deleteThread };
};
