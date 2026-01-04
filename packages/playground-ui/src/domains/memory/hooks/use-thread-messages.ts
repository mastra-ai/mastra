import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';
import type { MastraDBMessage } from '@mastra/core/agent';

export type ThreadMessagesOrderBy = {
  field: 'createdAt';
  direction: 'ASC' | 'DESC';
};

// Date range filter that matches the storage API
export type ThreadMessagesDateFilter = {
  dateRange?: {
    start?: Date;
    end?: Date;
    startExclusive?: boolean;
    endExclusive?: boolean;
  };
};

// Extended filter for client-side filtering (role is filtered client-side)
export type ThreadMessagesFilter = ThreadMessagesDateFilter & {
  role?: 'user' | 'assistant' | 'system';
};

export type UseThreadMessagesParams = {
  threadId: string;
  agentId: string;
  page?: number;
  perPage?: number;
  orderBy?: ThreadMessagesOrderBy;
  filter?: ThreadMessagesFilter;
  enabled?: boolean;
};

export type ThreadMessagesResponse = {
  messages: MastraDBMessage[];
  total?: number;
  page?: number;
  perPage?: number;
  hasMore?: boolean;
};

export const useThreadMessages = ({
  threadId,
  agentId,
  page = 1,
  perPage = 50,
  orderBy = { field: 'createdAt', direction: 'DESC' },
  filter,
  enabled = true,
}: UseThreadMessagesParams) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  // Separate API filter (dateRange only) from client-side filter (role)
  const apiFilter: ThreadMessagesDateFilter | undefined = filter?.dateRange ? { dateRange: filter.dateRange } : undefined;

  return useQuery<ThreadMessagesResponse>({
    queryKey: ['memory', 'thread-messages', threadId, agentId, page, perPage, orderBy, filter],
    queryFn: async () => {
      const thread = client.getMemoryThread({ threadId, agentId });
      const result = await thread.listMessages({
        page,
        perPage,
        orderBy,
        filter: apiFilter,
        resourceId: agentId,
        requestContext,
      });
      return {
        messages: result.messages || [],
        total: (result as any).total,
        page: (result as any).page ?? page,
        perPage: (result as any).perPage ?? perPage,
        hasMore: (result as any).hasMore ?? false,
      };
    },
    enabled: Boolean(enabled && threadId && agentId),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};

export const useDeleteMessages = () => {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();

  return useMutation({
    mutationFn: async ({
      threadId,
      agentId,
      messageIds,
    }: {
      threadId: string;
      agentId: string;
      messageIds: string[];
    }) => {
      const thread = client.getMemoryThread({ threadId, agentId });
      return thread.deleteMessages(messageIds, requestContext);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['memory', 'thread-messages', variables.threadId, variables.agentId],
      });
    },
  });
};

export const useThreadMessageCount = ({
  threadId,
  agentId,
  enabled = true,
}: {
  threadId: string;
  agentId: string;
  enabled?: boolean;
}) => {
  const client = useMastraClient();
  const { requestContext } = usePlaygroundStore();

  return useQuery<{ total: number; userCount: number; assistantCount: number }>({
    queryKey: ['memory', 'thread-message-count', threadId, agentId],
    queryFn: async () => {
      const thread = client.getMemoryThread({ threadId, agentId });
      // Get a single page to get total count
      const result = await thread.listMessages({
        page: 1,
        perPage: 1,
        resourceId: agentId,
        requestContext,
      });
      
      const total = (result as any).total ?? result.messages?.length ?? 0;
      
      // For now, estimate user/assistant split (could be enhanced with server-side aggregation)
      return {
        total,
        userCount: Math.ceil(total / 2),
        assistantCount: Math.floor(total / 2),
      };
    },
    enabled: Boolean(enabled && threadId && agentId),
    staleTime: 60 * 1000, // 1 minute
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
};
