import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useMastraClient } from '@/contexts/mastra-client-context';

export function useAgentWorkingMemory(agentId: string, threadId: string, resourceId: string) {
  const client = useMastraClient();
  const [workingMemoryData, setWorkingMemoryData] = useState<string | null>(null);
  const [workingMemorySource, setWorkingMemorySource] = useState<'thread' | 'resource'>('thread');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!agentId || !threadId) {
        setWorkingMemoryData(null);
        setIsLoading(false);
        return;
      }
      const res = await client.getWorkingMemory(agentId, threadId, resourceId);
      const { workingMemory, source } = res as { workingMemory: string; source: 'thread' | 'resource' };
      setWorkingMemoryData(workingMemory);
      setWorkingMemorySource(source);
    } catch (error) {
      setWorkingMemoryData(null);
      console.error('Error fetching working memory', error);
      toast.error('Error fetching working memory');
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
      await client.updateWorkingMemory(agentId, threadId, newMemory, resourceId);
      setWorkingMemoryData(newMemory);
      toast.success('Working memory updated');
    } catch (error) {
      console.error('Error updating working memory', error);
      toast.error('Error updating working memory');
    } finally {
      setIsUpdating(false);
    }
  };

  return { workingMemoryData, workingMemorySource, isLoading, isUpdating, updateWorkingMemory, refetch };
}
