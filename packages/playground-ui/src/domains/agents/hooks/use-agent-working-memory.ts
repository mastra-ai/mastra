import { useState, useEffect, useCallback } from 'react';
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

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!agentId || !threadId) {
        setWorkingMemoryData(null);
        setIsLoading(false);
        return;
      }
      const res = await client.getWorkingMemory({ agentId, threadId, resourceId, requestContext });
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
      setWorkingMemoryData(null);
      console.error('Error fetching working memory', error);
    } finally {
      setIsLoading(false);
    }
  }, [agentId, threadId, resourceId]);

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
