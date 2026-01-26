import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import { toast } from '@/lib/toast';

/** Context type for the prompt enhancer - determines the enhancement strategy */
export type EnhancerContext = 'agent' | 'scorer';

interface UsePromptEnhancerProps {
  /** Agent ID - if provided, uses the agent's enhance endpoint. If not, uses the generic endpoint. */
  agentId?: string;
  /** Context for enhancement - determines what kind of prompt is being enhanced */
  context?: EnhancerContext;
}

interface EnhancePromptParams {
  instructions: string;
  userComment: string;
}

/**
 * Hook for enhancing instructions/prompts using AI.
 *
 * - Requires agentId to be provided - uses the agent-specific endpoint
 * - The agent's model configuration is used for enhancement
 * - Context determines the enhancement strategy (agent instructions vs scorer prompts)
 *
 * Note: Enhancement without an agent context is not currently supported.
 */
export function usePromptEnhancer({ agentId, context = 'agent' }: UsePromptEnhancerProps = {}) {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ instructions, userComment }: EnhancePromptParams) => {
      try {
        if (agentId) {
          // Use agent-specific endpoint with the agent's configured model
          return await client.getAgent(agentId).enhanceInstructions(instructions, userComment);
        } else {
          // Enhancement requires an agent context
          throw new Error('Enhancement requires an agent context');
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Error enhancing prompt';
        toast.error(errorMessage);
        console.error('Error enhancing prompt:', error);
        throw error;
      }
    },
  });
}
