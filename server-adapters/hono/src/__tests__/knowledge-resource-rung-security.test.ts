import { Agent } from '@mastra/core/agent';
import { Knowledge } from '@mastra/core/knowledge';
import { Mastra } from '@mastra/core/mastra';
import { MASTRA_SCOPES_KEY } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { MastraLanguageModelV2Mock } from '@mastra/core/test-utils/llm-mock';
import { Memory, Subconscious } from '@mastra/memory';
import { Hono } from 'hono';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MastraServer } from '../index';

/**
 * The Subconscious resource rung (where a run's Knowledge lives) is derived only
 * from the run's own identity, never from the HTTP body. Driven through the real
 * Hono route with a real Memory + Knowledge; the agent calls a real Knowledge tool,
 * which materializes the run's scope chain.
 */

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function stream(parts: unknown[]) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(part);
      controller.close();
    },
  });
}

function browsingModel() {
  let calls = 0;
  const reply = () => {
    calls++;
    return calls === 1
      ? [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'knowledge_browse', input: '{}' },
          { type: 'finish', finishReason: 'tool-calls', usage },
        ]
      : [
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage },
        ];
  };
  return new MastraLanguageModelV2Mock({
    doGenerate: async () => {
      calls++;
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        usage,
        ...(calls === 1
          ? {
              finishReason: 'tool-calls' as const,
              content: [
                { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'knowledge_browse', input: '{}' },
              ],
            }
          : { finishReason: 'stop' as const, content: [{ type: 'text' as const, text: 'done' }] }),
      };
    },
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: stream([{ type: 'stream-start', warnings: [] }, ...reply()]) as any,
    }),
  });
}

function buildApp() {
  const storage = new InMemoryStore();
  const knowledge = new Knowledge({ id: 'default', storage });
  const materialized: string[] = [];
  const materializeScope = knowledge.materializeScope.bind(knowledge);
  vi.spyOn(knowledge, 'materializeScope').mockImplementation(async input => {
    materialized.push(input.address);
    return materializeScope(input);
  });
  const memory = new Memory({
    storage,
    knowledge,
    // Semantic Knowledge needs these to construct; browse never queries them.
    vector: {
      indexSeparator: '_',
      listIndexes: async () => [],
      createIndex: async () => {},
      upsert: async ({ ids }: { ids: string[] }) => ids,
      deleteVectors: async () => {},
      query: async () => [],
    } as any,
    embedder: { doEmbed: async ({ values }: { values: string[] }) => ({ embeddings: values.map(() => [0.1]) }) } as any,
    options: {
      observationalMemory: {
        model: 'google/gemini-2.5-flash',
        experimental_subconscious: new Subconscious({ tools: true }),
      },
    },
  });
  const agent = new Agent({
    id: 'knowledge-agent',
    name: 'Knowledge Agent',
    instructions: 'Test agent',
    model: browsingModel(),
    memory,
    scopes: ['org:acme', 'resource:res-1', 'thread:t-1'],
  });
  const mastra = new Mastra({ agents: { 'knowledge-agent': agent }, storage, logger: false });
  return { mastra, materialized };
}

async function serve(mastra: Mastra) {
  const app = new Hono();
  await new MastraServer({ app, mastra }).init();
  return app;
}

function generate(body: Record<string, unknown>) {
  return new Request('http://localhost/api/agents/knowledge-agent/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'browse' }], ...body }),
  });
}

const RUN_RUNGS = ['org:acme', 'resource:res-1', 'resource:res-1:thread:t-1'];

afterEach(() => vi.restoreAllMocks());

describe('Knowledge resource rung over real server routes', () => {
  it('anchors Knowledge on the run identity when the body is clean', async () => {
    const { mastra, materialized } = buildApp();
    const response = await (await serve(mastra)).request(generate({}));

    expect(response.status).toBe(200);
    expect(materialized).toEqual(RUN_RUNGS);
  });

  it('ignores a knowledgeResourceId set in the request body', async () => {
    const { mastra, materialized } = buildApp();
    const response = await (
      await serve(mastra)
    ).request(generate({ requestContext: { knowledgeResourceId: 'evil-res' } }));

    expect(response.status).toBe(200);
    expect(materialized).toEqual(RUN_RUNGS);
  });

  it('ignores a project: scope sent in the body scopes or request context', async () => {
    const { mastra, materialized } = buildApp();
    const response = await (
      await serve(mastra)
    ).request(generate({ scopes: ['project:evil'], requestContext: { [MASTRA_SCOPES_KEY]: ['project:evil'] } }));

    expect(response.status).toBe(200);
    expect(materialized).toEqual(RUN_RUNGS);
  });
});
