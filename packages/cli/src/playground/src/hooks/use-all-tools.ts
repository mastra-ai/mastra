import type { Tool } from '@mastra/core/tools';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useTools = () => {
  const [tools, setTools] = useState<Record<string, Tool<any, any, any, any>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTools = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/tools');
        if (!res.ok) {
          const error = await res.json();
          setTools({});
          console.error('Error fetching tools', error);
          toast.error(error?.error || 'Error fetching tools');
          return;
        }
        const tools = await res.json();
        setTools(tools);
      } catch (error) {
        setTools({});
        console.error('Error fetching tools', error);
        toast.error('Error fetching tools');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTools();
  }, []);

  return { tools, isLoading };
};

export const useTool = (toolId: string) => {
  const [tool, setTool] = useState<Tool<any, any, any, any> | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTool = async () => {
      setIsLoading(true);
      try {
        if (!toolId) {
          setTool(null);
          setIsLoading(false);
          return;
        }
        const res = await fetch(`/api/tools/${toolId}`);
        if (!res.ok) {
          const error = await res.json();
          setTool(null);
          console.error('Error fetching tool', error);
          toast.error(error?.error || 'Error fetching tool');
          return;
        }
        const tool = await res.json();
        setTool(tool);
      } catch (error) {
        setTool(null);
        console.error('Error fetching tool', error);
        toast.error('Error fetching tool');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTool();
  }, [toolId]);

  return { tool, isLoading };
};
