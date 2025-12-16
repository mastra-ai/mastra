import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { toast } from '@/lib/toast';

interface UsePromptEnhancerProps {
  agentId: string;
}

export function usePromptEnhancer({ agentId }: UsePromptEnhancerProps) {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ instructions, userComment }: { instructions: string; userComment: string }) => {
      try {
        return await client.getAgent(agentId).enhanceInstructions(instructions, userComment);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error enhancing prompt';
        toast.error(errorMessage);
        console.error('Error enhancing prompt:', error);
        throw error;
      }
    },
  });
}
