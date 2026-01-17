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
  /** Model to use for enhancement. Required when agentId is not provided. */
  model?: { provider: string; modelId: string };
}

/**
 * Hook for enhancing instructions/prompts using AI.
 *
 * - If agentId is provided, uses the agent-specific endpoint (can auto-select model from agent)
 * - If agentId is not provided, uses the generic endpoint (model is required)
 * - Context determines the enhancement strategy (agent instructions vs scorer prompts)
 */
export function usePromptEnhancer({ agentId, context = 'agent' }: UsePromptEnhancerProps = {}) {
  const client = useMastraClient();
  return useMutation({
    mutationFn: async ({ instructions, userComment, model }: EnhancePromptParams) => {
      try {
        if (agentId) {
          // Use agent-specific endpoint (model parameter not supported on this endpoint)
          return await client.getAgent(agentId).enhanceInstructions(instructions, userComment);
        } else {
          // For create mode without agentId, we need model selection
          // This is handled in the UI layer - for now throw error
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
