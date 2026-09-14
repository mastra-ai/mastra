import http from 'node:http';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import type { AuthInfo } from '@modelcontextprotocol/server';
import { describe, expect, it } from 'vitest';
import { MastraApiMCPServer } from './mastra-api-mcp-server';

const objectSchema = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const listen = async (server: http.Server) => {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Expected an HTTP port');
  return `http://127.0.0.1:${address.port}`;
};

const close = (server: http.Server) => new Promise<void>(resolve => server.close(() => resolve()));

describe('MastraApiMCPServer over HTTP with protocol 2026-07-28', () => {
  it('discovers and executes manifest tools with caller auth, recursive schemas, null input and no error retries', async () => {
    const routes = [
      { method: 'GET', path: '/agents' },
      {
        method: 'POST',
        path: '/agents/:agentId/generate',
        pathParamSchema: objectSchema({ agentId: { type: 'string' } }),
        bodySchema: {
          ...objectSchema({ messages: { type: 'array', items: { $ref: '#/definitions/message' } } }),
          definitions: {
            message: objectSchema(
              {
                text: { type: 'string' },
                children: { type: 'array', items: { $ref: '#/definitions/message' } },
              },
              ['text'],
            ),
          },
        },
      },
      {
        method: 'POST',
        path: '/workflows/:workflowId/start-async',
        pathParamSchema: objectSchema({ workflowId: { type: 'string' } }),
        bodySchema: objectSchema({ inputData: { type: ['object', 'null'] } }),
      },
      {
        method: 'POST',
        path: '/tools/:toolId/execute',
        pathParamSchema: objectSchema({ toolId: { type: 'string' } }),
        bodySchema: objectSchema({ data: { type: 'object' } }),
      },
      {
        method: 'POST',
        path: '/mcp/:serverId/tools/:toolId/execute',
        pathParamSchema: objectSchema({ serverId: { type: 'string' }, toolId: { type: 'string' } }),
        bodySchema: objectSchema({ data: { type: 'object' } }),
      },
      { method: 'POST', path: '/not-in-the-catalog' },
    ];
    const requests: Array<{ method?: string; path?: string; authorization?: string; body: string }> = [];
    const target = http.createServer(async (req, res) => {
      let body = '';
      for await (const chunk of req) body += chunk.toString();
      requests.push({ method: req.method, path: req.url, authorization: req.headers.authorization, body });
      res.setHeader('content-type', 'application/json');
      if (req.method === 'GET' && req.url === '/api/system/api-schema') {
        res.end(JSON.stringify({ version: 1, routes }));
      } else if (req.method === 'GET' && req.url === '/api/agents') {
        res.end(JSON.stringify([{ id: 'recursive-agent' }]));
      } else if (req.method === 'POST' && req.url === '/api/agents/recursive-agent/generate') {
        res.end(JSON.stringify({ text: 'accepted' }));
      } else if (req.method === 'POST' && req.url === '/api/workflows/nullable/start-async') {
        res.end(JSON.stringify({ runId: 'null-input-run' }));
      } else if (req.method === 'POST' && req.url === '/api/tools/failing/execute') {
        res.writeHead(503);
        res.end(JSON.stringify({ error: 'execution unavailable' }));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'unexpected request' }));
      }
    });
    const client = new Client(
      { name: 'mastra-api-http-regression', version: '1.0.0' },
      { versionNegotiation: { mode: { pin: '2026-07-28' } } },
    );
    let adapter: MastraApiMCPServer | undefined;
    let gateway: http.Server | undefined;
    const transportErrors: unknown[] = [];

    try {
      const targetUrl = await listen(target);
      adapter = await MastraApiMCPServer.create({
        url: targetUrl,
        headers: { Authorization: 'Bearer configured-token' },
      });
      const server = adapter;
      gateway = http.createServer(async (req, res) => {
        // Authentication middleware supplies the verified caller token to the transport.
        if (req.headers.authorization === 'Bearer caller-token') {
          (req as typeof req & { auth: AuthInfo }).auth = {
            token: 'caller-token',
            clientId: 'http-regression-client',
            scopes: ['tools:call'],
          };
        }
        try {
          await server.startHTTP({
            url: new URL(req.url || '', 'http://127.0.0.1'),
            httpPath: '/mcp',
            req,
            res,
            options: { serverless: true, serverlessStreaming: true, sessionIdGenerator: undefined },
          });
        } catch (error) {
          transportErrors.push(error);
          res.writeHead(500);
          res.end('MCP transport failed');
        }
      });
      const gatewayUrl = await listen(gateway);
      await client.connect(
        new StreamableHTTPClientTransport(new URL(`${gatewayUrl}/mcp`), {
          requestInit: { headers: { Authorization: 'Bearer caller-token' } },
        }),
      );
      expect(client.getDiscoverResult()).toBeDefined();
      const { tools } = await client.listTools();
      expect(tools.map(tool => tool.name)).toEqual([
        'agent_list',
        'agent_run',
        'workflow_run_start',
        'tool_execute',
        'mcp_tool_execute',
      ]);
      expect(tools.find(tool => tool.name === 'agent_list')?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
      });

      const agents = await client.callTool({ name: 'agent_list', arguments: {} });
      expect(agents).toMatchObject({
        isError: false,
        content: [{ type: 'text', text: expect.stringContaining('recursive-agent') }],
      });
      const messages = [{ text: 'root', children: [{ text: 'child', children: [{ text: 'leaf' }] }] }];
      const agent = await client.callTool({ name: 'agent_run', arguments: { agentId: 'recursive-agent', messages } });
      expect(agent).toMatchObject({
        isError: false,
        content: [{ type: 'text', text: expect.stringContaining('accepted') }],
      });
      const workflow = await client.callTool({
        name: 'workflow_run_start',
        arguments: { workflowId: 'nullable', inputData: null },
      });
      expect(workflow).toMatchObject({
        isError: false,
        content: [{ type: 'text', text: expect.stringContaining('null-input-run') }],
      });
      const failure = await client.callTool({ name: 'tool_execute', arguments: { toolId: 'failing', data: {} } });
      expect(failure).toMatchObject({
        isError: true,
        content: [{ type: 'text', text: expect.stringMatching(/503.*execution unavailable/) }],
      });
      expect(requests).toEqual([
        { method: 'GET', path: '/api/system/api-schema', authorization: 'Bearer configured-token', body: '' },
        { method: 'GET', path: '/api/agents', authorization: 'Bearer caller-token', body: '' },
        {
          method: 'POST',
          path: '/api/agents/recursive-agent/generate',
          authorization: 'Bearer caller-token',
          body: JSON.stringify({ messages }),
        },
        {
          method: 'POST',
          path: '/api/workflows/nullable/start-async',
          authorization: 'Bearer caller-token',
          body: '{"inputData":null}',
        },
        {
          method: 'POST',
          path: '/api/tools/failing/execute',
          authorization: 'Bearer caller-token',
          body: '{"data":{}}',
        },
      ]);
      for (const name of ['agent_run', 'workflow_run_start', 'tool_execute', 'mcp_tool_execute']) {
        expect(tools.find(tool => tool.name === name)?.annotations).toMatchObject({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        });
      }
      expect(transportErrors).toEqual([]);
    } finally {
      await Promise.allSettled([client.close(), adapter?.close(), gateway ? close(gateway) : undefined, close(target)]);
    }
  }, 20000);
});
