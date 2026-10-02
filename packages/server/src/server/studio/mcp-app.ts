import { createHash } from 'node:crypto';
import { studioHtml } from '@internal/studio-mcp-app';
import type { MCPServerHTTPOptions } from '@mastra/core/mcp';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { z } from 'zod/v4';

interface StudioConnection {
  baseUrl: string;
  apiPrefix: string;
}

/** Each stateless request owns its server, so origins and prefixes cannot leak
 * between deployments. Release transport resources when that request finishes. */
class StudioMcpServer extends MCPServer {
  override async startHTTP(options: MCPServerHTTPOptions): Promise<void> {
    try {
      await super.startHTTP(options);
    } finally {
      await this.close();
    }
  }
}

export function createStudioMcpServer(connection: StudioConnection) {
  const configuration = JSON.stringify(connection).replace(/</g, '\\u003c');
  const html = studioHtml.replace('__MASTRA_STUDIO_MCP_CONFIG__', () => configuration);
  // Hosts can cache UI resources. Include both the bundle and connection in its
  // identity, so a new build or deployment never reuses stale UI/configuration.
  const revision = createHash('sha256').update(html).digest('hex').slice(0, 16);
  const uri = `ui://mastra-studio/traces-${revision}.html`;
  return new StudioMcpServer({
    id: 'mastra-studio',
    name: 'Mastra Studio',
    version: '0.1.0',
    tools: {
      open_studio: createTool({
        id: 'open_studio',
        description: 'Open Mastra Studio to connect to this public server and browse and filter its traces.',
        inputSchema: z.object({}),
        mcp: {
          annotations: {
            title: 'Open Mastra Studio',
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
          _meta: { ui: { resourceUri: uri }, 'openai/ui': { entrypoints: [{ type: 'global' }] } },
        },
        execute: async () => ({
          content: [{ type: 'text', text: 'Connect to the public Mastra server in Studio to view traces.' }],
        }),
      }),
    },
    appResources: {
      [uri]: {
        name: 'Mastra Studio Traces',
        description: 'A filterable, read-only Studio trace list.',
        html,
        meta: {
          csp: { connectDomains: [new URL(connection.baseUrl).origin], resourceDomains: [] },
          prefersBorder: false,
        },
      },
    },
  });
}
