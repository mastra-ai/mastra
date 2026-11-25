import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET_CONVERSATION_ITEMS_ROUTE } from './conversations';
import { CREATE_RESPONSE_ROUTE, GET_RESPONSE_ROUTE } from './responses';
import { createTestServerContext } from './test-utils';

function generateResult(text: string) {
  return {
    text,
    usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    totalUsage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
    steps: [],
    finishReason: 'stop',
    warnings: [],
    request: {},
    reasoning: [],
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: { id: 'model-response', timestamp: new Date(), modelId: 'test-model', messages: [], uiMessages: [] },
    runId: 'run-1',
    messages: [],
    rememberedMessages: [],
  } as unknown as Awaited<ReturnType<Agent['generate']>>;
}

type RecallArgs = Parameters<MockMemory['recall']>[0];

describe('response and conversation reads stay bounded', () => {
  let memory: MockMemory;
  let agent: Agent;
  let mastra: Mastra;

  beforeEach(() => {
    const storage = new InMemoryStore();
    memory = new MockMemory({ storage });
    agent = new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'x', model: {} as never, memory });
    mastra = new Mastra({ logger: false, storage, agents: { 'test-agent': agent } });
    vi.spyOn(agent, 'getModel').mockResolvedValue({
      specificationVersion: 'v2',
      provider: 'openai',
      modelId: 'test-model',
    } as never);
  });

  async function createStoredResponse(input: string, previousResponseId?: string) {
    vi.spyOn(agent, 'generate').mockResolvedValue(generateResult(`reply to ${input}`));
    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input,
      store: true,
      stream: false,
      ...(previousResponseId ? { previous_response_id: previousResponseId } : {}),
    })) as Response;
    return (await response.json()) as { id: string; conversation_id: string };
  }

  function expectBoundedRecalls(calls: RecallArgs[]) {
    expect(calls.length).toBeGreaterThan(0);
    for (const args of calls) {
      expect(args.perPage).not.toBe(false);
      expect(typeof args.perPage).toBe('number');
    }
  }

  it('checks a stored response against the turn window, not the whole thread', async () => {
    const created = await createStoredResponse('first');
    const recall = vi.spyOn(memory, 'recall');

    const retrieved = (await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    })) as { id: string };

    expect(retrieved.id).toBe(created.id);
    const calls = recall.mock.calls.map(([args]) => args);
    expectBoundedRecalls(calls);
    for (const args of calls) {
      expect(args.filter?.dateRange?.start).toBeInstanceOf(Date);
      expect(args.filter?.dateRange?.end).toBeInstanceOf(Date);
    }
  });

  it('checks previous_response_id reachability with bounded reads', async () => {
    const first = await createStoredResponse('first');
    const recall = vi.spyOn(memory, 'recall');

    await createStoredResponse('second', first.id);

    const reachabilityCalls = recall.mock.calls
      .map(([args]) => args)
      .filter(args => args.filter?.dateRange !== undefined);
    expect(reachabilityCalls.length).toBeGreaterThan(0);
    expectBoundedRecalls(reachabilityCalls);
  });

  it('refuses a response whose messages the thread cannot read', async () => {
    const created = await createStoredResponse('first');
    vi.spyOn(memory, 'recall').mockResolvedValue({
      messages: [],
      total: 0,
      page: 0,
      perPage: 1000,
      hasMore: false,
    });

    await expect(
      GET_RESPONSE_ROUTE.handler({ ...createTestServerContext({ mastra }), responseId: created.id }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('lists conversation items one bounded page at a time', async () => {
    const created = await createStoredResponse('first');
    const recall = vi.spyOn(memory, 'recall');

    await GET_CONVERSATION_ITEMS_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      conversationId: created.conversation_id,
    });

    expectBoundedRecalls(recall.mock.calls.map(([args]) => args));
  });
});
