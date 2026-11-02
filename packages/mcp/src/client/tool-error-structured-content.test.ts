/**
 * Structured MCP tool errors (#23330)
 *
 * A server can report a tool failure in-band with `isError: true` and put the
 * machine-readable reason in `structuredContent` (e.g. validation results).
 * Neither `onToolError` mode may drop half of that:
 * - `'return'` must keep the error signal, so callers and the model can tell
 *   the call failed.
 * - `'throw'` must keep the structured reason on the thrown error.
 *
 * These tests run a real MCP server through the public `MCPClient`, and drive
 * the model side through a real OpenAI provider pointed at AIMock.
 */

import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createOpenAI } from '@ai-sdk/openai-v5';
import { LLMock } from '@copilotkit/aimock';
import { Agent } from '@mastra/core/agent';
import { MastraError } from '@mastra/core/error';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { McpServer, createMcpHandler } from '@modelcontextprotocol/server';
import type { CallToolResult } from '@modelcontextprotocol/server';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MCPClient } from './configuration.js';

const SERVER = 'recipes';
const TOOL = `${SERVER}_submitRecipe`;
const ERROR_TEXT = 'Recipe failed validation';
const STRUCTURED = {
  code: 'VALIDATION_FAILED',
  validationResults: [{ field: 'servings', message: 'must be at least 1' }],
};

let httpServer: HttpServer;
let mcpServer: McpServer;
let baseUrl: URL;
let llm: LLMock;
const clients: MCPClient[] = [];

beforeAll(async () => {
  httpServer = createServer();
  mcpServer = new McpServer({ name: 'recipe-server', version: '1.0.0' }, { capabilities: { tools: {} } });
  mcpServer.registerTool(
    'submitRecipe',
    {
      description: 'Submits a recipe',
      inputSchema: { title: z.string() },
      outputSchema: { id: z.string() },
    },
    async (): Promise<CallToolResult> => ({
      isError: true,
      content: [{ type: 'text', text: ERROR_TEXT }],
      structuredContent: STRUCTURED,
    }),
  );
  const handler = toNodeHandler(createMcpHandler(() => mcpServer.server, { legacy: 'reject' }));
  httpServer.on('request', (req, res) => handler(req, res));
  baseUrl = await new Promise<URL>(resolve => {
    httpServer.listen(0, '127.0.0.1', () => {
      const { port } = httpServer.address() as AddressInfo;
      resolve(new URL(`http://127.0.0.1:${port}/mcp`));
    });
  });

  llm = new LLMock({ port: 0 });
  await llm.start();
});

afterEach(async () => {
  llm.clearFixtures();
  llm.clearRequests();
  llm.resetMatchCounts();
  await Promise.all(clients.splice(0).map(c => c.disconnect().catch(() => {})));
});

afterAll(async () => {
  await llm.stop();
  await mcpServer.close().catch(() => {});
  httpServer.close();
});

function client(onToolError: 'throw' | 'return') {
  const mcp = new MCPClient({ id: `recipes-${onToolError}`, servers: { [SERVER]: { url: baseUrl, onToolError } } });
  clients.push(mcp);
  return mcp;
}

describe("onToolError: 'return'", () => {
  it('resolves with the error envelope, keeping isError next to structuredContent', async () => {
    const tools = await client('return').listTools();
    const result = (await tools[TOOL].execute?.({ title: 'Soup' }, {} as any)) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual(STRUCTURED);
    expect(result.content).toEqual([{ type: 'text', text: ERROR_TEXT }]);
  });

  it('lets the model see that the tool call failed', async () => {
    const tools = await client('return').listTools();
    llm.on(
      { endpoint: 'chat', predicate: req => req.messages.at(-1)?.role === 'user' },
      { toolCalls: [{ id: 'call_submit', name: TOOL, arguments: JSON.stringify({ title: 'Soup' }) }] },
    );
    llm.on({ endpoint: 'chat', toolCallId: 'call_submit' }, { content: 'The recipe was rejected.' });

    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url}/v1` });
    const agent = new Agent({
      id: 'chef',
      name: 'chef',
      instructions: 'Submit recipes.',
      model: openai.chat('m'),
      tools,
    });
    const stream = await agent.stream('Submit my soup recipe.');
    expect(await stream.text).toBe('The recipe was rejected.');

    const requests = llm.getRequests();
    expect(requests).toHaveLength(2);
    const toolMessage = requests[1]!.body.messages.find((m: { role: string }) => m.role === 'tool');
    const sent = JSON.stringify(toolMessage?.content);
    expect(sent, 'the model was not told the tool call failed').toContain('\\"isError\\":true');
    expect(sent).toContain('VALIDATION_FAILED');
  });
});

describe("onToolError: 'throw'", () => {
  it('keeps structuredContent on the thrown MastraError', async () => {
    const tools = await client('throw').listTools();
    const error = await tools[TOOL].execute?.({ title: 'Soup' }, {} as any).then(
      () => {
        throw new Error('expected the tool call to throw');
      },
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(MastraError);
    const mastraError = error as MastraError;
    expect(mastraError.message).toBe(ERROR_TEXT);
    expect(mastraError.details?.toolName).toBe('submitRecipe');
    expect(JSON.parse(String(mastraError.details?.structuredContent))).toEqual(STRUCTURED);
  });
});
