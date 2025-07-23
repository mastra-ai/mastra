import type { AiMessageType, MastraMessageV1, StorageThreadType as ThreadType } from '@mastra/core/memory';
import { useEffect } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';
import { useQuery } from '@tanstack/react-query';

import { fetcher } from '@/lib/utils';
import type { MemoryConfigResponse, MemorySearchResponse, MemorySearchParams } from '@/types/memory';

export const useMemory = (agentId?: string) => {
  const {
    data: memory,
    isLoading,
    mutate,
  } = useSWR<{ result: boolean }>(`/api/memory/status?agentId=${agentId}`, fetcher, {
    fallbackData: { result: false },
    isPaused: () => !agentId,
  });
  return { memory, isLoading, mutate };
};

export const useMemoryConfig = (agentId?: string) => {
  const {
    data: config,
    isLoading,
    refetch: mutate,
  } = useQuery<MemoryConfigResponse>({
    queryKey: ['memory', 'config', agentId],
    queryFn: () => fetcher(`/api/memory/config?agentId=${agentId}`),
    enabled: !!agentId,
  });
  return { config: config?.config, isLoading, mutate };
};

export const useThreads = ({
  resourceid,
  agentId,
  isMemoryEnabled,
}: {
  resourceid: string;
  agentId: string;
  isMemoryEnabled: boolean;
}) => {
  const {
    data: threads,
    isLoading,
    mutate,
  } = useSWR<Array<ThreadType>>(`/api/memory/threads?resourceid=${resourceid}&agentId=${agentId}`, fetcher, {
    fallbackData: [],
    isPaused: () => !resourceid || !agentId || !isMemoryEnabled,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (resourceid && agentId && isMemoryEnabled) {
      mutate();
    }
  }, [resourceid, agentId, isMemoryEnabled]);

  useEffect(() => {
    const refetchThreads = async (count = 0) => {
      const newThreads = await mutate();
      if (newThreads?.length) {
        const lastThread = newThreads[newThreads.length - 1];
        count = count + 1;
        if (lastThread?.title?.toLowerCase()?.includes('new thread') && count < 3) {
          setTimeout(() => {
            refetchThreads(count);
          }, 500);
        }
      }
    };
    if (threads?.length) {
      const lastThread = threads[threads.length - 1];
      if (lastThread?.title?.toLowerCase()?.includes('new thread')) {
        setTimeout(() => {
          refetchThreads();
        }, 500);
      }
    }
  }, [threads]);

  return { threads, isLoading, mutate };
};

export const useMessages = ({ threadId, memory, agentId }: { threadId: string; memory: boolean; agentId: string }) => {
  const { data, isLoading, mutate } = useSWR<{ uiMessages: Array<AiMessageType>; messages: Array<MastraMessageV1> }>(
    `/api/memory/threads/${threadId}/messages?agentId=${agentId}`,
    url => fetcher(url, true),
    {
      fallbackData: { uiMessages: [], messages: [] },
      revalidateOnFocus: false,
      isPaused: () => !threadId || !agentId,
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

export const useDeleteThread = () => {
  const { mutate } = useSWRConfig();

  const deleteThread = async ({
    threadId,
    resourceid,
    agentId,
  }: {
    threadId: string;
    agentId: string;
    resourceid: string;
  }) => {
    const deletePromise = fetch(`/api/memory/threads/${threadId}?agentId=${agentId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'x-mastra-dev-playground': 'true',
      },
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate(`/api/memory/threads?resourceid=${resourceid}&agentId=${agentId}`);
        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });
  };

  return { deleteThread };
};

export const useMemorySearch = ({
  agentId,
  resourceId,
  threadId,
}: {
  agentId: string;
  resourceId: string;
  threadId?: string;
}) => {
  const searchMemory = async (searchQuery: string, memoryConfig?: MemorySearchParams) => {
    if (!searchQuery.trim()) {
      return { results: [], count: 0, query: searchQuery };
    }

    const params = new URLSearchParams({
      searchQuery,
      resourceId,
      agentId,
    });

    if (threadId) {
      params.append('threadId', threadId);
    }

    if (memoryConfig) {
      params.append('memoryConfig', JSON.stringify(memoryConfig));
    }

    const response = await fetch(`/api/memory/search?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'x-mastra-dev-playground': 'true',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Unknown error' }));
      console.error('Search memory error:', errorData);
      throw new Error(errorData.message || errorData.error || 'Failed to search memory');
    }

    return response.json() as Promise<MemorySearchResponse>;
  };

  return { searchMemory };
};
