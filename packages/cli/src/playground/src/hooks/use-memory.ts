import { AiMessageType, MessageType, StorageThreadType as ThreadType } from '@mastra/core/memory';
import { useEffect } from 'react';
import { toast } from 'sonner';
import useSWR, { useSWRConfig } from 'swr';

import { fetcher } from '@/lib/utils';

export const useMemory = () => {
  const {
    data: memory,
    isLoading,
    mutate,
  } = useSWR<{ result: boolean }>('/api/memory/status', fetcher, {
    fallbackData: { result: false },
  });
  return { memory, isLoading, mutate };
};

export const useThreads = ({ resourceid }: { resourceid: string }) => {
  const {
    data: threads,
    isLoading,
    mutate,
  } = useSWR<Array<ThreadType>>(`/api/memory/threads?resourceid=${resourceid}`, fetcher, {
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

export const useMessages = ({ threadId, memory }: { threadId: string; memory: boolean }) => {
  const { data, isLoading, mutate } = useSWR<{ uiMessages: Array<AiMessageType>; messages: Array<MessageType> }>(
    `/api/memory/threads/${threadId}/messages`,
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

  const deleteThread = async ({ threadId, resourceid }: { threadId: string; resourceid: string }) => {
    const deletePromise = fetch(`/api/memory/threads/${threadId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    toast.promise(deletePromise, {
      loading: 'Deleting chat...',
      success: () => {
        mutate(`/api/memory/threads?resourceid=${resourceid}`);
        return 'Chat deleted successfully';
      },
      error: 'Failed to delete chat',
    });
  };

  return { deleteThread };
};
