import type { AiMessageType, MastraMessageV1, StorageThreadType as ThreadType } from '@mastra/core/memory';
import { useEffect } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';

import { fetcher } from '@/lib/utils';

export const useNetworkMemory = (networkId?: string) => {
  const {
    data: memory,
    isLoading,
    mutate,
  } = useSWR<{ result: boolean }>(`/api/memory/network/status?networkId=${networkId}`, fetcher, {
    fallbackData: { result: false },
    isPaused: () => !networkId,
  });
  return { memory, isLoading, mutate };
};

export const useNetworkThreads = ({
  resourceid,
  networkId,
  isMemoryEnabled,
}: {
  resourceid: string;
  networkId: string;
  isMemoryEnabled: boolean;
}) => {
  const {
    data: threads,
    isLoading,
    mutate,
  } = useSWR<Array<ThreadType>>(
    `/api/memory/network/threads?resourceid=${resourceid}&networkId=${networkId}`,
    fetcher,
    {
      fallbackData: [],
      isPaused: () => !resourceid || !networkId || !isMemoryEnabled,
      revalidateOnFocus: false,
    },
  );

  useEffect(() => {
    if (resourceid && networkId && isMemoryEnabled) {
      mutate();
    }
  }, [resourceid, networkId, isMemoryEnabled]);

  return { threads, isLoading, mutate };
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
  const { data, isLoading, mutate } = useSWR<{ uiMessages: Array<AiMessageType>; messages: Array<MastraMessageV1> }>(
    `/api/memory/network/threads/${threadId}/messages?networkId=${networkId}`,
    url => fetcher(url, true),
    {
      fallbackData: { uiMessages: [], messages: [] },
      revalidateOnFocus: false,
      isPaused: () => !threadId || !networkId,
      shouldRetryOnError: false,
    },
  );

  useEffect(() => {
    if (threadId && memory) {
      mutate();
    }
  }, [threadId, memory]);

  return { messages: data?.uiMessages, isLoading, mutate };
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
