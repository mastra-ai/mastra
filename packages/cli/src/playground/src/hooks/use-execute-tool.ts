import { useState } from 'react';
import { toast } from 'sonner';

export const useExecuteTool = () => {
  const [isExecuting, setIsExecuting] = useState(false);

  const executeTool = async ({ toolId, input }: { toolId: string; input: any }) => {
    try {
      setIsExecuting(true);
      const response = await fetch(`/api/tools/${toolId}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: input }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error?.error || 'Error executing dev tool');
        throw new Error(`Error executing dev tool: ${error?.error || response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error executing dev tool:', error);
      throw error;
    } finally {
      setIsExecuting(false);
    }
  };

  return { executeTool, isExecuting };
};
