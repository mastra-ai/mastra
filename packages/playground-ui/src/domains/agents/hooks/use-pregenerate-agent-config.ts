import { useMutation } from '@tanstack/react-query';
import { useMastraClient } from '@mastra/react';
import type { PregenerateAgentConfigParams, PregenerateAgentConfigResponse } from '@mastra/client-js';
import { toast } from '@/lib/toast';

/**
 * Hook for pregenerating agent configuration using AI.
 *
 * Takes agent identity (name, description, model) and available resources,
 * then uses AI to suggest appropriate configuration including instructions,
 * tools, workflows, agents, memory, and scorers.
 */
export function usePregenerateAgentConfig() {
  const client = useMastraClient();

  return useMutation<PregenerateAgentConfigResponse, Error, PregenerateAgentConfigParams>({
    mutationFn: params => client.pregenerateAgentConfig(params),
    onError: error => {
      const errorMessage = error instanceof Error ? error.message : 'Error generating agent configuration';
      toast.error(errorMessage);
      console.error('Error pregenerating agent config:', error);
    },
  });
}
