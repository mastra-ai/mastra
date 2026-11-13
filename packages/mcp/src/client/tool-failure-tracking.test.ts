import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
import { ConsoleLogger } from '@mastra/core/logger';
import { createTool } from '@mastra/core/tools';
import { Observability } from '@mastra/observability';
import { ProtocolError as ClientProtocolError } from '@modelcontextprotocol/client';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { ProtocolError, Server, createMcpHandler } from '@modelcontextprotocol/server';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { MCPClient } from './configuration.js';

const EMAIL = 'person@example.com';
const PIN = 5551234;

const TOOLS = ['lookup', 'save', 'sync', 'check_pin', 'decline', 'refresh'].map(name => ({
  name,
  description: `Runs ${name}`,
  inputSchema: { type: 'object' as const, properties: { email: { type: 'string' }, pin: { type: 'number' } } },
}));

function buildServer() {
  const server = new Server({ name: 'contacts', version: '1.0.0' }, { capabilities: { tools: {} } });
  server.setRequestHandler('tools/list', async () => ({ tools: TOOLS }));
  server.setRequestHandler('tools/call', async request => {
    const { name, arguments: args } = request.params;
    if (name === 'lookup') throw new ProtocolError(-32602, `Invalid email: ${args?.email}`);
    if (name === 'check_pin') throw new ProtocolError(args?.pin as number, 'Rejected pin');
    if (name === 'decline') return { isError: true, content: [{ type: 'text', text: `Declined ${args?.email}` }] };
    return { content: [{ type: 'text', text: 'ok' }] };
  });
  return server;
}

describe('MCP tool failures in tracked exceptions', () => {
  let httpServer: HttpServer;
  let mcp: MCPClient;
  let mastra: Mastra;
  const exportedLogs: { level: string; message: string; data?: Record<string, unknown> }[] = [];
  const clientLogs: unknown[] = [];
  let modelPrompts: unknown[] = [];
  let rejectReconnectFor: string | undefined;

  beforeAll(async () => {
    const handler = toNodeHandler(createMcpHandler(() => buildServer(), { legacy: 'reject' }));
    httpServer = createServer(async (req, res) => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : undefined;
      if (rejectReconnectFor) {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Reconnect rejected ${rejectReconnectFor}`);
        return;
      }
      if (body?.method === 'tools/call' && body.params?.name === 'save') {
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end(`Could not save ${body.params.arguments.email}`);
        return;
      }
      if (body?.method === 'tools/call' && body.params?.name === 'refresh') {
        rejectReconnectFor = body.params.arguments.email;
        // A 403 proves the server did not run the call, so the client reconnects and retries.
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end(`Not connected: ${rejectReconnectFor}`);
        return;
      }
      await handler(req, res, body);
    });
    await new Promise<void>(resolve => httpServer.listen(0, '127.0.0.1', resolve));
    const { port } = httpServer.address() as AddressInfo;

    mcp = new MCPClient({
      id: 'tool-failure-tracking',
      servers: {
        contacts: {
          url: new URL(`http://127.0.0.1:${port}/mcp`),
          logger: entry => clientLogs.push(entry),
          fetch: async (input, init) => {
            const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
            if (body?.method === 'tools/call' && body.params?.name === 'sync') {
              throw new MastraError({
                id: `SYNC_FAILED_${body.params.arguments.email}` as Uppercase<string>,
                domain: ErrorDomain.MCP,
                category: ErrorCategory.THIRD_PARTY,
                text: `Sync rejected ${body.params.arguments.email}`,
              });
            }
            return fetch(input, init);
          },
        },
      },
    });
  });

  afterAll(async () => {
    await mcp?.disconnect().catch(() => {});
    httpServer?.closeAllConnections();
    httpServer?.close();
    await mastra?.shutdown?.();
  });

  async function callToolThroughAgent(
    toolName: string,
    input: Record<string, unknown>,
    secret: string,
    tools?: Record<string, unknown>,
  ) {
    exportedLogs.length = 0;
    clientLogs.length = 0;
    modelPrompts = [];

    const model = new MockLanguageModelV2({
      doStream: async ({ prompt }) => {
        modelPrompts.push(prompt);
        return {
          stream: convertArrayToReadableStream(
            modelPrompts.length === 1
              ? [
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
                  { type: 'tool-call', toolCallId: 'call-1', toolName, input: JSON.stringify(input) },
                  {
                    type: 'finish',
                    finishReason: 'tool-calls',
                    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
                  },
                ]
              : [
                  { type: 'stream-start', warnings: [] },
                  { type: 'response-metadata', id: 'id-1', modelId: 'mock', timestamp: new Date(0) },
                  { type: 'text-start', id: 'text-1' },
                  { type: 'text-delta', id: 'text-1', delta: 'The tool failed.' },
                  { type: 'text-end', id: 'text-1' },
                  { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
                ],
          ),
          rawCall: { rawPrompt: null, rawSettings: {} },
        };
      },
    });

    const agent = new Agent({
      id: 'contacts-agent',
      name: 'contacts-agent',
      instructions: 'Use the contact tools.',
      model,
      tools: (tools ?? (await mcp.listTools())) as never,
    });
    await mastra?.shutdown?.();
    mastra = new Mastra({
      logger: new ConsoleLogger({ level: 'silent' }),
      agents: { agent },
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'tool-failure-tracking',
            exporters: [
              {
                name: 'log-collector',
                async exportTracingEvent() {},
                onLogEvent(event: { log: { level: string; message: string; data?: Record<string, unknown> } }) {
                  exportedLogs.push(event.log);
                },
                async flush() {},
                async shutdown() {},
              },
            ],
          },
        },
      }),
    });

    await (await mastra.getAgent('agent').stream(`Run the tool with ${secret}`, { maxSteps: 2 })).consumeStream();
    await vi.waitFor(() => expect(exportedLogs.some(log => log.data?.errorId === 'TOOL_EXECUTION_FAILED')).toBe(true));
    return exportedLogs.find(log => log.data?.errorId === 'TOOL_EXECUTION_FAILED')!;
  }

  it('gives a direct caller the original error', async () => {
    const tools = await mcp.listTools();

    const protocolFailure = await tools.contacts_lookup!.execute!({ email: EMAIL }, {} as never).catch(
      (error: unknown) => error,
    );
    expect(protocolFailure).toBeInstanceOf(ClientProtocolError);
    expect(protocolFailure).toMatchObject({ code: -32602, message: `Invalid email: ${EMAIL}` });
    expect(Object.keys(protocolFailure as object)).not.toContain('id');

    const fetchFailure = await tools.contacts_sync!.execute!({ email: EMAIL }, {} as never).catch(
      (error: unknown) => error,
    );
    expect(fetchFailure).toMatchObject({ id: `SYNC_FAILED_${EMAIL}`, message: `Sync rejected ${EMAIL}` });
  });

  it('records only a fixed id when another tool wraps the MCP tool', async () => {
    const { contacts_save: inner } = await mcp.listTools();
    const wrapper = createTool({
      id: 'save_contact',
      description: 'Saves a contact on the picked connection',
      execute: (input, context) => inner!.execute!(input, context as never),
    });

    const tracked = await callToolThroughAgent('save_contact', { email: EMAIL }, EMAIL, { save_contact: wrapper });

    expect(tracked.message).toBe('Remote tool failed (MCP_CLIENT_TOOL_CALL_FAILED)');
    expect(JSON.stringify(tracked)).not.toContain(EMAIL);
    expect(JSON.stringify(modelPrompts[1])).toContain(`Could not save ${EMAIL}`);
  });

  it.each([
    {
      scenario: 'a JSON-RPC error that repeats the email',
      tool: 'contacts_lookup',
      input: { email: EMAIL },
      secret: EMAIL,
      recorded: 'MCP_CLIENT_TOOL_PROTOCOL_ERROR_32602',
      modelSees: `Invalid email: ${EMAIL}`,
    },
    {
      scenario: 'a JSON-RPC error code that repeats a submitted number',
      tool: 'contacts_check_pin',
      input: { pin: PIN },
      secret: String(PIN),
      recorded: 'MCP_CLIENT_TOOL_PROTOCOL_ERROR',
      modelSees: 'Rejected pin',
    },
    {
      scenario: 'an HTTP error body that repeats the email',
      tool: 'contacts_save',
      input: { email: EMAIL },
      secret: EMAIL,
      recorded: 'MCP_CLIENT_TOOL_CALL_FAILED',
      modelSees: `Could not save ${EMAIL}`,
    },
    {
      scenario: 'a custom fetch error with the email in its id',
      tool: 'contacts_sync',
      input: { email: EMAIL },
      secret: EMAIL,
      recorded: 'MCP_CLIENT_TOOL_CALL_FAILED',
      modelSees: `Sync rejected ${EMAIL}`,
    },
    {
      scenario: 'an in-band tool error that repeats the email',
      tool: 'contacts_decline',
      input: { email: EMAIL },
      secret: EMAIL,
      recorded: 'MCP_CLIENT_TOOL_EXECUTION_FAILED',
      modelSees: `Declined ${EMAIL}`,
    },
    {
      scenario: 'a failed reconnect that repeats the email',
      tool: 'contacts_refresh',
      input: { email: EMAIL },
      secret: EMAIL,
      recorded: 'MCP_CLIENT_TOOL_CALL_FAILED',
      modelSees: `Reconnect rejected ${EMAIL}`,
    },
  ])('records only a fixed id for $scenario, and the model still sees the text', async testCase => {
    const tracked = await callToolThroughAgent(testCase.tool, testCase.input, testCase.secret);

    expect(tracked.message).toBe(`Remote tool failed (${testCase.recorded})`);
    expect(tracked.data?.details).toMatchObject({ errorMessage: testCase.recorded });
    expect(JSON.stringify(tracked)).not.toContain(testCase.secret);

    const clientErrorLogs = clientLogs.filter(entry => (entry as { level: string }).level === 'error');
    expect(clientErrorLogs.length).toBeGreaterThan(0);
    expect(JSON.stringify(clientErrorLogs)).not.toContain(testCase.secret);

    expect(modelPrompts).toHaveLength(2);
    expect(JSON.stringify(modelPrompts[1])).toContain(testCase.modelSees);
  });
});
