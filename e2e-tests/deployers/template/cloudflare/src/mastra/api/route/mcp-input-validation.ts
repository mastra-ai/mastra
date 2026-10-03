import { registerApiRoute } from '@mastra/core/server';
import { InternalMastraMCPClient } from '@mastra/mcp';

const client = new InternalMastraMCPClient({
  name: 'cloudflare-input-validator',
  server: { url: new URL('http://127.0.0.1:0/mcp') },
});

const tool = client.toolFromDefinition({
  definition: {
    name: 'weather',
    inputSchema: {
      type: 'object',
      properties: { city: { type: 'string' } },
      required: ['city'],
      additionalProperties: false,
    },
    server: { name: 'cloudflare-input-validator' },
  },
});

export const mcpInputValidationRoute = registerApiRoute('/mcp-input-validation', {
  method: 'POST',
  handler: async c => {
    const result = await tool.inputSchema!['~standard'].validate(await c.req.json());

    if (result.issues) {
      return c.json({ valid: false, issues: result.issues }, 400);
    }

    return c.json({ valid: true, value: result.value });
  },
});
