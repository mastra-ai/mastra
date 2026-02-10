import { useState, useEffect, useCallback, useRef } from 'react';
import { useMastraClient } from '@mastra/react';
import { usePlaygroundStore } from '@/store/playground-store';

function parseJsonString(jsonString: string): any {
  try {
    return JSON.stringify(JSON.parse(jsonString), null, 2);
  } catch {
    return jsonString;
  }
}

export function useAgentWorkingMemory(agentId: string, threadId: string, resourceId: string) {
  const client = useMastraClient();
  const [threadExists, setThreadExists] = useState(false);
  const [workingMemoryData, setWorkingMemoryData] = useState<string | null>(null);
  const [workingMemorySource, setWorkingMemorySource] = useState<'thread' | 'resource'>('thread');
  const [workingMemoryFormat, setWorkingMemoryFormat] = useState<'json' | 'markdown'>('markdown');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const { requestContext } = usePlaygroundStore();
  const fetchIdRef = useRef(0);

  const refetch = useCallback(async () => {
    const currentFetchId = ++fetchIdRef.current;
    setIsLoading(true);
    try {
      if (!agentId || !threadId) {
        if (currentFetchId === fetchIdRef.current) {
          setWorkingMemoryData(null);
          setIsLoading(false);
        }
        return;
      }
      const res = await client.getWorkingMemory({ agentId, threadId, resourceId, requestContext });

      if (currentFetchId !== fetchIdRef.current) {
        return;
      }

      const { workingMemory, source, workingMemoryTemplate, threadExists } = res as {
        workingMemory: string | null;
        source: 'thread' | 'resource';
        workingMemoryTemplate: { content: string; format: 'json' | 'markdown' };
        threadExists: boolean;
      };
      setThreadExists(threadExists);
      setWorkingMemoryData(workingMemory);
      setWorkingMemorySource(source);
      setWorkingMemoryFormat(workingMemoryTemplate?.format || 'markdown');
      if (workingMemoryTemplate?.format === 'json') {
        let dataToSet = '';
        if (workingMemory) {
          dataToSet = parseJsonString(workingMemory);
        } else if (workingMemoryTemplate?.content) {
          dataToSet = parseJsonString(workingMemoryTemplate.content);
        } else {
          dataToSet = '';
        }
        setWorkingMemoryData(dataToSet);
      } else {
        setWorkingMemoryData(workingMemory || workingMemoryTemplate?.content || '');
      }
    } catch (error) {
      if (currentFetchId !== fetchIdRef.current) {
        return;
      }

      if (error && typeof error === 'object' && 'status' in error && (error as any).status === 403) {
        console.warn('Working memory: thread belongs to different resource, skipping');
        setWorkingMemoryData(null);
        setIsLoading(false);
        return;
      }

      setWorkingMemoryData(null);
      console.error('Error fetching working memory', error);
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [agentId, threadId, resourceId, requestContext, client]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const updateWorkingMemory = async (newMemory: string) => {
    setIsUpdating(true);
    try {
      if (workingMemoryFormat === 'json') {
        try {
          JSON.parse(newMemory);
        } catch (e) {
          throw new Error('Invalid JSON working memory');
        }
      }
      await client.updateWorkingMemory({ agentId, threadId, workingMemory: newMemory, resourceId, requestContext });
      refetch();
    } catch (error) {
      console.error('Error updating working memory', error);
      throw error;
    } finally {
      setIsUpdating(false);
    }
  };

  return {
    threadExists,
    workingMemoryData,
    workingMemorySource,
    workingMemoryFormat,
    isLoading,
    isUpdating,
    refetch,
    updateWorkingMemory,
  };
}
