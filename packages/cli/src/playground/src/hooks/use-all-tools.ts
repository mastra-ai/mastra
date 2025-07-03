import type { GetToolResponse } from '@mastra/client-js';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { client } from '@/lib/client';

export const useTools = () => {
  const [tools, setTools] = useState<Record<string, GetToolResponse>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchTools = async () => {
      setIsLoading(true);
      try {
        const tools = await client.getTools();
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
  const [tool, setTool] = useState<GetToolResponse | null>(null);
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
        const tool = client.getTool(toolId);
        const toolResponse = await tool.details();
        setTool(toolResponse);
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
