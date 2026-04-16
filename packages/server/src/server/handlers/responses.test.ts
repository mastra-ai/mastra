import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { z } from 'zod';
import { HTTPException } from '../http-exception';
import { createResponseBodySchema } from '../schemas/responses';
import { CREATE_RESPONSE_ROUTE, DELETE_RESPONSE_ROUTE, GET_RESPONSE_ROUTE } from './responses';
import { createTestServerContext } from './test-utils';

function createGenerateResult({
  text,
  providerMetadata,
  dbMessages,
}: {
  text: string;
  providerMetadata?: Record<string, Record<string, unknown> | undefined>;
  dbMessages?: Array<Record<string, unknown>>;
}) {
  return {
    text,
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    steps: [],
    finishReason: 'stop',
    warnings: [],
    providerMetadata,
    request: {},
    reasoning: [],
    reasoningText: undefined,
    toolCalls: [],
    toolResults: [],
    sources: [],
    files: [],
    response: {
      id: 'model-response',
      timestamp: new Date(),
      modelId: 'test-model',
      messages: [],
      dbMessages,
      uiMessages: [],
    },
    totalUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    object: undefined,
    error: undefined,
    tripwire: undefined,
    traceId: undefined,
    runId: 'run-1',
    suspendPayload: undefined,
    resumeSchema: undefined,
    messages: [],
    rememberedMessages: [],
  } as unknown as Awaited<ReturnType<Agent['generate']>>;
}

function createDbMessage({
  id,
  role,
  createdAt,
  parts,
  type = 'text',
}: {
  id: string;
  role: 'assistant' | 'tool' | 'user' | 'system';
  createdAt: Date;
  parts: Array<Record<string, unknown>>;
  type?: string;
}) {
  return {
    id,
    role,
    type,
    createdAt,
    content: {
      format: 2 as const,
      parts,
    },
  };
}

function createLegacyGenerateResult(text: string) {
  return {
    text,
    usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    finishReason: 'stop',
    response: {
      id: 'legacy-model-response',
      timestamp: new Date(),
      modelId: 'legacy-model',
      messages: [],
    },
  } as unknown as Awaited<ReturnType<Agent['generateLegacy']>>;
}

function createStreamResult(
  text: string,
  providerMetadata?: Record<string, Record<string, unknown> | undefined>,
  dbMessages?: Array<Record<string, unknown>>,
) {
  const fullStream = new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: 'text-delta',
        payload: {
          text: 'Hello',
        },
      });
      controller.enqueue({
        type: 'text-delta',
        payload: {
          text: ' world',
        },
      });
      controller.close();
    },
  });

  return {
    fullStream,
    text: Promise.resolve(text),
    finishReason: Promise.resolve('stop'),
    totalUsage: Promise.resolve({ inputTokens: 12, outputTokens: 4, totalTokens: 16 }),
    providerMetadata: Promise.resolve(providerMetadata),
    response: Promise.resolve({
      id: 'stream-model-response',
      dbMessages,
    }),
  } as unknown as Awaited<ReturnType<Agent['stream']>>;
}

function createLegacyStreamResult(text: string) {
  const fullStream = Promise.resolve(
    new ReadableStream({
      start(controller) {
        controller.enqueue({
          type: 'text-delta',
          textDelta: 'Hello',
        });
        controller.enqueue({
          type: 'text-delta',
          textDelta: ' world',
        });
        controller.close();
      },
    }),
  );

  return {
    fullStream,
    text: Promise.resolve(text),
    finishReason: Promise.resolve('stop'),
    usage: Promise.resolve({ promptTokens: 12, completionTokens: 4, totalTokens: 16 }),
  } as unknown as Awaited<ReturnType<Agent['streamLegacy']>>;
}

async function readJson(response: Response) {
  return response.json();
}

type SseEventPayload = {
  type: string;
  response?: Record<string, unknown>;
};

async function readSseEvents(response: Response): Promise<SseEventPayload[]> {
  const body = await response.text();

  return body
    .split('\n\n')
    .map(block => block.trim())
    .filter(Boolean)
    .flatMap(block => {
      const dataLine = block.split('\n').find(line => line.startsWith('data: '));
      if (!dataLine) {
        return [];
      }

      return [JSON.parse(dataLine.slice('data: '.length)) as SseEventPayload];
    });
}

function mockAgentSpecVersion(agent: Agent, specificationVersion: 'v1' | 'v2' = 'v2') {
  vi.spyOn(agent, 'getModel').mockResolvedValue({
    specificationVersion,
    provider: 'openai',
    modelId: specificationVersion === 'v1' ? 'legacy-model' : 'test-model',
  } as never);
}

class RootInjectedMockMemory extends MockMemory {
  constructor() {
    super();
    this._storage = undefined;
    this._hasOwnStorage = false;
  }
}

function createMastraWithDedicatedAgentMemory() {
  const rootStorage = new InMemoryStore();
  const agentStorage = new InMemoryStore();
  const memory = new MockMemory({ storage: agentStorage });
  const agent = new Agent({
    id: 'dedicated-agent',
    name: 'dedicated-agent',
    instructions: 'dedicated instructions',
    model: {} as never,
    memory,
  });
  const mastra = new Mastra({
    logger: false,
    storage: rootStorage,
    agents: {
      'dedicated-agent': agent,
    },
  });

  mockAgentSpecVersion(agent);

  return {
    agent,
    mastra,
    memory,
    rootStorage,
  };
}

function createMastraWithAgentMemoryUsingRootStorage() {
  const rootStorage = new InMemoryStore();
  const memory = new RootInjectedMockMemory();
  const agent = new Agent({
    id: 'root-backed-agent',
    name: 'root-backed-agent',
    instructions: 'root-backed instructions',
    model: {} as never,
    memory,
  });
  const mastra = new Mastra({
    logger: false,
    storage: rootStorage,
    agents: {
      'root-backed-agent': agent,
    },
  });

  mockAgentSpecVersion(agent);

  return {
    agent,
    mastra,
    rootStorage,
  };
}

function createMastraWithAgentMemoryWithoutStorage() {
  const memory = new RootInjectedMockMemory();
  const agent = new Agent({
    id: 'agent-without-storage',
    name: 'agent-without-storage',
    instructions: 'agent-without-storage instructions',
    model: {} as never,
    memory,
  });
  const mastra = new Mastra({
    logger: false,
    agents: {
      'agent-without-storage': agent,
    },
  });

  mockAgentSpecVersion(agent);

  return {
    agent,
    mastra,
  };
}

describe('Responses Handlers', () => {
  let storage: InMemoryStore;
  let memory: MockMemory;
  let agent: Agent;
  let toolAgent: Agent;
  let mastra: Mastra;

  beforeEach(() => {
    storage = new InMemoryStore();
    memory = new MockMemory({ storage });

    agent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'test instructions',
      model: {} as never,
      memory,
    });

    const weatherTool = createTool({
      id: 'weather',
      description: 'Gets the current weather for a city',
      inputSchema: z.object({
        city: z.string(),
      }),
      execute: async () => ({ weather: 'sunny' }),
    });

    toolAgent = new Agent({
      id: 'tool-agent',
      name: 'tool-agent',
      instructions: 'tool instructions',
      model: {} as never,
      memory,
      tools: {
        weather: weatherTool,
      },
    });

    mastra = new Mastra({
      logger: false,
      storage,
      agents: {
        'test-agent': agent,
        'tool-agent': toolAgent,
      },
    });

    mockAgentSpecVersion(agent);
    mockAgentSpecVersion(toolAgent);
  });

  it('creates and retrieves a stored non-streaming response', async () => {
    vi.spyOn(agent, 'generate').mockResolvedValue(createGenerateResult({ text: 'Hello from Mastra' }));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Hello',
      store: true,
      stream: false,
    })) as Response;

    expect(response.headers.get('Content-Type')).toContain('application/json');

    const created = await readJson(response);
    expect(created).toMatchObject({
      object: 'response',
      model: 'openai/gpt-5',
      status: 'completed',
      store: true,
      conversation_id: expect.any(String),
      completed_at: expect.any(Number),
      error: null,
      incomplete_details: null,
      tools: [],
      output: [
        {
          type: 'message',
          role: 'assistant',
          status: 'completed',
          content: [{ type: 'output_text', text: 'Hello from Mastra', annotations: [], logprobs: [] }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
        input_tokens_details: {
          cached_tokens: 0,
        },
        output_tokens_details: {
          reasoning_tokens: 0,
        },
      },
    });
    expect(created.id).toBe(created.output[0].id);
    expect(created.conversation_id).toBeTruthy();

    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    expect(retrieved).toEqual(created);
  });

  it('accepts omitted model in the create response request schema', () => {
    const result = createResponseBodySchema.safeParse({
      agent_id: 'test-agent',
      input: 'Hello',
      stream: false,
    });

    expect(result.success).toBe(true);
  });

  it('uses the agent default model when create requests omit model', async () => {
    vi.spyOn(agent, 'getModel').mockResolvedValue({
      specificationVersion: 'v2',
      provider: 'openai.responses',
      modelId: 'gpt-4o-mini',
    } as never);
    const generateSpy = vi
      .spyOn(agent, 'generate')
      .mockResolvedValue(createGenerateResult({ text: 'Hello from Mastra' }));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      agent_id: 'test-agent',
      input: 'Hello',
      store: false,
      stream: false,
    })) as Response;

    const created = await readJson(response);

    expect((generateSpy.mock.calls[0]?.[1] as Record<string, unknown>)?.model).toBeUndefined();
    expect(created).toMatchObject({
      object: 'response',
      model: 'openai/gpt-4o-mini',
      status: 'completed',
    });
  });

  it('maps text.format json_object to structuredOutput for v2 generate requests', async () => {
    const generateSpy = vi
      .spyOn(agent, 'generate')
      .mockResolvedValue(createGenerateResult({ text: '{"summary":"Hello from Mastra"}' }));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Return JSON',
      text: {
        format: {
          type: 'json_object',
        },
      },
      stream: false,
      store: false,
    })) as Response;

    const created = await readJson(response);

    expect(generateSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Return JSON' }],
      expect.objectContaining({
        structuredOutput: {
          schema: {
            type: 'object',
            additionalProperties: true,
          },
          jsonPromptInjection: true,
        },
      }),
    );
    expect(created.text).toEqual({
      format: {
        type: 'json_object',
      },
    });
    expect(created.output).toMatchObject([
      {
        type: 'message',
        content: [{ text: '{"summary":"Hello from Mastra"}' }],
      },
    ]);
  });

  it('returns text.format json_object on stored retrieval', async () => {
    vi.spyOn(agent, 'generate').mockResolvedValue(createGenerateResult({ text: '{"summary":"Stored hello"}' }));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Store JSON',
      text: {
        format: {
          type: 'json_object',
        },
      },
      stream: false,
      store: true,
    })) as Response;

    const created = await readJson(response);
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    expect(retrieved).toMatchObject({
      id: created.id,
      text: {
        format: {
          type: 'json_object',
        },
      },
      output: [
        {
          type: 'message',
          content: [{ text: '{"summary":"Stored hello"}' }],
        },
      ],
    });
  });

  it('maps text.format json_object to structuredOutput for v2 stream requests', async () => {
    const streamSpy = vi.spyOn(agent, 'stream').mockResolvedValue(createStreamResult('{"summary":"Hello world"}'));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Stream JSON',
      text: {
        format: {
          type: 'json_object',
        },
      },
      stream: true,
      store: false,
    })) as Response;

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(streamSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Stream JSON' }],
      expect.objectContaining({
        structuredOutput: {
          schema: {
            type: 'object',
            additionalProperties: true,
          },
          jsonPromptInjection: true,
        },
      }),
    );
  });

  it('maps text.format json_schema to structuredOutput for v2 generate requests and returns it on the response', async () => {
    const generateSpy = vi
      .spyOn(agent, 'generate')
      .mockResolvedValue(createGenerateResult({ text: '{"summary":"Schema hello","priority":"high"}' }));

    const schema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
        priority: { type: 'string' },
      },
      required: ['summary', 'priority'],
      additionalProperties: false,
    };

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Return typed JSON',
      text: {
        format: {
          type: 'json_schema',
          name: 'ticket_summary',
          description: 'Structured summary output',
          strict: true,
          schema,
        },
      },
      stream: false,
      store: true,
    })) as Response;

    const created = await readJson(response);

    expect(generateSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Return typed JSON' }],
      expect.objectContaining({
        structuredOutput: {
          schema,
        },
      }),
    );
    expect(created.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'ticket_summary',
        description: 'Structured summary output',
        strict: true,
        schema,
      },
    });

    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    expect(retrieved).toMatchObject({
      id: created.id,
      text: {
        format: {
          type: 'json_schema',
          name: 'ticket_summary',
          description: 'Structured summary output',
          strict: true,
          schema,
        },
      },
      output: [
        {
          type: 'message',
          content: [{ text: '{"summary":"Schema hello","priority":"high"}' }],
        },
      ],
    });
  });

  it('maps text.format json_schema to structuredOutput for v2 stream requests', async () => {
    const streamSpy = vi.spyOn(agent, 'stream').mockResolvedValue(createStreamResult('{"summary":"Stream schema"}'));
    const schema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
      },
      required: ['summary'],
      additionalProperties: false,
    };

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Stream typed JSON',
      text: {
        format: {
          type: 'json_schema',
          name: 'stream_summary',
          schema,
        },
      },
      stream: true,
      store: false,
    })) as Response;

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');
    expect(streamSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Stream typed JSON' }],
      expect.objectContaining({
        structuredOutput: {
          schema,
        },
      }),
    );
  });

  it('emits json_object text.format on streamed response payloads', async () => {
    vi.spyOn(agent, 'stream').mockResolvedValue(createStreamResult('{"summary":"Hello world"}'));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Stream JSON',
      text: {
        format: {
          type: 'json_object',
        },
      },
      stream: true,
      store: false,
    })) as Response;

    const events = await readSseEvents(response);
    const createdEvent = events.find(event => event.type === 'response.created');
    const completedEvent = events.find(event => event.type === 'response.completed');

    expect(createdEvent?.response?.text).toEqual({
      format: {
        type: 'json_object',
      },
    });
    expect(completedEvent?.response?.text).toEqual({
      format: {
        type: 'json_object',
      },
    });
  });

  it('emits json_schema text.format on streamed response payloads', async () => {
    const schema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
      },
      required: ['summary'],
      additionalProperties: false,
    };

    vi.spyOn(agent, 'stream').mockResolvedValue(createStreamResult('{"summary":"Hello world"}'));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Stream typed JSON',
      text: {
        format: {
          type: 'json_schema',
          name: 'stream_summary',
          strict: true,
          schema,
        },
      },
      stream: true,
      store: false,
    })) as Response;

    const events = await readSseEvents(response);
    const createdEvent = events.find(event => event.type === 'response.created');
    const completedEvent = events.find(event => event.type === 'response.completed');

    expect(createdEvent?.response?.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'stream_summary',
        strict: true,
        schema,
      },
    });
    expect(completedEvent?.response?.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'stream_summary',
        strict: true,
        schema,
      },
    });
  });

  it('maps text.format json_object to output for legacy generate requests', async () => {
    mockAgentSpecVersion(agent, 'v1');
    const legacyGenerateSpy = vi
      .spyOn(agent, 'generateLegacy')
      .mockResolvedValue(createLegacyGenerateResult('{"summary":"Legacy hello"}'));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-4.1',
      agent_id: 'test-agent',
      input: 'Return JSON',
      text: {
        format: {
          type: 'json_object',
        },
      },
      stream: false,
      store: false,
    })) as Response;

    const created = await readJson(response);

    expect(legacyGenerateSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Return JSON' }],
      expect.objectContaining({
        output: {
          type: 'object',
          additionalProperties: true,
        },
      }),
    );
    expect(created.output).toMatchObject([
      {
        type: 'message',
        content: [{ text: '{"summary":"Legacy hello"}' }],
      },
    ]);
  });

  it('maps text.format json_schema to output for legacy generate requests', async () => {
    mockAgentSpecVersion(agent, 'v1');
    const legacyGenerateSpy = vi
      .spyOn(agent, 'generateLegacy')
      .mockResolvedValue(createLegacyGenerateResult('{"summary":"Legacy schema hello"}'));

    const schema = {
      type: 'object',
      properties: {
        summary: { type: 'string' },
      },
      required: ['summary'],
      additionalProperties: false,
    };

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-4.1',
      agent_id: 'test-agent',
      input: 'Return typed JSON',
      text: {
        format: {
          type: 'json_schema',
          name: 'legacy_summary',
          strict: true,
          schema,
        },
      },
      stream: false,
      store: false,
    })) as Response;

    const created = await readJson(response);

    expect(legacyGenerateSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Return typed JSON' }],
      expect.objectContaining({
        output: schema,
      }),
    );
    expect(created.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'legacy_summary',
        strict: true,
        schema,
      },
    });
  });

  it('returns 400 when store is requested for an agent without memory', async () => {
    const statelessAgent = new Agent({
      id: 'stateless-agent',
      name: 'stateless-agent',
      instructions: 'stateless instructions',
      model: {} as never,
    });

    mastra = new Mastra({
      logger: false,
      storage,
      agents: {
        'stateless-agent': statelessAgent,
      },
    });

    mockAgentSpecVersion(statelessAgent);
    vi.spyOn(statelessAgent, 'generate').mockResolvedValue(createGenerateResult({ text: 'Stateless response' }));

    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5-mini',
        agent_id: 'stateless-agent',
        input: 'Hello',
        store: true,
        stream: false,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('returns 400 when conversation_id is provided for an agent without memory', async () => {
    const statelessAgent = new Agent({
      id: 'stateless-agent',
      name: 'stateless-agent',
      instructions: 'stateless instructions',
      model: {} as never,
    });

    mastra = new Mastra({
      logger: false,
      storage,
      agents: {
        'stateless-agent': statelessAgent,
      },
    });

    mockAgentSpecVersion(statelessAgent);
    vi.spyOn(statelessAgent, 'generate').mockResolvedValue(createGenerateResult({ text: 'Stateless response' }));

    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5-mini',
        agent_id: 'stateless-agent',
        conversation_id: 'conv_123',
        input: 'Hello',
        store: false,
        stream: false,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('returns 400 when the request does not target a Mastra agent', async () => {
    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5',
        input: 'Hello',
        stream: false,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('requires agent_id when previous_response_id is provided', async () => {
    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5',
        input: 'Second turn',
        previous_response_id: 'resp_missing_agent',
        store: true,
        stream: false,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('reuses the stored thread when previous_response_id is provided', async () => {
    const generateSpy = vi.spyOn(agent, 'generate');
    generateSpy.mockResolvedValue(createGenerateResult({ text: 'First response' }));

    const firstResponse = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'First turn',
      store: true,
      stream: false,
    })) as Response;

    const firstCreated = await readJson(firstResponse);
    const firstCall = generateSpy.mock.calls[0]?.[1];
    const firstThreadId = (firstCall as { memory?: { thread?: string } })?.memory?.thread;
    const firstResourceId = (firstCall as { memory?: { resource?: string } })?.memory?.resource;

    generateSpy.mockResolvedValue(createGenerateResult({ text: 'Second response' }));

    await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Second turn',
      previous_response_id: firstCreated.id,
      store: true,
      stream: false,
    });

    const secondCall = generateSpy.mock.calls[1]?.[1];
    expect(secondCall).toMatchObject({
      memory: {
        thread: firstThreadId,
        resource: firstResourceId,
      },
    });

    const secondInput = generateSpy.mock.calls[1]?.[0];
    expect(secondInput).toEqual([{ role: 'user', content: 'Second turn' }]);
  });

  it('uses an explicit conversation_id as the thread source of truth', async () => {
    vi.spyOn(agent, 'generate').mockResolvedValue(createGenerateResult({ text: 'Hello from explicit conversation' }));

    const memoryThread = await memory.createThread({
      threadId: 'conv_explicit',
      resourceId: 'conv_explicit',
    });

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      conversation_id: memoryThread.id,
      input: 'Hello',
      store: true,
      stream: false,
    })) as Response;

    const created = await readJson(response);
    expect(created.conversation_id).toBe(memoryThread.id);

    const generateCall = vi.mocked(agent.generate).mock.calls[0]?.[1] as {
      memory?: { thread?: string; resource?: string };
    };
    expect(generateCall.memory).toEqual({
      thread: memoryThread.id,
      resource: memoryThread.resourceId,
    });
  });

  it('rejects mismatched conversation_id and previous_response_id', async () => {
    vi.spyOn(agent, 'generate').mockResolvedValue(createGenerateResult({ text: 'First response' }));

    const firstResponse = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'First turn',
      store: true,
      stream: false,
    })) as Response;

    const firstCreated = await readJson(firstResponse);
    await memory.createThread({
      threadId: 'conv_other',
      resourceId: 'conv_other',
    });

    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5',
        agent_id: 'test-agent',
        conversation_id: 'conv_other',
        previous_response_id: firstCreated.id,
        input: 'Second turn',
        store: true,
        stream: false,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('falls back to generateLegacy for AI SDK v4 agents', async () => {
    mockAgentSpecVersion(agent, 'v1');
    const generateLegacySpy = vi
      .spyOn(agent, 'generateLegacy')
      .mockResolvedValue(createLegacyGenerateResult('Legacy hello'));
    const generateSpy = vi.spyOn(agent, 'generate');

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-4o',
      agent_id: 'test-agent',
      input: 'Hello',
      store: false,
      stream: false,
    })) as Response;

    const created = await readJson(response);
    expect(created).toMatchObject({
      model: 'openai/gpt-4o',
      status: 'completed',
      output: [
        {
          content: [{ text: 'Legacy hello' }],
        },
      ],
      usage: {
        input_tokens: 10,
        output_tokens: 5,
        total_tokens: 15,
      },
    });
    expect(generateLegacySpy).toHaveBeenCalledOnce();
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it('passes providerOptions through to generate calls', async () => {
    const generateSpy = vi.spyOn(agent, 'generate').mockResolvedValue(
      createGenerateResult({
        text: 'Provider aware',
        providerMetadata: {
          openai: {
            responseId: 'resp_provider_123',
          },
        },
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Hello',
      providerOptions: {
        openai: {
          previousResponseId: 'resp_provider_123',
        },
      },
      store: false,
      stream: false,
    })) as Response;

    expect(generateSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hello' }],
      expect.objectContaining({
        providerOptions: {
          openai: {
            previousResponseId: 'resp_provider_123',
          },
        },
      }),
    );

    const created = await readJson(response);
    expect(created.providerOptions).toEqual({
      openai: {
        responseId: 'resp_provider_123',
      },
    });
  });

  it('streams SSE events and stores the completed response', async () => {
    vi.spyOn(agent, 'stream').mockResolvedValue(createStreamResult('Hello world'));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Hello',
      store: true,
      stream: true,
    })) as Response;

    expect(response.headers.get('Content-Type')).toContain('text/event-stream');

    const body = await response.text();
    expect(body).toContain('event: response.created');
    expect(body).toContain('event: response.in_progress');
    expect(body).toContain('event: response.output_item.added');
    expect(body).toContain('event: response.content_part.added');
    expect(body).toContain('event: response.output_text.delta');
    expect(body).toContain('event: response.output_text.done');
    expect(body).toContain('event: response.content_part.done');
    expect(body).toContain('event: response.output_item.done');
    expect(body).toContain('event: response.completed');
    expect(body).toContain('"sequence_number":1');

    const completedLine = body.split('\n').find(line => line.startsWith('data: {"type":"response.completed"'));
    expect(completedLine).toBeTruthy();

    const completedPayload = JSON.parse(completedLine!.slice('data: '.length)) as { response: { id: string } };
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completedPayload.response.id,
    });

    expect(retrieved).toMatchObject({
      id: completedPayload.response.id,
      status: 'completed',
      output: [
        {
          content: [{ text: 'Hello world' }],
        },
      ],
      usage: {
        input_tokens: 12,
        output_tokens: 4,
        total_tokens: 16,
      },
    });
  });

  it('falls back to streamLegacy for AI SDK v4 agents', async () => {
    mockAgentSpecVersion(agent, 'v1');
    const streamLegacySpy = vi.spyOn(agent, 'streamLegacy').mockResolvedValue(createLegacyStreamResult('Hello world'));
    const streamSpy = vi.spyOn(agent, 'stream');

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-4o',
      agent_id: 'test-agent',
      input: 'Hello',
      store: false,
      stream: true,
    })) as Response;

    const body = await response.text();
    expect(body).toContain('event: response.completed');
    expect(body).toContain('event: response.output_item.done');
    expect(body).toContain('"text":"Hello world"');
    expect(streamLegacySpy).toHaveBeenCalledOnce();
    expect(streamSpy).not.toHaveBeenCalled();
  });

  it('passes providerOptions through to stream calls', async () => {
    const streamSpy = vi.spyOn(agent, 'stream').mockResolvedValue(
      createStreamResult('Hello world', {
        openai: {
          responseId: 'resp_provider_stream_123',
        },
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Hello',
      providerOptions: {
        openai: {
          conversation: 'conv_123',
        },
      },
      store: false,
      stream: true,
    })) as Response;

    expect(streamSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hello' }],
      expect.objectContaining({
        providerOptions: {
          openai: {
            conversation: 'conv_123',
          },
        },
      }),
    );

    const body = await response.text();
    expect(body).toContain('"providerOptions":{"openai":{"responseId":"resp_provider_stream_123"}}');
  });

  it('streams tool-backed turns with the assistant message as the completed output item', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResult('The weather is sunny.', undefined, [
        createDbMessage({
          id: 'assistant-tool-call',
          role: 'assistant',
          createdAt: new Date('2026-03-23T10:10:00.000Z'),
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_stream_1',
                toolName: 'weather',
                args: { city: 'Lagos' },
                result: { weather: 'sunny' },
              },
            },
          ],
        }),
        createDbMessage({
          id: 'tool-result-stream-1',
          role: 'tool',
          type: 'tool-result',
          createdAt: new Date('2026-03-23T10:10:01.000Z'),
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_stream_1',
                toolName: 'weather',
                result: { weather: 'sunny' },
              },
            },
          ],
        }),
        createDbMessage({
          id: 'assistant-final-stream',
          role: 'assistant',
          createdAt: new Date('2026-03-23T10:10:02.000Z'),
          parts: [{ type: 'text', text: 'The weather is sunny.' }],
        }),
      ]),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'What is the weather in Lagos?',
      store: true,
      stream: true,
    })) as Response;

    const body = await response.text();
    expect(body).toContain('"type":"response.output_item.done"');
    expect(body).toContain('"item":{"id":"');
    expect(body).toContain('"type":"message"');
    expect(body).toContain('"text":"The weather is sunny."');
    expect(body).toContain('"type":"function_call"');
    expect(body).toContain('"type":"function_call_output"');
  });

  it('deletes a stored response', async () => {
    vi.spyOn(agent, 'generate').mockResolvedValue(createGenerateResult({ text: 'To delete' }));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      input: 'Hello',
      store: true,
      stream: false,
    })) as Response;

    const created = await readJson(response);

    const deleted = await DELETE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    expect(deleted).toEqual({
      id: created.id,
      object: 'response',
      deleted: true,
    });

    await expect(
      GET_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        responseId: created.id,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('returns 404 when the requested agent does not exist', async () => {
    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5',
        agent_id: 'missing-agent',
        input: 'Hello',
        stream: false,
        store: false,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('stores tool-backed turns on the final assistant message', async () => {
    const generateSpy = vi.spyOn(toolAgent, 'generate').mockResolvedValue(
      createGenerateResult({
        text: 'The weather is sunny.',
        dbMessages: [
          createDbMessage({
            id: 'assistant-tool-call',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_1',
                  toolName: 'weather',
                  args: { city: 'Lagos' },
                  result: { weather: 'sunny' },
                },
              },
            ],
          }),
          createDbMessage({
            id: 'tool-result-1',
            role: 'tool',
            type: 'tool-result',
            createdAt: new Date('2026-03-23T10:00:01.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_1',
                  toolName: 'weather',
                  result: { weather: 'sunny' },
                },
              },
            ],
          }),
          createDbMessage({
            id: 'assistant-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:00:02.000Z'),
            parts: [{ type: 'text', text: 'The weather is sunny.' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'What is the weather in Lagos?',
      store: true,
      stream: false,
    })) as Response;

    const created = await readJson(response);
    const threadId = (generateSpy.mock.calls[0]?.[1] as { memory?: { thread?: string } })?.memory?.thread;
    const storedMessages = await memory.recall({ threadId: threadId!, perPage: false });
    const responseMessage = created.output.find((item: { type: string }) => item.type === 'message');

    expect(responseMessage?.id).toBe(created.id);
    expect(created.tools).toEqual([
      expect.objectContaining({
        type: 'function',
        name: 'weather',
        description: 'Gets the current weather for a city',
        parameters: expect.objectContaining({
          type: 'object',
          additionalProperties: false,
          properties: {
            city: {
              type: 'string',
            },
          },
          required: ['city'],
        }),
      }),
    ]);
    expect(created.output).toMatchObject([
      {
        type: 'function_call',
        call_id: 'call_1',
        name: 'weather',
        arguments: JSON.stringify({ city: 'Lagos' }),
      },
      {
        type: 'function_call_output',
        call_id: 'call_1',
        output: JSON.stringify({ weather: 'sunny' }),
      },
      {
        id: created.id,
        type: 'message',
        role: 'assistant',
        content: [{ text: 'The weather is sunny.' }],
      },
    ]);
    expect(storedMessages.messages.map(message => message.id)).toEqual(
      expect.arrayContaining([created.id, 'assistant-tool-call', 'tool-result-1']),
    );
    expect(storedMessages.messages.map(message => message.id)).not.toContain('assistant-final');

    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    expect(retrieved).toMatchObject({
      id: created.id,
      tools: [
        {
          type: 'function',
          name: 'weather',
        },
      ],
      output: [
        {
          type: 'function_call',
          call_id: 'call_1',
          name: 'weather',
          arguments: JSON.stringify({ city: 'Lagos' }),
        },
        {
          type: 'function_call_output',
          call_id: 'call_1',
          output: JSON.stringify({ weather: 'sunny' }),
        },
        {
          id: created.id,
          type: 'message',
          content: [{ text: 'The weather is sunny.' }],
        },
      ],
    });
  });

  it('deletes all persisted messages for a tool-backed turn', async () => {
    vi.spyOn(toolAgent, 'generate').mockResolvedValue(
      createGenerateResult({
        text: 'Tool-backed answer',
        dbMessages: [
          createDbMessage({
            id: 'assistant-tool-call',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:05:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_2',
                  toolName: 'lookup',
                  result: { ok: true },
                },
              },
            ],
          }),
          createDbMessage({
            id: 'assistant-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:05:01.000Z'),
            parts: [{ type: 'text', text: 'Tool-backed answer' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use the tool',
      store: true,
      stream: false,
    })) as Response;

    const created = await readJson(response);
    const deleted = await DELETE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    expect(deleted).toEqual({
      id: created.id,
      object: 'response',
      deleted: true,
    });

    await expect(
      GET_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        responseId: created.id,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('stores and continues responses in the agent memory store when Mastra root storage is different', async () => {
    const dedicated = createMastraWithDedicatedAgentMemory();
    const generateSpy = vi.spyOn(dedicated.agent, 'generate');
    generateSpy.mockResolvedValueOnce(createGenerateResult({ text: 'First dedicated response' }));

    const firstResponse = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra: dedicated.mastra }),
      model: 'openai/gpt-5',
      agent_id: 'dedicated-agent',
      input: 'First turn',
      store: true,
      stream: false,
    })) as Response;

    const firstCreated = await readJson(firstResponse);
    const rootMemoryStore = await dedicated.rootStorage.getStore('memory');
    const rootMessages = await rootMemoryStore!.listMessagesById({ messageIds: [firstCreated.id] });
    expect(rootMessages.messages).toEqual([]);

    generateSpy.mockResolvedValueOnce(createGenerateResult({ text: 'Second dedicated response' }));

    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra: dedicated.mastra }),
        model: 'openai/gpt-5',
        agent_id: 'dedicated-agent',
        input: 'Second turn',
        previous_response_id: firstCreated.id,
        store: true,
        stream: false,
      }),
    ).resolves.toBeInstanceOf(Response);

    const firstCall = generateSpy.mock.calls[0]?.[1] as { memory?: { thread?: string; resource?: string } };
    const secondCall = generateSpy.mock.calls[1]?.[1] as { memory?: { thread?: string; resource?: string } };

    expect(secondCall.memory).toEqual(firstCall.memory);
  });

  it('retrieves and deletes stored responses from the agent memory store when Mastra root storage is different', async () => {
    const dedicated = createMastraWithDedicatedAgentMemory();
    vi.spyOn(dedicated.agent, 'generate').mockResolvedValue(
      createGenerateResult({ text: 'Stored in dedicated memory' }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra: dedicated.mastra }),
      model: 'openai/gpt-5',
      agent_id: 'dedicated-agent',
      input: 'Hello',
      store: true,
      stream: false,
    })) as Response;

    const created = await readJson(response);

    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra: dedicated.mastra }),
      responseId: created.id,
    });
    expect(retrieved).toMatchObject({
      id: created.id,
      object: 'response',
      store: true,
    });

    const deleted = await DELETE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra: dedicated.mastra }),
      responseId: created.id,
    });
    expect(deleted).toEqual({
      id: created.id,
      object: 'response',
      deleted: true,
    });

    await expect(
      GET_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra: dedicated.mastra }),
        responseId: created.id,
      }),
    ).rejects.toThrow(HTTPException);
  });

  it('stores responses through agent memory when that memory inherits Mastra root storage', async () => {
    const rootBacked = createMastraWithAgentMemoryUsingRootStorage();
    const generateSpy = vi.spyOn(rootBacked.agent, 'generate');
    generateSpy.mockResolvedValueOnce(createGenerateResult({ text: 'First inherited response' }));

    const firstResponse = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra: rootBacked.mastra }),
      model: 'openai/gpt-5',
      agent_id: 'root-backed-agent',
      input: 'First turn',
      store: true,
      stream: false,
    })) as Response;

    const firstCreated = await readJson(firstResponse);
    const rootMemoryStore = await rootBacked.rootStorage.getStore('memory');
    const rootMessages = await rootMemoryStore!.listMessagesById({ messageIds: [firstCreated.id] });
    expect(rootMessages.messages).toHaveLength(1);

    generateSpy.mockResolvedValueOnce(createGenerateResult({ text: 'Second inherited response' }));

    await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra: rootBacked.mastra }),
      model: 'openai/gpt-5',
      agent_id: 'root-backed-agent',
      input: 'Second turn',
      previous_response_id: firstCreated.id,
      store: true,
      stream: false,
    });

    const firstCall = generateSpy.mock.calls[0]?.[1] as { memory?: { thread?: string; resource?: string } };
    const secondCall = generateSpy.mock.calls[1]?.[1] as { memory?: { thread?: string; resource?: string } };

    expect(secondCall.memory).toEqual(firstCall.memory);
  });

  it('returns 400 when storing a response for an agent with memory but no storage', async () => {
    const noStorage = createMastraWithAgentMemoryWithoutStorage();
    vi.spyOn(noStorage.agent, 'generate').mockResolvedValue(createGenerateResult({ text: 'No storage response' }));

    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra: noStorage.mastra }),
        model: 'openai/gpt-5',
        agent_id: 'agent-without-storage',
        input: 'Hello',
        store: true,
        stream: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
    });
  });
});
