import type { AgentBuilderConfigResponse } from '@mastra/client-js';
import { useMastraPackages } from '@/domains/configuration';

/**
 * Returns the resolved Agent Studio configuration reported by the server, or
 * `null` when the feature is not enabled. The shape mirrors
 * `MastraAgentBuilderConfig` on the server side (with defaults applied).
 */
export const useAgentStudioConfig = (): {
  config: AgentBuilderConfigResponse | null;
  isLoading: boolean;
} => {
  const { data, isLoading } = useMastraPackages();
  return {
    config: data?.agentBuilderConfig ?? null,
    isLoading,
  };
};
