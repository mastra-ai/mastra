import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import type { IncomingMessage } from 'node:http';
import { once } from 'node:events';
import { Mastra } from '@mastra/core/mastra';
import { isMCPServerV2, MCPServerBaseV2 } from '@mastra/core/mcp';
import { MCPClient } from '@mastra/mcp';
import {
  Client,
  LOG_LEVEL_META_KEY,
  SdkError,
  specTypeSchemas,
  StreamableHTTPClientTransport,
  withInputRequired,
} from '@modelcontextprotocol/client';
import type { ElicitResult, InputRequiredResult } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { Client as LegacyClient } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport as LegacyHttpTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { bookDelivery, echo, journal, makeServer } from './shared.js';

const pass = (label: string) => console.log(`PASS: ${label}`);
const accept = (content: Record<string, string | number | boolean>): ElicitResult => ({ action: 'accept', content });

// --- Registry: v2 instances sit in the typed union without touching the 1.x base ---
const server = makeServer();
assert.ok(server instanceof MCPServerBaseV2);
const mastra = new Mastra({ mcpServers: { packed: server } });
const registered = mastra.getMCPServer('packed');
assert.ok(registered && isMCPServerV2(registered));
// Native tools are rejected at the type level and, for untyped callers, at runtime.
// @ts-expect-error native tools are not business tools
assert.throws(() => new Mastra({ tools: { bookDelivery } }), /Native MCP tools/);
assert.ok(mastra.listTools()?.echo, 'ordinary tools from a v2 server register globally');
assert.equal(mastra.listTools()?.bookDelivery, undefined);
pass('v2 server registers on the core union; native tools stay out of the business registry');

// --- HTTP: self-contained modern requests, observed on the wire ---
const seen: Array<{ method: string; headers: IncomingMessage['headers']; body: string }> = [];
const responseHeaders: string[][] = [];
const httpServer = createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  req.on('data', c => chunks.push(Buffer.from(c)));
  await once(req, 'end');
  const body = Buffer.concat(chunks).toString('utf8');
  seen.push({ method: req.method ?? '', headers: req.headers, body });
  res.on('finish', () => responseHeaders.push(Object.keys(res.getHeaders())));
  await server.startHTTP({
    url: new URL(req.url ?? '/', 'http://localhost'),
    httpPath: '/mcp',
    req: Object.assign(req, { body: body ? JSON.parse(body) : undefined }),
    res,
  });
});
httpServer.listen(0, '127.0.0.1');
await once(httpServer, 'listening');
const address = httpServer.address();
assert.ok(address && typeof address !== 'string');
const url = new URL(`http://127.0.0.1:${address.port}/mcp`);

const modern = new Client(
  { name: 'independent-sdk-client', version: '1.0.0' },
  {
    versionNegotiation: { mode: { pin: '2026-07-28' } },
    capabilities: { elicitation: { form: {} } },
    inputRequired: { autoFulfill: false },
  },
);
const logs: Array<{ level: string; data: unknown }> = [];
modern.setNotificationHandler('notifications/message', async n => {
  logs.push({ level: n.params.level, data: n.params.data });
});
await modern.connect(new StreamableHTTPClientTransport(url));
assert.deepEqual(modern.getDiscoverResult()?.supportedVersions, ['2026-07-28']);
const capabilities = modern.getServerCapabilities() ?? {};
assert.ok(capabilities.tools && capabilities.logging);
assert.equal((capabilities as Record<string, unknown>).roots, undefined);
assert.equal((capabilities as Record<string, unknown>).sampling, undefined);
assert.ok(seen.every(r => !('mcp-session-id' in r.headers)));
assert.ok(seen.every(r => !r.body.includes('"method":"initialize"')));
pass('modern discovery: 2026-07-28 only, no initialize, no session header, no roots/sampling');

const tools = await modern.listTools();
assert.deepEqual(tools.tools.map(t => t.name).sort(), ['bookDelivery', 'echo']);
const echoed = await modern.callTool({ name: 'echo', arguments: { message: 'hi' } });
assert.deepEqual(echoed.structuredContent, { echoed: 'hi', hadLegacyContext: false });
assert.equal(echoed.isError, false);
pass('ordinary createTool executes without a legacy MCP context');

// Two keyed rounds, signed state, one counted write, duplicate completion is idempotent.
// Manual rounds use the SDK's documented path: `request()` + `withInputRequired()` with
// `allowInputRequired`, so `input_required` comes back typed instead of auto-fulfilled.
const callToolOrInputRequired = withInputRequired(specTypeSchemas.CallToolResult);
const round = (args: Record<string, unknown>, continuation?: Record<string, unknown>, meta?: Record<string, unknown>) =>
  modern.request(
    {
      method: 'tools/call',
      params: { name: 'bookDelivery', arguments: args, ...continuation, ...(meta ? { _meta: meta } : {}) },
    },
    callToolOrInputRequired,
    { allowInputRequired: true },
  ) as Promise<Partial<InputRequiredResult> & { structuredContent?: unknown; isError?: boolean }>;

const first = await round({ opKey: 'op-1' }, undefined, { [LOG_LEVEL_META_KEY]: 'info' });
assert.equal(first.resultType, 'input_required');
assert.deepEqual(Object.keys(first.inputRequests ?? {}), ['address']);
assert.equal(typeof first.requestState, 'string');
assert.deepEqual(logs, [{ level: 'info', data: { message: 'start op-1' } }]);
logs.length = 0;

const second = await round(
  { opKey: 'op-1' },
  { inputResponses: { address: accept({ address: '1 Main St' }) }, requestState: first.requestState },
);
assert.equal(second.resultType, 'input_required');
assert.deepEqual(Object.keys(second.inputRequests ?? {}), ['confirm']);
assert.deepEqual(logs, [], 'no opt-in, no log delivery');

const booked = await round(
  { opKey: 'op-1' },
  { inputResponses: { confirm: accept({ ok: true }) }, requestState: second.requestState },
  { [LOG_LEVEL_META_KEY]: 'warning' },
);
assert.deepEqual(booked.structuredContent, { status: 'booked', address: '1 Main St', writes: 1 });
assert.deepEqual(logs, [], 'info log filtered below the warning opt-in');
const again = await round(
  { opKey: 'op-1' },
  { inputResponses: { confirm: accept({ ok: true }) }, requestState: second.requestState },
);
assert.deepEqual(again.structuredContent, { status: 'booked', address: '1 Main St', writes: 1 });
assert.equal(journal.writes, 1);
pass('native input_required: two keyed rounds, per-request log opt-in and filtering, one counted write');

await assert.rejects(
  round(
    { opKey: 'op-1' },
    { inputResponses: { confirm: accept({ ok: true }) }, requestState: `${second.requestState}x` },
  ),
  (error: unknown) => (error as { code?: number }).code === -32602,
);
pass('tampered requestState is rejected before the handler runs');

// Deprecated surfaces are absent on the wire, not merely unexported.
const raw = async (method: string, params: Record<string, unknown> = {}) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2026-07-28',
      'mcp-method': method,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params: {
        ...params,
        _meta: {
          'io.modelcontextprotocol/protocolVersion': '2026-07-28',
          'io.modelcontextprotocol/clientInfo': { name: 'raw', version: '1' },
          'io.modelcontextprotocol/clientCapabilities': {},
        },
      },
    }),
  });
  return { status: response.status, headers: response.headers, text: await response.text() };
};
for (const method of ['ping', 'logging/setLevel', 'resources/subscribe', 'resources/unsubscribe']) {
  const response = await raw(method, method === 'logging/setLevel' ? { level: 'debug' } : { uri: 'x://y' });
  assert.ok(!response.text.includes('"result"'), `${method} must not succeed`);
  assert.equal(response.headers.get('mcp-session-id'), null);
}
for (const method of ['GET', 'DELETE']) {
  const response = await fetch(url, { method });
  assert.ok(response.status >= 400, `${method} ${response.status}`);
}
pass('ping, logging/setLevel and legacy resource subscriptions are rejected; no SSE GET stream');

// Legacy peers fail explicitly; nothing downgrades.
const legacyModern = new Client({ name: 'legacy-mode', version: '1.0.0' });
await assert.rejects(legacyModern.connect(new StreamableHTTPClientTransport(url)), error => error instanceof SdkError);
const legacySdk = new LegacyClient({ name: 'sdk-1.x', version: '1.0.0' });
await assert.rejects(legacySdk.connect(new LegacyHttpTransport(url)));
assert.ok(
  seen.some(r => r.body.includes('"method":"initialize"')),
  'legacy client did attempt initialize',
);
assert.ok(responseHeaders.every(h => !h.includes('mcp-session-id')));
pass('legacy SDK 1.x client and legacy-negotiating v2 client are rejected without downgrade');

// Mastra's own v2 client answers input rounds through the keyed handler.
const mcp = new MCPClient({
  id: 'packed-consumer',
  servers: {
    packed: {
      url,
      inputRequests: async ({ key }) => (key === 'address' ? accept({ address: '2 Side St' }) : accept({ ok: true })),
    },
  },
});
const mastraTools = await mcp.listTools();
// Mastra's client hands back the validated structured content as the tool result.
const result = await mastraTools.packed_bookDelivery.execute!({ opKey: 'op-2' }, {} as never);
assert.deepEqual(result, { status: 'booked', address: '2 Side St', writes: 2 });
assert.ok(!('elicitation' in mcp) && !('sessionIds' in mcp));
await mcp.disconnect();
pass('@mastra/mcp client fulfils keyed input rounds end to end');

await modern.close();
await server.close();
httpServer.closeAllConnections();
httpServer.close();

// --- stdio: modern discovery, legacy client rejected ---
const stdioTransport = () =>
  new StdioClientTransport({ command: process.execPath, args: ['dist/stdio-server.js'], stderr: 'pipe' });
const stdioClient = new Client(
  { name: 'stdio-client', version: '1.0.0' },
  { versionNegotiation: { mode: { pin: '2026-07-28' } }, capabilities: { elicitation: { form: {} } } },
);
stdioClient.setRequestHandler('elicitation/create', async request =>
  request.params.message.startsWith('Delivery') ? accept({ address: '3 Back St' }) : accept({ ok: true }),
);
await stdioClient.connect(stdioTransport());
assert.deepEqual(stdioClient.getDiscoverResult()?.supportedVersions, ['2026-07-28']);
const stdioBooked = await stdioClient.callTool({ name: 'bookDelivery', arguments: { opKey: 'op-stdio' } });
assert.deepEqual(stdioBooked.structuredContent, { status: 'booked', address: '3 Back St', writes: 1 });
await stdioClient.close();
const legacyStdio = new Client({ name: 'legacy-stdio', version: '1.0.0' });
await assert.rejects(legacyStdio.connect(stdioTransport()));
await legacyStdio.close().catch(() => {});
pass('stdio: modern discovery and auto-fulfilled input rounds; legacy stdio client rejected');

console.log('PACKED MCP V2 CONSUMER PASS');
