/**
 * Regression tests for #27754: a stateless (no memory) client-tool continuation after
 * `approveToolCall` / `declineToolCall` (and the -Generate variants) must still give the
 * model the original conversation, not only the client tool call and its result.
 *
 * Real path: `@mastra/client-js` -> Hono `MastraServer` (via `app.fetch`) -> Agent,
 * with model responses served by aimock.
 */
import { createOpenAI } from '@ai-sdk/openai';
import { LLMock } from '@copilotkit/aimock';
import { MastraClient, createTool as createClientTool } from '@mastra/client-js';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Hono } from 'hono';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MastraServer } from '../index';

type Chunk = { type: string; payload?: { toolCallId?: string }; runId?: string };

/** An earlier exchange the caller sends along with the prompt, as a stateless client would. */
const EARLIER_EXCHANGE = [
  { role: 'user' as const, content: 'Earlier.' },
  { role: 'assistant' as const, content: 'Hi.' },
];

describe('client-js approve/decline client-tool continuation without memory (#27754)', () => {
  let llm: LLMock;

  beforeAll(async () => {
    llm = new LLMock({ port: 0 });
    await llm.start();
  });

  afterEach(() => {
    llm.clearFixtures();
    llm.clearRequests();
    llm.resetMatchCounts();
  });

  afterAll(async () => {
    await llm.stop();
  });

  async function setup() {
    const openai = createOpenAI({ apiKey: 'aimock-test-key', baseURL: `${llm.url.replace(/\/+$/, '')}/v1` });

    const agent = new Agent({
      id: 'approval-agent',
      name: 'approval-agent',
      instructions: 'Use the tools.',
      model: openai('gpt-4o-mini'),
      tools: {
        serverTool: createTool({
          id: 'serverTool',
          description: 'Server tool that needs approval.',
          inputSchema: z.object({ value: z.string() }),
          requireApproval: true,
          execute: async ({ value }) => ({ ok: value }),
        }),
      },
    });

    const mastra = new Mastra({ logger: false, storage: new InMemoryStore(), agents: { agent } });
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra, prefix: '/api' });
    await adapter.init();

    const fetchViaApp: typeof fetch = async (input, init) => app.fetch(new Request(input, init));
    return new MastraClient({ baseUrl: 'http://localhost', retries: 0, fetch: fetchViaApp });
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
    processDataStream: (opts: { onChunk: (c: Chunk) => Promise<void> }) => Promise<void>;
  }) {
    const chunks: Chunk[] = [];
    await response.processDataStream({
      onChunk: async chunk => {
        chunks.push(chunk);
      },
    });
    return chunks;
  }

  function executableClientTool(runs: string[]) {
    return createClientTool({
      id: 'clientTool',
      description: 'Client tool executed by the caller.',
      inputSchema: z.object({ value: z.string() }),
      execute: async ({ value }) => {
        runs.push(value);
        return { echoed: value };
      },
    });
  }

  async function suspendOnApproval(
    client: MastraClient,
    clientTools: Record<string, ReturnType<typeof createClientTool>>,
    { withEarlierExchange = false }: { withEarlierExchange?: boolean } = {},
  ) {
    const agent = client.getAgent('agent');
    const prompt = { role: 'user' as const, content: 'Do the thing.' };
    const input = withEarlierExchange ? [...EARLIER_EXCHANGE, prompt] : [prompt];
    const chunks = await collect(await agent.stream(input, { clientTools }));
    const approval = chunks.find(c => c.type === 'tool-call-approval');
    expect(approval?.payload?.toolCallId).toBe('call_server');
    const runId = approval?.runId;
    if (!runId) throw new Error('stream did not suspend for approval');
    return { agent, runId };
  }

  function finalRequestMessages() {
    const messages: { role: string; content?: unknown; tool_calls?: { id: string }[]; tool_call_id?: string }[] =
      llm.getRequests().at(-1)?.body?.messages ?? [];
    return messages;
  }

  function expectFullHistoryOnFinalRequest() {
    const last = finalRequestMessages();
    // The final model call answers the client tool result...
    expect(last.at(-1)).toMatchObject({ role: 'tool', tool_call_id: 'call_client' });
    // ...and still sees the original prompt and the approval-gated server tool turn.
    expect(last).toContainEqual(expect.objectContaining({ role: 'user', content: 'Do the thing.' }));
    expect(last.some(m => m.role === 'assistant' && m.tool_calls?.some(c => c.id === 'call_server'))).toBe(true);
    expect(last).toContainEqual(expect.objectContaining({ role: 'tool', tool_call_id: 'call_server' }));
    // Each turn is sent once.
    expect(last.filter(m => m.role === 'user')).toHaveLength(1);
    expect(last.filter(m => m.role === 'assistant' && m.tool_calls?.some(c => c.id === 'call_client'))).toHaveLength(1);
  }

  it.each(['approveToolCall', 'declineToolCall'] as const)('%s continuation keeps the conversation', async method => {
    registerFixtures();
    const client = await setup();
    const runs: string[] = [];
    const clientTools = { clientTool: executableClientTool(runs) };
    const { agent, runId } = await suspendOnApproval(client, clientTools);

    const chunks = await collect(await agent[method]({ runId, toolCallId: 'call_server', clientTools }));

    expect(runs).toEqual(['b']);
    expect(chunks.filter(c => c.type === 'tool-error')).toEqual([]);
    expectFullHistoryOnFinalRequest();
  });

  it.each(['approveToolCallGenerate', 'declineToolCallGenerate'] as const)(
    '%s continuation keeps the conversation',
    async method => {
      registerFixtures();
      const client = await setup();
      const runs: string[] = [];
      const clientTools = { clientTool: executableClientTool(runs) };
      const { agent, runId } = await suspendOnApproval(client, clientTools);

      const result = await agent[method]({ runId, toolCallId: 'call_server', clientTools });

      expect(runs).toEqual(['b']);
      expect(result.text).toBe('All done.');
      expectFullHistoryOnFinalRequest();
    },
  );

  it.each(['approveToolCall', 'declineToolCall', 'approveToolCallGenerate', 'declineToolCallGenerate'] as const)(
    '%s continuation keeps earlier turns the caller sent, in order',
    async method => {
      registerFixtures();
      const client = await setup();
      const runs: string[] = [];
      const clientTools = { clientTool: executableClientTool(runs) };
      const { agent, runId } = await suspendOnApproval(client, clientTools, { withEarlierExchange: true });

      const params = { runId, toolCallId: 'call_server', clientTools };
      if (method === 'approveToolCall' || method === 'declineToolCall') {
        await collect(await agent[method](params));
      } else {
        expect((await agent[method](params)).text).toBe('All done.');
      }

      expect(runs).toEqual(['b']);
      const final = finalRequestMessages();
      expect(final.map(m => m.role)).toEqual([
        'system',
        'user',
        'assistant',
        'user',
        'assistant',
        'tool',
        'assistant',
        'tool',
      ]);
      expect(final.slice(1, 4).map(m => m.content)).toEqual(['Earlier.', 'Hi.', 'Do the thing.']);
      expect(final.filter(m => m.role === 'tool').map(m => m.tool_call_id)).toEqual(['call_server', 'call_client']);
    },
  );
});
