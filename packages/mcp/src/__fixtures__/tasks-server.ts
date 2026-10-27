import { createServer } from 'node:http';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import type { CallToolResult, ServerContext } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { InMemoryMCPTaskStore } from '../server/tasks';
import type { MCPTaskHandle } from '../server/tasks';
import { emitTaskResults, taskHandleResult } from '../server/tasks/emit';
import { registerTaskHandlers } from '../server/tasks/handlers';
import { hasTasksCapability, tasksCapabilityEntry } from '../shared/tasks';

const CLIENT_CAPABILITIES_META_KEY = 'io.modelcontextprotocol/clientCapabilities';

export interface SentRequest {
  method: string;
  params: Record<string, unknown>;
  mcpName: string | null;
  declaredTasks: boolean;
}

export interface TasksFixtureServer {
  url: URL;
  store: InMemoryMCPTaskStore;
  /** JSON-RPC requests received, in order. */
  requests: SentRequest[];
  /** How many times each tool's work actually ran. */
  runs: Record<string, number>;
  /** Finishes the `gated` tool's current task. */
  release: () => void;
  /** Stops listening for `downMs`, then listens again on the same port with the same task store. */
  restart: (downMs: number) => Promise<void>;
  /** Answers every request with this HTTP status, like a proxy in front of a restarting server; `undefined` restores. */
  setGatewayStatus: (status: number | undefined) => void;
  close: () => Promise<void>;
}

const elicit = (message: string) => ({
  method: 'elicitation/create',
  params: {
    mode: 'form',
    message,
    requestedSchema: { type: 'object', properties: { ok: { type: 'boolean' } }, required: ['ok'] },
  },
});

/**
 * An MCP server whose tools answer with real MCP tasks (SEP-2663) on the wire whenever the caller
 * declared the Tasks extension, and run synchronously otherwise. Every `tasks/*` request goes
 * through the same handlers and in-memory store a Mastra server uses.
 */
export async function startTasksFixtureServer(options: { pollIntervalMs?: number } = {}): Promise<TasksFixtureServer> {
  const store = new InMemoryMCPTaskStore();
  const runs: Record<string, number> = {};
  const requests: SentRequest[] = [];
  let releaseGated: (() => void) | undefined;
  let gatewayStatus: number | undefined;

  const declaredTasks = (ctx: ServerContext) =>
    hasTasksCapability(
      (ctx.mcpReq.envelope as Record<string, { extensions?: Record<string, unknown> }> | undefined)?.[
        CLIENT_CAPABILITIES_META_KEY
      ],
    );

  /** Runs `work` as a task when the caller can take one, else inline. */
  const asTask =
    (name: string, work: (handle: MCPTaskHandle | undefined) => Promise<CallToolResult | void>) =>
    async (...handlerArgs: unknown[]): Promise<CallToolResult> => {
      // Tools without an inputSchema receive only the context.
      const ctx = handlerArgs[handlerArgs.length - 1] as ServerContext;
      const run = async (handle?: MCPTaskHandle) => {
        runs[name] = (runs[name] ?? 0) + 1;
        return work(handle);
      };
      if (!declaredTasks(ctx)) return (await run()) ?? { content: [] };
      const task = await store.create({
        ttlMs: 60_000,
        principal: 'anonymous',
        pollIntervalMs: options.pollIntervalMs ?? 10,
      });
      const handle = store.handle(task.taskId);
      void run(handle).then(
        result => result && handle.complete(result),
        error => handle.fail({ code: -32603, message: String(error) }),
      );
      return taskHandleResult(task);
    };

  const createServerForRequest = () => {
    const mcpServer = new McpServer(
      { name: 'tasks-fixture', version: '1.0.0' },
      { capabilities: { tools: {}, extensions: tasksCapabilityEntry() } },
    );
    const server = mcpServer.server;
    const connect = server.connect.bind(server);
    server.connect = async transport => {
      emitTaskResults(transport);
      return connect(transport);
    };
    registerTaskHandlers(server, { store, principal: async () => 'anonymous' });

    mcpServer.registerTool(
      'report',
      { description: 'Builds a report', inputSchema: { ms: z.number().default(30) } },
      asTask('report', async () => {
        await new Promise(resolve => setTimeout(resolve, 30));
        return { content: [{ type: 'text', text: 'report ready' }] };
      }),
    );
    mcpServer.registerTool(
      'confirm',
      { description: 'Asks before sending' },
      asTask('confirm', async handle => {
        if (!handle) return { content: [{ type: 'text', text: 'sent without asking' }] };
        const answers = await handle.requireInput({ approve: elicit('Send it?') });
        const ok = (answers.approve as { content?: { ok?: boolean } }).content?.ok;
        return { content: [{ type: 'text', text: ok ? 'sent' : 'not sent' }] };
      }),
    );
    mcpServer.registerTool(
      'broken',
      { description: 'Fails in the tool' },
      asTask('broken', async () => ({ isError: true, content: [{ type: 'text', text: 'disk full' }] })),
    );
    mcpServer.registerTool(
      'lost',
      { description: 'Fails in the infrastructure' },
      asTask('lost', async handle => {
        if (!handle) return { content: [] };
        handle.fail({ code: -32603, message: 'worker lost' });
      }),
    );
    mcpServer.registerTool(
      'gated',
      { description: 'Waits until released or cancelled' },
      asTask('gated', async handle => {
        await new Promise<void>(resolve => {
          releaseGated = resolve;
          handle?.signal.addEventListener('abort', () => resolve(), { once: true });
        });
        return { content: [{ type: 'text', text: 'released' }] };
      }),
    );
    mcpServer.registerTool(
      'totals',
      { description: 'Sums things', outputSchema: { total: z.number() } },
      asTask('totals', async () => ({ content: [{ type: 'text', text: '3' }], structuredContent: { total: 3 } })),
    );
    return server;
  };

  const handler = toNodeHandler(createMcpHandler(createServerForRequest, { legacy: 'reject' }));
  const httpServer: HttpServer = createServer(async (req, res) => {
    if (gatewayStatus !== undefined) {
      req.resume();
      res.writeHead(gatewayStatus).end('upstream unavailable');
      return;
    }
    const body = await readJson(req);
    if (body && typeof body === 'object' && 'method' in body) {
      const params = (body.params ?? {}) as Record<string, unknown>;
      const meta = params._meta as Record<string, { extensions?: Record<string, unknown> }> | undefined;
      requests.push({
        method: String(body.method),
        params,
        mcpName: req.headers['mcp-name'] ? String(req.headers['mcp-name']) : null,
        declaredTasks: hasTasksCapability(meta?.[CLIENT_CAPABILITIES_META_KEY]),
      });
    }
    void handler(req, res, body);
  });
  await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', () => resolve()));
  const { port } = httpServer.address() as AddressInfo;

  return {
    url: new URL(`http://127.0.0.1:${port}/mcp`),
    store,
    requests,
    runs,
    release: () => releaseGated?.(),
    restart: async downMs => {
      httpServer.closeAllConnections();
      await new Promise(resolve => httpServer.close(resolve));
      await new Promise(resolve => setTimeout(resolve, downMs));
      await new Promise<void>(resolve => httpServer.listen(port, '127.0.0.1', () => resolve()));
    },
    setGatewayStatus: status => {
      gatewayStatus = status;
    },
    close: async () => {
      store.close();
      httpServer.closeAllConnections();
      await new Promise(resolve => httpServer.close(resolve));
    },
  };
}

async function readJson(req: IncomingMessage): Promise<{ method?: unknown; params?: unknown } | undefined> {
  if (req.method !== 'POST') return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const text = Buffer.concat(chunks).toString('utf8');
  return text ? JSON.parse(text) : undefined;
}
