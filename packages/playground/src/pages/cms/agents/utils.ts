import { useMastraClient } from '@mastra/react';
import { useStoredAgent, type AgentFormValues } from '@mastra/playground-ui';

type MCPClientEntry = NonNullable<AgentFormValues['mcpClients']>[number];

// Collect MCP client IDs, creating new clients in parallel where needed
export async function collectMCPClientIds(
  mcpClients: MCPClientEntry[],
  client: ReturnType<typeof useMastraClient>,
): Promise<string[]> {
  const existingIds = mcpClients.filter(c => c.id).map(c => c.id!);
  const newIds = await Promise.all(
    mcpClients
      .filter(c => !c.id)
      .map(c =>
        client.createStoredMCPClient({ name: c.name, description: c.description, servers: c.servers }).then(r => r.id),
      ),
  );
  return [...existingIds, ...newIds];
}

// Type for the agent data (inferred from useStoredAgent)
export type StoredAgent = NonNullable<ReturnType<typeof useStoredAgent>['data']>;
