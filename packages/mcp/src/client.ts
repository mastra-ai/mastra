import { MastraBase } from '@mastra/core/base';
import { createTool } from '@mastra/core/tools';
import { jsonSchemaToModel } from '@mastra/core/utils';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { getDefaultEnvironment, StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js';
import { DEFAULT_REQUEST_TIMEOUT_MSEC } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Protocol } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { ClientCapabilities } from '@modelcontextprotocol/sdk/types.js';
import { CallToolResultSchema, ListResourcesResultSchema } from '@modelcontextprotocol/sdk/types.js';

import { asyncExitHook, gracefulExit } from 'exit-hook';

type SSEClientParameters = {
  url: URL;
} & ConstructorParameters<typeof SSEClientTransport>[1];

export type MastraMCPServerDefinition = StdioServerParameters | SSEClientParameters;

export class MastraMCPClient extends MastraBase {
  name: string;
  private transport: Transport;
  private client: Client;
  private readonly timeoutMillis: number;
  constructor({
    name,
    version = '1.0.0',
    server,
    capabilities = {},
    timeoutMillis = DEFAULT_REQUEST_TIMEOUT_MSEC,
  }: {
    name: string;
    server: MastraMCPServerDefinition;
    capabilities?: ClientCapabilities;
    version?: string;
    timeoutMillis?: number;
  }) {
    super({ name: 'MastraMCPClient' });
    this.name = name;
    this.timeoutMillis = timeoutMillis;

    if (`url` in server) {
      this.transport = new SSEClientTransport(server.url, {
        requestInit: server.requestInit,
        eventSourceInit: server.eventSourceInit,
      });
    } else {
      this.transport = new StdioClientTransport({
        ...server,
        // without ...getDefaultEnvironment() commands like npx will fail because there will be no PATH env var
        env: { ...getDefaultEnvironment(), ...(server.env || {}) },
      });
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

  private isConnected = false;

  async connect() {
    if (this.isConnected) return;
    try {
      await this.client.connect(this.transport);
      this.isConnected = true;
      const originalOnClose = this.client.onclose;
      this.client.onclose = () => {
        this.isConnected = false;
        if (typeof originalOnClose === `function`) {
          originalOnClose();
        }
      };
      asyncExitHook(
        async () => {
          this.logger.debug(`Disconnecting ${this.name} MCP server`);
          await this.disconnect();
        },
        { wait: 5000 },
      );

      process.on('SIGTERM', () => gracefulExit());
    } catch (e) {
      this.logger.error(
        `Failed connecting to MCPClient with name ${this.name}.\n${e instanceof Error ? e.stack : JSON.stringify(e, null, 2)}`,
      );
      this.isConnected = false;
      throw e;
    }
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
        description: tool.description || '',
        inputSchema: s,
        execute: async ({ context }) => {
          try {
            const res = await this.client.callTool(
              {
                name: tool.name,
                arguments: context,
              },
              CallToolResultSchema,
              {
                timeout: this.timeoutMillis,
              },
            );

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
