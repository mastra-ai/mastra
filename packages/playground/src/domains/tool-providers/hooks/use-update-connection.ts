import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface UpdateConnectionArgs {
  providerId: string;
  connectionId: string;
  /**
   * New display label. Pass `null` (or an empty string) to clear the label.
   */
  label: string | null;
}

/**
 * Renames a `tool_provider_connections` row in place. Server enforces
 * ownership (owner / admin / shared scope). On success, invalidates both
 * the per-toolkit and the fan-out connection lists so the picker re-fetches.
 */
export const useUpdateConnection = () => {
  const client = useMastraClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ providerId, connectionId, label }: UpdateConnectionArgs) => {
      const integration = client.getToolProvider(providerId);
      return integration.updateConnection(connectionId, { label });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['tool-integration-connections', vars.providerId] });
      void qc.invalidateQueries({ queryKey: ['tool-integration-connections-all', vars.providerId] });
    },
  });
};
