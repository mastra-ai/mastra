import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';

interface UsePromptEnhancerProps {
  agentId: string;
}

export function usePromptEnhancer({ agentId }: UsePromptEnhancerProps) {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ instructions, userComment }: { instructions: string; userComment: string }) => {
      return await client.getAgent(agentId).enhanceInstructions(instructions, userComment);
    },
  });
}
