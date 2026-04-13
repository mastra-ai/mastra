import type { MastraClient } from '@mastra/client-js';

import type { AgentFormValues } from '../components/agent-edit-page/utils/form-validation';

type MCPClientEntry = NonNullable<AgentFormValues['mcpClients']>[number];

export async function collectMCPClientIds(mcpClients: MCPClientEntry[], client: MastraClient): Promise<string[]> {
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
