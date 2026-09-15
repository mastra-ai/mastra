import { createTool } from '@mastra/core/tools';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { MCPServer } from './server';

describe('MCPServer legacy app capability', () => {
  it('advertises the MCP Apps extension for a legacy-only resource URI', () => {
    const server = new MCPServer({
      id: 'legacy-app-server',
      name: 'legacy-app-server',
      version: '1.0.0',
      tools: {
        legacyTool: createTool({
          id: 'legacy-tool',
          description: 'Tool using only the legacy app resource URI key',
          inputSchema: z.object({}),
          mcp: { _meta: { 'ui/resourceUri': 'ui://weather/legacy.html' } },
          execute: async () => ({ ok: true }),
        }),
      },
    });

    const initialCapabilities = (server as any).server.getCapabilities();
    const sessionCapabilities = (server as any).createServerInstance().getCapabilities();

    expect(initialCapabilities.extensions).toHaveProperty('io.modelcontextprotocol/ui');
    expect(sessionCapabilities.extensions).toHaveProperty('io.modelcontextprotocol/ui');
  });
});
