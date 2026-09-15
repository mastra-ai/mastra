import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface DisconnectConnectionArgs {
  providerId: string;
  connectionId: string;
  /**
   * When `true`, the server skips the usage check and revokes the
   * connection at the provider before deleting the local row.
   */
  force?: boolean;
}

/**
 * Calls the provider-side revoke (best-effort) and drops the local
 * `tool_integration_connections` row. Server enforces the soft-vs-force rule.
 */
export const useDisconnectConnection = () => {
  const client = useMastraClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ providerId, connectionId, force }: DisconnectConnectionArgs) => {
      const integration = client.getToolProvider(providerId);
      return integration.disconnectConnection(connectionId, force ? { force } : undefined);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['tool-integration-connections', vars.providerId] });
    },
  });
};
