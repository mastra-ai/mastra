import { createTool } from '@mastra/core/tools';
import { jsonSchemaToModel } from '@mastra/core/utils';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { Protocol } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { ListResourcesResultSchema } from '@modelcontextprotocol/sdk/types.js';

type SSEClientParameters = {
  url: URL;
} & ConstructorParameters<typeof SSEClientTransport>[1];

export class MastraMCPClient {
  name: string;
  private transport: Transport;
  private client: Client;
  constructor({
    name,
    version = '1.0.0',
    server,
    capabilities = {},
  }: {
    name: string;
    server: StdioServerParameters | SSEClientParameters;
    capabilities?: ClientCapabilities;
    version?: string;
  }) {
    this.name = name;

    if (`url` in server) {
      this.transport = new SSEClientTransport(server.url, {
        requestInit: server.requestInit,
        eventSourceInit: server.eventSourceInit,
      });
    } else {
      this.transport = new StdioClientTransport(server);
    }

    this.client = new Client(
      {
        name,
        version,
      },
      {
        capabilities,
      },
    );
  }

  async connect() {
    return await this.client.connect(this.transport);
  }

  async disconnect() {
    return await this.client.close();
  }

  // TODO: do the type magic to return the right method type. Right now we get infinitely deep infered type errors from Zod without using "any"

  async resources(): Promise<ReturnType<Protocol<any, any, any>['request']>> {
    return await this.client.request({ method: 'resources/list' }, ListResourcesResultSchema);
  }

  async tools() {
    const { tools } = await this.client.listTools();
    const toolsRes: Record<string, any> = {};
    tools.forEach(tool => {
      const s = jsonSchemaToModel(tool.inputSchema);
      const mastraTool = createTool({
        id: `${this.name}_${tool.name}`,
        description: tool.description,
        inputSchema: s,
        execute: async ({ context }) => {
          try {
            const res = await this.client.callTool({
              name: tool.name,
              arguments: context,
            });

            return res;
          } catch (e) {
            console.log('Error calling tool', tool.name);
            console.error(e);
            throw e;
          }
        },
      });

      if (tool.name) {
        toolsRes[tool.name] = mastraTool;
      }
    });

    return toolsRes;
  }
}
