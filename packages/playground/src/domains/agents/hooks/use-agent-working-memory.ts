import type { GetWorkingMemoryResponse } from '@mastra/client-js';
import { useMastraClient } from '@mastra/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { usePlaygroundStore } from '@/store/playground-store';

type WorkingMemoryResponse = GetWorkingMemoryResponse;

interface WorkingMemoryTemplate {
  content?: string;
  format?: 'json' | 'markdown';
}

const isTemplate = (value: unknown): value is WorkingMemoryTemplate => typeof value === 'object' && value !== null;

const templateOf = (res: WorkingMemoryResponse): WorkingMemoryTemplate | null =>
  isTemplate(res.workingMemoryTemplate) ? res.workingMemoryTemplate : null;

const contentOf = (res: WorkingMemoryResponse): string | null =>
  typeof res.workingMemory === 'string' ? res.workingMemory : null;

function parseJsonString(jsonString: string): string {
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2);
  } catch {
    return jsonString;
  }
}

export function formatWorkingMemory(res: WorkingMemoryResponse): string {
  const template = templateOf(res);
  const content = contentOf(res);
  if (template?.format === 'json') {
    if (content) return parseJsonString(content);
    if (template.content) return parseJsonString(template.content);
    return '';
  }
  return content || template?.content || '';
}

export function useAgentWorkingMemory(agentId: string, threadId: string, resourceId: string) {
  const client = useMastraClient();
  const queryClient = useQueryClient();
  const { requestContext } = usePlaygroundStore();
  const queryKey = ['working-memory', agentId, threadId, resourceId, requestContext];

  const query = useQuery<WorkingMemoryResponse>({
    queryKey,
    queryFn: () => client.getWorkingMemory({ agentId, threadId, resourceId, requestContext }),
    enabled: Boolean(agentId && threadId),
    retry: false,
  });

  const data = query.data;
  const workingMemoryFormat = (data && templateOf(data)?.format) || 'markdown';

  const mutation = useMutation({
    mutationFn: async (newMemory: string) => {
      if (workingMemoryFormat === 'json') {
        try {
          JSON.parse(newMemory);
        } catch {
          throw new Error('Invalid JSON working memory');
        }
      }
      await client.updateWorkingMemory({ agentId, threadId, workingMemory: newMemory, resourceId, requestContext });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  return {
    threadExists: data?.threadExists ?? false,
    workingMemoryData: data ? formatWorkingMemory(data) : null,
    workingMemorySource: data?.source ?? 'thread',
    workingMemoryFormat,
    isLoading: query.isLoading,
    isUpdating: mutation.isPending,
    refetch: query.refetch,
    updateWorkingMemory: async (newMemory: string) => {
      await mutation.mutateAsync(newMemory);
    },
  };
}
