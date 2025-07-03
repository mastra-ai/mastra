import { useState, useEffect } from 'react';
import { client } from '@/lib/client';
import { toast } from 'sonner';

export function useAgentWorkingMemory(agentId: string, threadId: string, resourceId: string) {
  const [workingMemory, setWorkingMemory] = useState<string | null>(null);
  const [workingMemorySource, setWorkingMemorySource] = useState<'thread' | 'resource'>('thread');
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchWorkingMemory = async () => {
      setIsLoading(true);
      try {
        if (!agentId || !threadId) {
          setWorkingMemory(null);
          setIsLoading(false);
          return;
        }
        const res = await client.getWorkingMemory(agentId, threadId);
        const { workingMemory, source } = res as { workingMemory: string; source: 'thread' | 'resource' };
        setWorkingMemory(workingMemory);
        setWorkingMemorySource(source);
      } catch (error) {
        setWorkingMemory(null);
        console.error('Error fetching working memory', error);
        toast.error('Error fetching working memory');
      } finally {
        setIsLoading(false);
      }
    };
    fetchWorkingMemory();
  }, [agentId, threadId]);

  const updateWorkingMemory = async (newMemory: string) => {
    setIsUpdating(true);
    try {
      await client.updateWorkingMemory(agentId, threadId, newMemory, resourceId);
      setWorkingMemory(newMemory);
      toast.success('Working memory updated');
    } catch (error) {
      console.error('Error updating working memory', error);
      toast.error('Error updating working memory');
    } finally {
      setIsUpdating(false);
    }
  };

  return { workingMemory, workingMemorySource, isLoading, isUpdating, updateWorkingMemory };
}
