import { createTool } from '@mastra/core/tools';
import { z } from 'zod/v3';
import { MCPServer } from '../server/server';

export function createConformanceServer() {
  return new MCPServer({
    name: 'Mastra MCP Conformance Server',
    version: '1.0.0',
    protocolVersion: '2026-07-28',
    tools: {
      conformanceEcho: createTool({
        id: 'conformanceEcho',
        description: 'Echoes a value for MCP conformance smoke tests',
        inputSchema: z.object({ value: z.string().optional() }),
        execute: async ({ value }) => value ?? 'ok',
      }),
    },
  });
}
