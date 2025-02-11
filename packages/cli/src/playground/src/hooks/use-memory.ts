import { AiMessageType, MessageType, StorageThreadType as ThreadType } from '@mastra/core/memory';
import { useEffect } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';

import { fetcher } from '@/lib/utils';

export const useMemory = (agentId?: string) => {
  const {
    data: memory,
    isLoading,
    mutate,
  } = useSWR<{ result: boolean }>(`/api/memory/status?agentId=${agentId}`, fetcher, {
    fallbackData: { result: false },
  });
  return { memory, isLoading, mutate };
};

export const useThreads = ({ resourceid, agentId }: { resourceid: string; agentId: string }) => {
  const {
    data: threads,
    isLoading,
    mutate,
  } = useSWR<Array<ThreadType>>(`/api/memory/threads?resourceid=${resourceid}&agentId=${agentId}`, fetcher, {
    fallbackData: [],
    isPaused: () => !resourceid,
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (resourceid) {
      mutate();
    }
  }, [resourceid]);

  return { threads, isLoading, mutate };
};

export const useMessages = ({ threadId, memory, agentId }: { threadId: string; memory: boolean; agentId: string }) => {
  const { data, isLoading, mutate } = useSWR<{ uiMessages: Array<AiMessageType>; messages: Array<MessageType> }>(
    `/api/memory/threads/${threadId}/messages?agentId=${agentId}`,
    url => fetcher(url, true),
    {
      fallbackData: { uiMessages: [], messages: [] },
      revalidateOnFocus: false,
      isPaused: () => !threadId,
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
