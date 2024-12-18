import { Tool } from '@mastra/core';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

export const useDevTools = () => {
  const [devTools, setDevTools] = useState<Record<string, Tool<any, any, any, any>>>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDevTools = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/dev-tools');
        if (!res.ok) {
          const error = await res.json();
          setDevTools({});
          console.error('Error fetching dev tools', error);
          toast.error(error?.error || 'Error fetching dev tools');
          return;
        }
        const tools = await res.json();
        setDevTools(tools);
      } catch (error) {
        setDevTools({});
        console.error('Error fetching dev tools', error);
        toast.error('Error fetching dev tools');
      } finally {
        setIsLoading(false);
      }
    };

    fetchDevTools();
  }, []);

  return { devTools, isLoading };
};

export const useDevTool = (toolId: string) => {
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
        const res = await fetch(`/api/dev-tools/${toolId}`);
        if (!res.ok) {
          const error = await res.json();
          setTool(null);
          console.error('Error fetching dev tool', error);
          toast.error(error?.error || 'Error fetching dev tool');
          return;
        }
        const tool = await res.json();
        setTool(tool);
      } catch (error) {
        setTool(null);
        console.error('Error fetching dev tool', error);
        toast.error('Error fetching dev tool');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTool();
  }, [toolId]);

  return { tool, isLoading };
};
