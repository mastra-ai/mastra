import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Mastra } from '@mastra/core/mastra';
import { MCPServerBase } from '@mastra/core/mcp';
import { createTool } from '@mastra/core/tools';
import type { MCPToolExecutionContext, MCPServerContext } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { ElicitRequestSchema, LoggingMessageNotificationSchema } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

let nestedCalls = 0;
const inner = createTool({
  id: 'inner',
  description: 'Confirm through the legacy context',
  inputSchema: z.object({}),
  outputSchema: z.object({ confirmed: z.boolean() }),
  execute: async (_, context) => {
    assert.ok(context?.mcp);
    const legacy: MCPToolExecutionContext = context.mcp;
    const extra: MCPServerContext = legacy.extra;
    assert.ok(extra.signal instanceof AbortSignal);
    assert.ok(extra.requestId !== undefined);
    nestedCalls++;
    assert.ok(legacy.log);
    await legacy.log('info', 'nested-legacy-log');
    const answer = await legacy.elicitation.sendRequest({
      message: 'Confirm legacy nested call?',
      requestedSchema: { type: 'object', properties: { confirmed: { type: 'boolean' } }, required: ['confirmed'] },
    });
    return { confirmed: answer.action === 'accept' && answer.content?.confirmed === true };
  },
});
const outer = createTool({
  id: 'outer',
  description: 'Invoke a nested tool with the same context',
  inputSchema: z.object({}),
  outputSchema: z.object({ confirmed: z.boolean() }),
  execute: async (input, context) => {
    assert.ok(context?.mcp);
    assert.ok(inner.execute);
    return inner.execute(input, context);
  },
});
const mcp = new MCPServer({
  id: 'compat',
  name: 'compat',
  version: '1',
  tools: { outer },
  protocolVersion: '2025-11-25',
});
const base: MCPServerBase = mcp;
const mastra = new Mastra({ mcpServers: { compat: base } });
assert.equal(mastra.getMCPServer('compat'), mcp);
assert.equal(mastra.getToolById('outer'), outer);
const server = createServer((req, res) => {
  void mcp.startHTTP({ url: new URL(req.url ?? '/', 'http://localhost'), httpPath: '/mcp', req, res });
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address !== 'string');
const client = new Client(
  { name: 'published-v1-probe', version: '1' },
  { capabilities: { elicitation: { form: {} } } },
);
let questions = 0;
const logs: unknown[] = [];
client.setRequestHandler(ElicitRequestSchema, async () => {
  questions++;
  return { action: 'accept', content: { confirmed: true } };
});
client.setNotificationHandler(LoggingMessageNotificationSchema, notification => {
  logs.push(notification.params.data);
});
try {
  await client.connect(new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`)));
  await client.setLoggingLevel('info');
  assert.ok((await client.listTools()).tools.some(tool => tool.name === 'outer'));
  const result = await client.callTool({ name: 'outer', arguments: {} });
  assert.notEqual(result.isError, true);
  assert.deepEqual(result.structuredContent, { confirmed: true });
  assert.equal(questions, 1);
  assert.equal(nestedCalls, 1);
  assert.ok(JSON.stringify(logs).includes('nested-legacy-log'));
  console.log(
    'PASS: published MCP 1.17.3 + packed core; old exports, registry, HTTP list/call, nested elicitation and logging',
  );
} finally {
  await client.close();
  await mcp.close();
  server.close();
  await once(server, 'close');
}
