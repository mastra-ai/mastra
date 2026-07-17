import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import type { Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { ToolSearchProcessor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod/v3';
import { MCPClient } from './configuration.js';

/**
 * End-to-end tests for ToolSearchProcessor.includeResolvedTools against a real
 * in-process MCP server and MCPClient.listToolsets() — the production path for
 * per-request MCP tools (#14127).
 */
describe('ToolSearchProcessor includeResolvedTools - real MCP integration', () => {
  const SERVER_NAME = 'github';
  const TOOL_NAME = 'create_issue';
  const NAMESPACED_TOOL_ID = `${SERVER_NAME}_${TOOL_NAME}`;

  let httpServer: HttpServer;
  let mcpServer: McpServer;
  let baseUrl: URL;
  let mcp: MCPClient;
  let lastMcpToolInput: { title: string } | undefined;

  beforeAll(async () => {
    httpServer = createServer();
    mcpServer = new McpServer({ name: 'tool-search-mcp-server', version: '1.0.0' }, { capabilities: { tools: {} } });

    mcpServer.tool(
      TOOL_NAME,
      'Create a GitHub issue via MCP',
      { title: z.string().describe('Issue title') },
      async ({ title }): Promise<CallToolResult> => {
        lastMcpToolInput = { title };
        return {
          content: [{ type: 'text', text: JSON.stringify({ issueNumber: 42, title }) }],
        };
      },
    );

    httpServer.on('request', async (req, res) => {
      await mcpServer.close().catch(() => {});
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res);
    });

    baseUrl = await new Promise<URL>(resolve => {
      httpServer.listen(0, '127.0.0.1', () => {
        const addr = httpServer.address() as AddressInfo;
        resolve(new URL(`http://127.0.0.1:${addr.port}/mcp`));
      });
    });

    mcp = new MCPClient({
      id: randomUUID(),
      servers: {
        [SERVER_NAME]: { url: baseUrl },
      },
    });
  });

  afterAll(async () => {
    await mcp?.disconnect().catch(() => {});
    await mcpServer?.close().catch(() => {});
    httpServer?.close();
  });

  it('discovers, loads, and executes MCP toolset tools via agent.stream', async () => {
    lastMcpToolInput = undefined;

    const toolsets = await mcp.listToolsets();
    expect(toolsets[SERVER_NAME]?.[TOOL_NAME]).toBeDefined();
    expect(toolsets[SERVER_NAME]![TOOL_NAME]!.id).toBe(NAMESPACED_TOOL_ID);

    let callCount = 0;
    const mockModel = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;

        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'load-call',
                toolName: 'load_tool',
                input: JSON.stringify({ toolName: NAMESPACED_TOOL_ID }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        }

        if (callCount === 2) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'mcp-call',
                toolName: NAMESPACED_TOOL_ID,
                input: JSON.stringify({ title: 'Bug fix from MCP' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 },
              },
            ]),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'tool-search-real-mcp-agent',
      name: 'Tool Search Real MCP Agent',
      instructions: 'Load MCP tools before using them.',
      model: mockModel,
      inputProcessors: [
        new ToolSearchProcessor({
          tools: {},
          includeResolvedTools: true,
        }),
      ],
    });

    const stream = await agent.stream('Create a github issue', {
      maxSteps: 5,
      toolsets,
    });

    const toolErrors: unknown[] = [];
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-error') {
        toolErrors.push(chunk.payload);
      }
    }

    expect(toolErrors).toEqual([]);
    expect(lastMcpToolInput).toEqual({ title: 'Bug fix from MCP' });
  }, 30000);

  it('discovers MCP tools via search_tools, load_tool, then executes', async () => {
    lastMcpToolInput = undefined;

    const toolsets = await mcp.listToolsets();
    expect(toolsets[SERVER_NAME]?.[TOOL_NAME]).toBeDefined();

    let callCount = 0;
    const mockModel = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;

        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'search-call',
                toolName: 'search_tools',
                input: JSON.stringify({ query: 'github issue' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        }

        if (callCount === 2) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'load-call',
                toolName: 'load_tool',
                input: JSON.stringify({ toolName: NAMESPACED_TOOL_ID }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 },
              },
            ]),
          };
        }

        if (callCount === 3) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'mcp-call',
                toolName: NAMESPACED_TOOL_ID,
                input: JSON.stringify({ title: 'Issue from search flow' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
              },
            ]),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-3', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 25, outputTokens: 5, totalTokens: 30 },
            },
          ]),
        };
      },
    });

    const agent = new Agent({
      id: 'tool-search-real-mcp-search-flow-agent',
      name: 'Tool Search Real MCP Search Flow Agent',
      instructions: 'Search for tools before using them.',
      model: mockModel,
      inputProcessors: [
        new ToolSearchProcessor({
          tools: {},
          includeResolvedTools: true,
        }),
      ],
    });

    const stream = await agent.stream('Find and create a github issue', {
      maxSteps: 6,
      toolsets,
    });

    const toolErrors: unknown[] = [];
    let searchToolResult: { results?: Array<{ name: string }> } | undefined;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-error') {
        toolErrors.push(chunk.payload);
      }
      if (chunk.type === 'tool-result' && chunk.payload?.toolName === 'search_tools') {
        searchToolResult = chunk.payload.result as { results?: Array<{ name: string }> };
      }
    }

    expect(searchToolResult?.results?.map(r => r.name)).toContain(NAMESPACED_TOOL_ID);
    expect(toolErrors).toEqual([]);
    expect(lastMcpToolInput).toEqual({ title: 'Issue from search flow' });
  }, 30000);

  it('executes a loaded MCP toolset tool after approval resume', async () => {
    lastMcpToolInput = undefined;

    await mcp.disconnect().catch(() => {});
    mcp = new MCPClient({
      id: randomUUID(),
      servers: {
        [SERVER_NAME]: {
          url: baseUrl,
          requireToolApproval: true,
        },
      },
    });

    const toolsets = await mcp.listToolsets();
    expect(toolsets[SERVER_NAME]?.[TOOL_NAME]?.requireApproval).toBe(true);

    let callCount = 0;
    const mockModel = new MockLanguageModelV2({
      doStream: async () => {
        callCount++;

        if (callCount === 1) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'load-call',
                toolName: 'load_tool',
                input: JSON.stringify({ toolName: NAMESPACED_TOOL_ID }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
              },
            ]),
          };
        }

        if (callCount === 2) {
          return {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallId: 'mcp-approval-call',
                toolName: NAMESPACED_TOOL_ID,
                input: JSON.stringify({ title: 'Approved MCP issue' }),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 },
              },
            ]),
          };
        }

        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 },
            },
          ]),
        };
      },
    });

    const userAgent = new Agent({
      id: 'tool-search-real-mcp-approval-agent',
      name: 'Tool Search Real MCP Approval Agent',
      instructions: 'Load and use MCP tools.',
      model: mockModel,
      inputProcessors: [
        new ToolSearchProcessor({
          tools: {},
          includeResolvedTools: true,
        }),
      ],
    });

    const mastra = new Mastra({
      agents: { userAgent },
      logger: false,
      storage: new InMemoryStore(),
    });

    const agent = mastra.getAgent('userAgent');
    const stream = await agent.stream('Load and use the MCP tool', {
      maxSteps: 5,
      toolsets,
    });

    let toolCallId = '';
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        toolCallId = chunk.payload.toolCallId;
      }
    }

    expect(toolCallId).toBe('mcp-approval-call');

    const resumeResult = await agent.approveToolCall({ runId: stream.runId, toolCallId });

    const toolErrors: unknown[] = [];
    for await (const chunk of resumeResult.fullStream) {
      if (chunk.type === 'tool-error') {
        toolErrors.push(chunk.payload);
      }
    }

    expect(toolErrors).toEqual([]);
    expect(lastMcpToolInput).toEqual({ title: 'Approved MCP issue' });
  }, 30000);
});
