/**
 * Regression tests for client tools on tool-approval continuations.
 *
 * Issue: https://github.com/mastra-ai/mastra/issues/27186
 *
 * `@mastra/client-js` `approveToolCall` / `declineToolCall` must forward the
 * caller's client tools to the server so that a client tool the model calls
 * after the approval decision is surfaced back to the client (tool-call +
 * finish `tool-calls`) instead of failing server-side with ToolNotFoundError.
 *
 * The client talks to the real Hono adapter through `app.fetch`, and the
 * agent's model is served by aimock.
 */
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { MastraClient, createTool as createClientTool } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Memory } from '@mastra/memory';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

type Chunk = { type: string; payload?: any; runId?: string };

describe('client-js approveToolCall/declineToolCall with client tools (#27186)', () => {
  let llm: LLMock;
  let requestedPaths: string[] = [];

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterEach(() => {
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
    requestedPaths = [];
  });

  afterAll(async () => {
    await llm.stop();
  });

  async function setup({ withMemory = false }: { withMemory?: boolean } = {}) {
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });

    const serverToolExecutions: string[] = [];
    const memory = withMemory ? new Memory() : undefined;
    const agent = new Agent({
      id: 'approval-agent',
      name: 'approval-agent',
      instructions: 'Use the tools.',
      model: openai('gpt-4o-mini'),
      memory,
      tools: {
        serverTool: createTool({
          id: 'serverTool',
          description: 'Server tool that needs approval.',
          inputSchema: z.object({ value: z.string() }),
          requireApproval: true,
          execute: async ({ value }) => {
            serverToolExecutions.push(value);
            return { ok: value };
          },
        }),
      },
    });

    const mastra = new Mastra({ logger: false, storage: new InMemoryStore(), agents: { agent } });
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra, prefix: '/api' });
    await adapter.init();

    const fetchViaApp: typeof fetch = async (input, init) => {
      const request = new Request(input, init);
      requestedPaths.push(new URL(request.url).pathname);
      return app.fetch(request);
    };
    const client = new MastraClient({ baseUrl: 'http://localhost', retries: 0, fetch: fetchViaApp });

    return { client, serverToolExecutions, memory };
  }

  function registerFixtures() {
    // Turn 1: model asks for the server tool, which requires approval.
    llm.on(
      { endpoint: 'chat', hasToolResult: false },
      { toolCalls: [{ id: 'call_server', name: 'serverTool', arguments: { value: 'a' } }] },
    );
    // Turn 2 (after approve or decline): model calls the client tool.
    llm.on(
      { endpoint: 'chat', toolCallId: 'call_server', hasToolResult: true },
      { toolCalls: [{ id: 'call_client', name: 'clientTool', arguments: { value: 'b' } }] },
    );
    // Turn 3 (after the client tool result): final answer.
    llm.on({ endpoint: 'chat', toolCallId: 'call_client', hasToolResult: true }, { content: 'All done.' });
  }

  async function collect(response: {
    processDataStream: (opts: { onChunk: (c: any) => Promise<void> }) => Promise<void>;
  }) {
    const chunks: Chunk[] = [];
    await response.processDataStream({
      onChunk: async chunk => {
        chunks.push(chunk as Chunk);
      },
    });
    return chunks;
  }

  async function suspendOnApproval(
    client: MastraClient,
    clientTools: { clientTool: ReturnType<typeof createClientTool> },
  ) {
    const agent = client.getAgent('agent');
    const chunks = await collect(await agent.stream('Do the thing.', { clientTools }));
    const approval = chunks.find(c => c.type === 'tool-call-approval');
    expect(approval?.payload?.toolCallId).toBe('call_server');
    return { agent, runId: approval!.runId! };
  }

  const pendingClientTool = () =>
    createClientTool({
      id: 'clientTool',
      description: 'Client tool executed by the caller.',
      inputSchema: z.object({ value: z.string() }),
    });

  function expectStoppedForClientTool(chunks: Chunk[]) {
    expect(chunks.filter(c => c.type === 'tool-error')).toEqual([]);
    const clientCall = chunks.find(c => c.type === 'tool-call' && c.payload?.toolName === 'clientTool');
    expect(clientCall?.payload?.toolCallId).toBe('call_client');
    const finish = chunks.filter(c => c.type === 'finish').at(-1);
    expect(finish?.payload?.stepResult?.reason).toBe('tool-calls');
  }

  it('approveToolCall surfaces a client tool called after approval', async () => {
    registerFixtures();
    const { client, serverToolExecutions } = await setup();
    const clientTools = { clientTool: pendingClientTool() };
    const { agent, runId } = await suspendOnApproval(client, clientTools);

    const chunks = await collect(await agent.approveToolCall({ runId, toolCallId: 'call_server', clientTools }));

    expect(serverToolExecutions).toEqual(['a']);
    expectStoppedForClientTool(chunks);
  });

  it('declineToolCall surfaces a client tool called after the decline', async () => {
    registerFixtures();
    const { client, serverToolExecutions } = await setup();
    const clientTools = { clientTool: pendingClientTool() };
    const { agent, runId } = await suspendOnApproval(client, clientTools);

    const chunks = await collect(await agent.declineToolCall({ runId, toolCallId: 'call_server', clientTools }));

    expect(serverToolExecutions).toEqual([]);
    expectStoppedForClientTool(chunks);
  });

  it('approveToolCall executes an executable client tool and continues on /stream', async () => {
    registerFixtures();
    const { client } = await setup();
    const clientToolExecutions: string[] = [];
    const clientTools = {
      clientTool: createClientTool({
        id: 'clientTool',
        description: 'Client tool executed by the caller.',
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => {
          clientToolExecutions.push(value);
          return { echoed: value };
        },
      }),
    };
    const { agent, runId } = await suspendOnApproval(client, clientTools);

    const chunks = await collect(await agent.approveToolCall({ runId, toolCallId: 'call_server', clientTools }));

    expect(clientToolExecutions).toEqual(['b']);
    expect(chunks.filter(c => c.type === 'tool-error')).toEqual([]);
    const text = chunks
      .filter(c => c.type === 'text-delta')
      .map(c => c.payload?.text)
      .join('');
    expect(text).toBe('All done.');
  });

  it('approveToolCall keeps the memory thread on the /stream client-tool continuation', async () => {
    registerFixtures();
    const { client, memory } = await setup({ withMemory: true });
    const threadMemory = { thread: 't1', resource: 'r1' };
    const clientTools = {
      clientTool: createClientTool({
        id: 'clientTool',
        description: 'Client tool executed by the caller.',
        inputSchema: z.object({ value: z.string() }),
        execute: async ({ value }) => ({ echoed: value }),
      }),
    };
    const agent = client.getAgent('agent');
    const first = await collect(await agent.stream('Do the thing.', { clientTools, memory: threadMemory }));
    const runId = first.find(c => c.type === 'tool-call-approval')!.runId!;

    const chunks = await collect(
      await agent.approveToolCall({ runId, toolCallId: 'call_server', clientTools, memory: threadMemory }),
    );
    expect(chunks.filter(c => c.type === 'tool-error')).toEqual([]);

    // The final model call must still see the original prompt, recalled from the thread.
    const lastRequestMessages: { role: string; content: unknown }[] = llm.getRequests().at(-1)?.body?.messages ?? [];
    expect(lastRequestMessages).toContainEqual(expect.objectContaining({ role: 'user', content: 'Do the thing.' }));

    // The thread must end with the client tool result followed by the final answer.
    const { messages } = await memory!.recall({ threadId: 't1', resourceId: 'r1' });
    const parts = messages.flatMap(m => m.content.parts ?? []);
    const clientInvocation = parts
      .filter(p => p.type === 'tool-invocation' && p.toolInvocation.toolCallId === 'call_client')
      .at(-1);
    expect(clientInvocation).toMatchObject({ toolInvocation: { state: 'result', result: { echoed: 'b' } } });
    expect(parts.at(-1)).toMatchObject({ type: 'text', text: 'All done.' });
  });

  it.each(['approveToolCallGenerate', 'declineToolCallGenerate'] as const)(
    '%s stops for a client tool called after the decision',
    async method => {
      registerFixtures();
      const { client } = await setup();
      const clientTools = { clientTool: pendingClientTool() };
      const { agent, runId } = await suspendOnApproval(client, clientTools);

      const result = await agent[method]({ runId, toolCallId: 'call_server', clientTools });

      expect(result.finishReason).toBe('tool-calls');
      expect(result.error).toBeUndefined();
      expect(result.toolCalls.at(-1)?.payload).toMatchObject({ toolName: 'clientTool', toolCallId: 'call_client' });
      expect(result.toolResults.filter(r => r.payload.toolName === 'clientTool')).toEqual([]);
    },
  );
});
