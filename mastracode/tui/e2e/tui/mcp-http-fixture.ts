import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createRequire } from 'node:module';
import type { AddressInfo } from 'node:net';
import { pathToFileURL } from 'node:url';

export type McpFixtureContent = Array<{ type: 'text'; text: string }>;

export type McpFixtureToolHandler = (
  input: Record<string, unknown>,
) => Promise<{ content: McpFixtureContent }> | { content: McpFixtureContent };

export type McpFixtureServer = {
  close: () => Promise<void>;
  connect: (transport: McpFixtureTransport) => Promise<void>;
  tool: (name: string, description: string, schema: Record<string, unknown>, handler: McpFixtureToolHandler) => void;
};

export type McpFixtureTransport = {
  handleRequest: (req: IncomingMessage, res: ServerResponse) => Promise<void>;
};

type McpServerConstructor = new (
  info: { name: string; version: string },
  options: { capabilities: { tools: Record<string, unknown> } },
) => McpFixtureServer;

type StreamableHttpTransportConstructor = new (options: { sessionIdGenerator: undefined }) => McpFixtureTransport;

export type McpHttpFixture = {
  close: () => Promise<void>;
  url: string;
};

export type McpHttpFixtureRequestGateResult =
  { status: number; body: string; headers?: Record<string, string> } | undefined;

export type McpHttpFixtureOptions = {
  beforeRequest?: () => McpHttpFixtureRequestGateResult | Promise<McpHttpFixtureRequestGateResult>;
  headerName: string;
  headerValue: string;
  name: string;
  registerTools: (server: McpFixtureServer) => void;
  version?: string;
};

const requireFromMcpPackage = createRequire(new URL('../../../packages/mcp/package.json', import.meta.url));

export async function loadMcpSdk(): Promise<{
  McpServer: McpServerConstructor;
  StreamableHTTPServerTransport: StreamableHttpTransportConstructor;
}> {
  const mcpServerModule = (await import(
    pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/sdk/server/mcp.js')).href
  )) as unknown as { McpServer: McpServerConstructor };

  const streamableHttpModule = (await import(
    pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/sdk/server/streamableHttp.js')).href
  )) as unknown as { StreamableHTTPServerTransport: StreamableHttpTransportConstructor };

  return {
    McpServer: mcpServerModule.McpServer,
    StreamableHTTPServerTransport: streamableHttpModule.StreamableHTTPServerTransport,
  };
}

export async function startMcpHttpFixtureServer(options: McpHttpFixtureOptions): Promise<McpHttpFixture> {
  const { McpServer, StreamableHTTPServerTransport } = await loadMcpSdk();
  const httpServer = createServer();
  const activeServers = new Set<McpFixtureServer>();

  const createMcpServer = () => {
    const server = new McpServer(
      { name: options.name, version: options.version ?? '1.0.0' },
      { capabilities: { tools: {} } },
    );
    options.registerTools(server);
    activeServers.add(server);
    return server;
  };

  httpServer.on('request', (req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      if (req.headers[options.headerName] !== options.headerValue) {
        res.writeHead(401, { 'content-type': 'text/plain' });
        res.end(`missing ${options.headerName} header`);
        return;
      }

      const gateResult = await options.beforeRequest?.();
      if (gateResult) {
        res.writeHead(gateResult.status, { 'content-type': 'text/plain', ...gateResult.headers });
        res.end(gateResult.body);
        return;
      }

      const mcpServer = createMcpServer();
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      res.on('finish', () => {
        activeServers.delete(mcpServer);
        void mcpServer.close().catch(() => undefined);
      });
      await transport.handleRequest(req, res);
    })().catch(error => {
      res.writeHead(500, { 'content-type': 'text/plain' });
      res.end(String(error instanceof Error ? (error.stack ?? error.message) : error));
    });
  });

  const url = await new Promise<string>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(0, '127.0.0.1', () => {
      httpServer.off('error', reject);
      const address = httpServer.address();
      if (!address || typeof address === 'string') {
        reject(new Error(`${options.name} fixture server did not bind to a port`));
        return;
      }
      resolve(`http://127.0.0.1:${(address as AddressInfo).port}/mcp`);
    });
  });

  return {
    close: async () => {
      await Promise.all([...activeServers].map(server => server.close().catch(() => undefined)));
      activeServers.clear();
      await new Promise<void>(resolve => httpServer.close(() => resolve())).catch(() => undefined);
    },
    url,
  };
}
