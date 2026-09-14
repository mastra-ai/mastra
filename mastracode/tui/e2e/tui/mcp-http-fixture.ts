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
  tool: (name: string, description: string, schema: Record<string, unknown>, handler: McpFixtureToolHandler) => void;
};

export type McpFixtureRequestHandler = (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;

export type McpHttpFixture = {
  close: () => Promise<void>;
  url: string;
};

export type McpHttpFixtureRequestGateResult =
  | { status: number; body: string; headers?: Record<string, string> }
  | undefined;

export type McpHttpFixtureOptions = {
  beforeRequest?: () => McpHttpFixtureRequestGateResult | Promise<McpHttpFixtureRequestGateResult>;
  headerName: string;
  headerValue: string;
  name: string;
  registerTools: (server: McpFixtureServer) => void;
  version?: string;
};

type SdkMcpServer = {
  server: unknown;
  registerTool: (
    name: string,
    config: { description: string; inputSchema: Record<string, unknown> },
    handler: McpFixtureToolHandler,
  ) => unknown;
  close: () => Promise<void>;
};

type SdkServerModule = {
  McpServer: new (
    info: { name: string; version: string },
    options: { capabilities: { tools: Record<string, unknown> } },
  ) => SdkMcpServer;
  createMcpHandler: (
    getServer: () => unknown,
    options: { legacy: 'reject' },
  ) => { close: () => Promise<void>; (request: Request): Promise<Response> };
};

type SdkNodeModule = {
  toNodeHandler: (handler: (request: Request) => Promise<Response>) => McpFixtureRequestHandler;
};

const requireFromMcpPackage = createRequire(new URL('../../../packages/mcp/package.json', import.meta.url));

/**
 * Resolves the MCP SDK through `@mastra/mcp` so the fixture speaks exactly the
 * protocol revision the client under test does (2026-07-28 only).
 */
export async function loadMcpSdk(): Promise<{ server: SdkServerModule; node: SdkNodeModule }> {
  const server = (await import(
    pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/server')).href
  )) as unknown as SdkServerModule;
  const node = (await import(
    pathToFileURL(requireFromMcpPackage.resolve('@modelcontextprotocol/node')).href
  )) as unknown as SdkNodeModule;
  return { server, node };
}

export type McpFixtureHandler = {
  /** Serves one HTTP request against the fixture's MCP server. */
  handle: McpFixtureRequestHandler;
  close: () => Promise<void>;
};

/**
 * Builds a single MCP server with the scenario's tools and a request handler
 * that serves it over Streamable HTTP. Every request is self-contained, so one
 * server instance serves the whole fixture lifetime.
 */
export async function createMcpFixtureHandler(options: {
  name: string;
  version?: string;
  registerTools: (server: McpFixtureServer) => void;
}): Promise<McpFixtureHandler> {
  const { server: sdk, node } = await loadMcpSdk();
  const mcpServer = new sdk.McpServer(
    { name: options.name, version: options.version ?? '1.0.0' },
    { capabilities: { tools: {} } },
  );
  options.registerTools({
    tool: (name, description, schema, handler) => {
      mcpServer.registerTool(name, { description, inputSchema: schema }, handler);
    },
  });
  const mcpHandler = sdk.createMcpHandler(() => mcpServer.server, { legacy: 'reject' });
  return {
    handle: node.toNodeHandler(mcpHandler),
    close: async () => {
      await mcpHandler.close().catch(() => undefined);
      await mcpServer.close().catch(() => undefined);
    },
  };
}

export async function startMcpHttpFixtureServer(options: McpHttpFixtureOptions): Promise<McpHttpFixture> {
  const mcp = await createMcpFixtureHandler(options);
  const httpServer = createServer();

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

      await mcp.handle(req, res);
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
      await mcp.close();
      await new Promise<void>(resolve => httpServer.close(() => resolve())).catch(() => undefined);
    },
    url,
  };
}
