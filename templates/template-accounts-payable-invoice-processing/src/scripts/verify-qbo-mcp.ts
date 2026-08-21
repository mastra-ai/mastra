import { createQuickBooksMcpToolClient } from '../mastra/phase2/adapters/mcp-tool-client.ts';
import { QuickBooksMcpAdapter } from '../mastra/phase2/adapters/quickbooks-mcp-adapter.ts';
import { resolveQuickBooksMcpConfiguration } from '../mastra/phase2/providers/quickbooks-mcp-provider.ts';

const { postingEnabled, postingConfig } = resolveQuickBooksMcpConfiguration(),
  client = createQuickBooksMcpToolClient({ enablePosting: postingEnabled }),
  adapter = new QuickBooksMcpAdapter(client, 1000, postingConfig);
try {
  await adapter.verifyTools();
  console.log(`QuickBooks MCP ${postingEnabled ? 'read and posting' : 'read'} tools verified`);
} finally {
  await adapter.disconnect();
}
