import { useMastraClient } from '@mastra/react';
import { useMutation, useQueryClient } from '@tanstack/react-query';

export interface RenameConnectionArgs {
  integrationId: string;
  connectionId: string;
  label: string | null;
}

/**
 * Patches the persisted label on a `tool_connections` row.
 *
 * Affects every agent that pins this connection — the picker shows
 * the persisted label as the inherited account name. Pass `null` or
 * an empty string to clear the label.
 */
export const useRenameConnection = () => {
  const client = useMastraClient();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ integrationId, connectionId, label }: RenameConnectionArgs) => {
      const integration = client.getToolIntegration(integrationId);
      return integration.renameConnection(connectionId, { label });
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ['tool-integration-connections', vars.integrationId] });
    },
  });
};
