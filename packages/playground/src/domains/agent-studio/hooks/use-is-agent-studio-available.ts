import { useMastraPackages } from '@/domains/configuration';

/**
 * Returns whether the end-user Agent Studio surface is available on this
 * server. This is driven by `/system/packages`, which sets
 * `agentBuilderEnabled: true` iff:
 *   - A `MastraAgentBuilder` is attached to `Mastra`, AND
 *   - The server's EE license gate allows it (dev carve-out or a valid
 *     `MASTRA_EE_LICENSE` that includes the `agent-builder` feature).
 */
export const useIsAgentStudioAvailable = () => {
  const { data, isLoading: isLoadingPackages } = useMastraPackages();

  const isAgentStudioAvailable = Boolean(data?.agentBuilderEnabled);

  return { isAgentStudioAvailable, isLoading: isLoadingPackages };
};
