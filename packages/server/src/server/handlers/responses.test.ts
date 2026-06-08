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
import { mapMastraMessagesToResponseOutputItems } from './responses.adapter';
import { resolveResponseTurnMessagesForStorage } from './responses.storage';
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

function createWeatherToolCallChunk({
  callId,
  city,
  streamArgs = false,
}: {
  callId: string;
  city: string;
  streamArgs?: boolean;
}) {
  if (!streamArgs) {
    return [
      {
        type: 'tool-call',
        payload: {
          toolCallId: callId,
          toolName: 'weather',
          args: { city },
        },
      },
    ];
  }

  return [
    {
      type: 'tool-call-input-streaming-start',
      payload: {
        toolCallId: callId,
        toolName: 'weather',
      },
    },
    {
      type: 'tool-call-delta',
      payload: {
        toolCallId: callId,
        toolName: 'weather',
        argsTextDelta: JSON.stringify({ city }),
      },
    },
    {
      type: 'tool-call-input-streaming-end',
      payload: {
        toolCallId: callId,
      },
    },
    {
      type: 'tool-call',
      payload: {
        toolCallId: callId,
        toolName: 'weather',
        args: { city },
      },
    },
  ];
}

function createWeatherToolResultChunk({ callId, weather }: { callId: string; weather: string }) {
  return {
    type: 'tool-result',
    payload: {
      toolCallId: callId,
      toolName: 'weather',
      result: { weather },
    },
  };
}

function createWeatherToolMessages({
  turns,
  finalText,
}: {
  turns: Array<{ callId: string; city: string; weather: string }>;
  finalText: string;
}) {
  return [
    ...turns.flatMap((turn, index) => [
      createDbMessage({
        id: `assistant-tool-call-${index + 1}`,
        role: 'assistant',
        createdAt: new Date(`2026-03-23T10:${10 + index}:00.000Z`),
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: turn.callId,
              toolName: 'weather',
              args: { city: turn.city },
              result: { weather: turn.weather },
            },
          },
        ],
      }),
      createDbMessage({
        id: `tool-result-stream-${index + 1}`,
        role: 'tool',
        type: 'tool-result',
        createdAt: new Date(`2026-03-23T10:${10 + index}:01.000Z`),
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'result',
              toolCallId: turn.callId,
              toolName: 'weather',
              result: { weather: turn.weather },
            },
          },
        ],
      }),
    ]),
    createDbMessage({
      id: 'assistant-final-stream',
      role: 'assistant',
      createdAt: new Date('2026-03-23T10:59:00.000Z'),
      parts: [{ type: 'text', text: finalText }],
    }),
  ];
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

function createStreamResultFromChunks({
  text,
  chunks,
  dbMessages,
}: {
  text: string;
  chunks: Array<Record<string, unknown>>;
  dbMessages?: Array<Record<string, unknown>>;
}) {
  const fullStream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });

  return {
    fullStream,
    text: Promise.resolve(text),
    finishReason: Promise.resolve('stop'),
    totalUsage: Promise.resolve({ inputTokens: 12, outputTokens: 4, totalTokens: 16 }),
    providerMetadata: Promise.resolve(undefined),
    response: Promise.resolve({
      id: 'stream-model-response',
      dbMessages,
    }),
  } as unknown as Awaited<ReturnType<Agent['stream']>>;
}

function createLegacyStreamResult({
  text,
  chunks = [
    {
      type: 'text-delta',
      textDelta: 'Hello',
    },
    {
      type: 'text-delta',
      textDelta: ' world',
    },
  ],
}: {
  text: string;
  chunks?: Array<Record<string, unknown>>;
}) {
  const fullStream = Promise.resolve(
    new ReadableStream({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(chunk);
        }
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

  it('accepts omitted agent_id in the create response request schema when previous_response_id is provided', () => {
    const result = createResponseBodySchema.safeParse({
      input: 'Hello again',
      previous_response_id: 'resp_123',
      stream: false,
    });

    expect(result.success).toBe(true);
  });

  it('rejects create response requests without agent_id or previous_response_id', () => {
    const result = createResponseBodySchema.safeParse({
      input: 'Hello',
      stream: false,
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty agent_id in the create response request schema', () => {
    const result = createResponseBodySchema.safeParse({
      agent_id: '',
      input: 'Hello',
      stream: false,
    });

    expect(result.success).toBe(false);
  });

  it('rejects empty previous_response_id in the create response request schema', () => {
    const result = createResponseBodySchema.safeParse({
      input: 'Hello again',
      previous_response_id: '',
      stream: false,
    });

    expect(result.success).toBe(false);
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

  it('returns 404 when previous_response_id is provided without agent_id and no stored response exists', async () => {
    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5',
        input: 'Second turn',
        previous_response_id: 'resp_missing_agent',
        store: true,
        stream: false,
      }),
    ).rejects.toMatchObject({ status: 404 });
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

  it('reuses a same-agent response found by the broader previous_response_id lookup', async () => {
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
    const firstMemory = (firstCall as { memory?: { thread?: string; resource?: string } })?.memory;

    vi.spyOn(agent, 'getMemory')
      .mockResolvedValueOnce(undefined as never)
      .mockResolvedValue(memory as never);
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
    expect(generateSpy).toHaveBeenCalledTimes(2);
    expect(secondCall).toMatchObject({
      memory: firstMemory,
    });
  });

  it('reuses the stored thread when previous_response_id is provided without agent_id', async () => {
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

    generateSpy.mockResolvedValue(createGenerateResult({ text: 'Second response' }));

    await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      input: 'Second turn',
      previous_response_id: firstCreated.id,
      store: true,
      stream: false,
    });

    const secondCall = generateSpy.mock.calls[1]?.[1];
    expect(generateSpy).toHaveBeenCalledTimes(2);
    expect(secondCall).toMatchObject({
      memory: (firstCall as { memory?: { thread?: string; resource?: string } })?.memory,
    });
  });

  it('returns 400 when previous_response_id belongs to a different explicit agent_id', async () => {
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

    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5',
        agent_id: 'tool-agent',
        input: 'Second turn',
        previous_response_id: firstCreated.id,
        store: true,
        stream: false,
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: expect.stringContaining('belongs to agent test-agent'),
    });
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

  it('keeps explicit conversation_id in streaming events when store is false', async () => {
    const streamSpy = vi.spyOn(agent, 'stream').mockResolvedValue(createStreamResult('Hello world'));
    const memoryThread = await memory.createThread({
      threadId: 'conv_stream_explicit',
      resourceId: 'resource-1',
    });

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'test-agent',
      conversation_id: memoryThread.id,
      input: 'Hello',
      store: false,
      stream: true,
    })) as Response;

    const events = await readSseEvents(response);
    const createdEvent = events.find(event => event.type === 'response.created');
    const completedEvent = events.find(event => event.type === 'response.completed');

    expect(createdEvent?.response?.conversation_id).toBe(memoryThread.id);
    expect(completedEvent?.response?.conversation_id).toBe(memoryThread.id);
    expect(createdEvent?.response?.store).toBe(false);
    expect(completedEvent?.response?.store).toBe(false);
    expect(streamSpy).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hello' }],
      expect.objectContaining({
        memory: {
          thread: memoryThread.id,
          resource: memoryThread.resourceId,
        },
      }),
    );
  });

  it('falls back to streamLegacy for AI SDK v4 agents', async () => {
    mockAgentSpecVersion(agent, 'v1');
    const streamLegacySpy = vi
      .spyOn(agent, 'streamLegacy')
      .mockResolvedValue(createLegacyStreamResult({ text: 'Hello world' }));
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

  it('streams legacy v1 tool-call chunks through Responses events', async () => {
    const toolTurn = { callId: 'call_legacy_stream', city: 'Lagos', weather: 'sunny' };
    mockAgentSpecVersion(agent, 'v1');
    const streamLegacySpy = vi.spyOn(agent, 'streamLegacy').mockResolvedValue(
      createLegacyStreamResult({
        text: 'Legacy tool done.',
        chunks: [
          {
            type: 'tool-call',
            toolCallId: toolTurn.callId,
            toolName: 'weather',
            args: { city: toolTurn.city },
          },
          {
            type: 'tool-result',
            toolCallId: toolTurn.callId,
            toolName: 'weather',
            result: { weather: toolTurn.weather },
          },
          {
            type: 'text-delta',
            textDelta: 'Legacy tool done.',
          },
        ],
      }),
    );
    const streamSpy = vi.spyOn(agent, 'stream');

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-4o',
      agent_id: 'test-agent',
      input: 'Use a legacy tool',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'response.function_call_arguments.done',
          item_id: 'call_legacy_stream',
          name: 'weather',
          arguments: JSON.stringify({ city: 'Lagos' }),
        }),
        expect.objectContaining({
          type: 'response.output_item.done',
          item: expect.objectContaining({
            id: 'call_legacy_stream:output',
            type: 'function_call_output',
            call_id: 'call_legacy_stream',
          }),
        }),
      ]),
    );
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
    const toolTurn = { callId: 'call_stream_1', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The weather is sunny.',
        chunks: [
          ...createWeatherToolCallChunk({ ...toolTurn, streamArgs: true }),
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The weather is sunny.',
            },
          },
        ],
        dbMessages: createWeatherToolMessages({
          turns: [toolTurn],
          finalText: 'The weather is sunny.',
        }),
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'What is the weather in Lagos?',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;

    expect(events.map(event => event.type)).toEqual(
      expect.arrayContaining([
        'response.function_call_arguments.delta',
        'response.function_call_arguments.done',
        'response.output_text.delta',
        'response.completed',
      ]),
    );
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'response.function_call_arguments.delta',
          item_id: 'call_stream_1',
          delta: '{"city":"Lagos"}',
        }),
        expect.objectContaining({
          type: 'response.function_call_arguments.done',
          item_id: 'call_stream_1',
          name: 'weather',
          arguments: JSON.stringify({ city: 'Lagos' }),
        }),
        expect.objectContaining({
          type: 'response.output_item.done',
          item: expect.objectContaining({
            id: 'call_stream_1',
            type: 'function_call',
            call_id: 'call_stream_1',
            name: 'weather',
          }),
        }),
        expect.objectContaining({
          type: 'response.output_item.done',
          item: expect.objectContaining({
            id: 'call_stream_1:output',
            type: 'function_call_output',
            call_id: 'call_stream_1',
            output: JSON.stringify({ weather: 'sunny' }),
          }),
        }),
      ]),
    );
    expect(events.filter(event => event.type === 'response.function_call_arguments.done')).toHaveLength(1);
    expect(
      events.filter(event => event.type === 'response.output_item.done' && event.item?.type === 'function_call_output'),
    ).toHaveLength(1);
    expect(
      events
        .filter(
          event =>
            event.type === 'response.function_call_arguments.delta' ||
            event.type === 'response.function_call_arguments.done' ||
            event.type === 'response.completed' ||
            ((event.type === 'response.output_item.added' || event.type === 'response.output_item.done') &&
              (event.item?.type === 'function_call' || event.item?.type === 'function_call_output')),
        )
        .map(event => ({
          type: event.type,
          itemType: event.item?.type,
          itemId: event.item?.id ?? event.item_id,
        })),
    ).toEqual([
      { type: 'response.output_item.added', itemType: 'function_call', itemId: 'call_stream_1' },
      { type: 'response.function_call_arguments.delta', itemType: undefined, itemId: 'call_stream_1' },
      { type: 'response.function_call_arguments.done', itemType: undefined, itemId: 'call_stream_1' },
      { type: 'response.output_item.done', itemType: 'function_call', itemId: 'call_stream_1' },
      { type: 'response.output_item.added', itemType: 'function_call_output', itemId: 'call_stream_1:output' },
      { type: 'response.output_item.done', itemType: 'function_call_output', itemId: 'call_stream_1:output' },
      { type: 'response.completed', itemType: undefined, itemId: undefined },
    ]);

    expect(completed.response?.output).toMatchObject([
      {
        id: 'call_stream_1',
        type: 'function_call',
        call_id: 'call_stream_1',
        name: 'weather',
        arguments: JSON.stringify({ city: 'Lagos' }),
      },
      {
        id: 'call_stream_1:output',
        type: 'function_call_output',
        call_id: 'call_stream_1',
        output: JSON.stringify({ weather: 'sunny' }),
      },
      {
        type: 'message',
        content: [{ text: 'The weather is sunny.' }],
      },
    ]);
  });

  it('streams multiple tool calls in order before the final text message', async () => {
    const weatherTurns = [
      { callId: 'call_first', city: 'Lagos', weather: 'sunny' },
      { callId: 'call_second', city: 'Paris', weather: 'cloudy' },
    ];

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'Both lookups are done.',
        chunks: [
          ...weatherTurns.flatMap(turn => [...createWeatherToolCallChunk(turn), createWeatherToolResultChunk(turn)]),
          {
            type: 'text-delta',
            payload: {
              text: 'Both lookups are done.',
            },
          },
        ],
        dbMessages: createWeatherToolMessages({
          turns: weatherTurns,
          finalText: 'Both lookups are done.',
        }),
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check two cities',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completedToolCalls = events
      .filter(event => event.type === 'response.output_item.done' && event.item?.type === 'function_call')
      .map(event => ({ id: event.item.id, callId: event.item.call_id }));
    const completed = events.find(event => event.type === 'response.completed')!;

    expect(completedToolCalls).toEqual([
      { id: 'call_first', callId: 'call_first' },
      { id: 'call_second', callId: 'call_second' },
    ]);
    expect(completed.response?.output).toMatchObject([
      {
        id: 'call_first',
        type: 'function_call',
        call_id: 'call_first',
      },
      {
        id: 'call_first:output',
        type: 'function_call_output',
        call_id: 'call_first',
      },
      {
        id: 'call_second',
        type: 'function_call',
        call_id: 'call_second',
      },
      {
        id: 'call_second:output',
        type: 'function_call_output',
        call_id: 'call_second',
      },
      {
        type: 'message',
        content: [{ text: 'Both lookups are done.' }],
      },
    ]);
  });

  it('retrieves streamed parallel tool calls in the same order as the completed response', async () => {
    const weatherTurns = [
      { callId: 'call_parallel_first', city: 'Lagos', weather: 'sunny' },
      { callId: 'call_parallel_second', city: 'Paris', weather: 'cloudy' },
    ];
    const finalText = 'Both parallel lookups are done.';

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: finalText,
        chunks: [
          ...weatherTurns.flatMap(turn => createWeatherToolCallChunk(turn)),
          ...weatherTurns.map(turn => createWeatherToolResultChunk(turn)),
          {
            type: 'text-delta',
            payload: {
              text: finalText,
            },
          },
        ],
        dbMessages: [
          ...weatherTurns.map((turn, index) =>
            createDbMessage({
              id: `assistant-parallel-tool-${index + 1}`,
              role: 'assistant',
              createdAt: new Date(`2026-03-23T10:${20 + index}:00.000Z`),
              parts: [
                {
                  type: 'tool-invocation',
                  toolInvocation: {
                    state: 'result',
                    toolCallId: turn.callId,
                    toolName: 'weather',
                    args: { city: turn.city },
                    result: { weather: turn.weather },
                  },
                },
              ],
            }),
          ),
          createDbMessage({
            id: 'assistant-parallel-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: finalText }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check two cities in parallel',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const completedOutputIds = completed.response.output.map((item: Record<string, unknown>) => item.id);

    expect(completedOutputIds).toEqual([
      'call_parallel_first',
      'call_parallel_second',
      'call_parallel_first:output',
      'call_parallel_second:output',
      completed.response.id,
    ]);

    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    expect(retrieved.output.map(item => item.id)).toEqual(completedOutputIds);
  });

  it('does not synthesize an empty message item for tool-only streams', async () => {
    const toolTurn = { callId: 'call_tool_only', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          // Simulates providers that stream arguments but do not emit the final consolidated tool-call chunk.
          ...createWeatherToolCallChunk({ ...toolTurn, streamArgs: true }).slice(0, 3),
          createWeatherToolResultChunk(toolTurn),
        ],
        dbMessages: createWeatherToolMessages({
          turns: [toolTurn],
          finalText: '',
        }),
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use only the tool',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;

    expect(events.map(event => event.type)).not.toContain('response.output_text.done');
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'response.function_call_arguments.done',
          item_id: 'call_tool_only',
          arguments: JSON.stringify({ city: 'Lagos' }),
        }),
      ]),
    );
    expect(completed.response.output).toMatchObject([
      {
        id: 'call_tool_only',
        type: 'function_call',
      },
      {
        id: 'call_tool_only:output',
        type: 'function_call_output',
      },
    ]);
    expect(completed.response.output.some((item: { type: string }) => item.type === 'message')).toBe(false);

    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    expect(retrieved.output).toMatchObject([
      {
        id: 'call_tool_only',
        type: 'function_call',
      },
      {
        id: 'call_tool_only:output',
        type: 'function_call_output',
      },
    ]);
    expect(retrieved.output.some((item: { type: string }) => item.type === 'message')).toBe(false);
  });

  it('closes zero-argument streamed tool calls when the result arrives', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'Done.',
        chunks: [
          {
            type: 'tool-call-input-streaming-start',
            payload: {
              toolCallId: 'call_zero_args',
              toolName: 'weather',
            },
          },
          {
            type: 'tool-call-input-streaming-end',
            payload: {
              toolCallId: 'call_zero_args',
            },
          },
          createWeatherToolResultChunk({ callId: 'call_zero_args', weather: 'sunny' }),
          {
            type: 'text-delta',
            payload: {
              text: 'Done.',
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use the zero argument tool',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completedToolCall = events.find(
      event => event.type === 'response.output_item.done' && event.item?.type === 'function_call',
    );

    expect(completedToolCall?.item).toMatchObject({
      id: 'call_zero_args',
      type: 'function_call',
      arguments: '{}',
      status: 'completed',
    });
    expect(events.filter(event => event.type === 'response.function_call_arguments.done')).toHaveLength(1);
    expect(events.find(event => event.type === 'response.completed')?.response.output).toMatchObject([
      {
        id: 'call_zero_args',
        type: 'function_call',
      },
      {
        id: 'call_zero_args:output',
        type: 'function_call_output',
      },
      {
        type: 'message',
        content: [{ text: 'Done.' }],
      },
    ]);
  });

  it('uses tool-result args after an argument-free streaming end', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'Done.',
        chunks: [
          {
            type: 'tool-call-input-streaming-start',
            payload: {
              toolCallId: 'call_result_args',
              toolName: 'weather',
            },
          },
          {
            type: 'tool-call-input-streaming-end',
            payload: {
              toolCallId: 'call_result_args',
            },
          },
          {
            type: 'tool-result',
            payload: {
              toolCallId: 'call_result_args',
              toolName: 'weather',
              args: { city: 'Lagos' },
              result: { weather: 'sunny' },
            },
          },
          {
            type: 'text-delta',
            payload: {
              text: 'Done.',
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use the weather tool',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completedToolCall = events.find(
      event => event.type === 'response.output_item.done' && event.item?.type === 'function_call',
    );

    expect(JSON.parse(completedToolCall?.item.arguments)).toEqual({ city: 'Lagos' });
    expect(events.find(event => event.type === 'response.completed')?.response.output).toMatchObject([
      {
        id: 'call_result_args',
        type: 'function_call',
        arguments: JSON.stringify({ city: 'Lagos' }),
      },
      {
        id: 'call_result_args:output',
        type: 'function_call_output',
      },
      {
        type: 'message',
        content: [{ text: 'Done.' }],
      },
    ]);
  });

  it('uses the final tool-call chunk as canonical arguments after partial streamed deltas', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call-input-streaming-start',
            payload: {
              toolCallId: 'call_canonical_args',
              toolName: 'weather',
            },
          },
          {
            type: 'tool-call-delta',
            payload: {
              toolCallId: 'call_canonical_args',
              toolName: 'weather',
              argsTextDelta: '{ "city":',
            },
          },
          {
            type: 'tool-call-input-streaming-end',
            payload: {
              toolCallId: 'call_canonical_args',
            },
          },
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_canonical_args',
              toolName: 'weather',
              args: { city: 'Lagos' },
            },
          },
          createWeatherToolResultChunk({ callId: 'call_canonical_args', weather: 'sunny' }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use canonical tool args',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const argumentsDone = events.find(event => event.type === 'response.function_call_arguments.done');
    const argumentDeltas = events
      .filter(event => event.type === 'response.function_call_arguments.delta')
      .map(event => event.delta)
      .join('');

    expect(argumentsDone).toMatchObject({
      item_id: 'call_canonical_args',
    });
    expect(JSON.parse(argumentsDone?.arguments)).toEqual({ city: 'Lagos' });
    expect(argumentDeltas).toBe(argumentsDone?.arguments);
  });

  it('uses a later canonical tool name for streamed tool calls', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call-input-streaming-start',
            payload: {
              toolCallId: 'call_canonical_name',
              toolName: 'pending_tool_name',
            },
          },
          {
            type: 'tool-call-delta',
            payload: {
              toolCallId: 'call_canonical_name',
              toolName: 'weather',
              argsTextDelta: JSON.stringify({ city: 'Lagos' }),
            },
          },
          {
            type: 'tool-call-input-streaming-end',
            payload: {
              toolCallId: 'call_canonical_name',
            },
          },
          {
            type: 'tool-result',
            payload: {
              toolCallId: 'call_canonical_name',
              result: { weather: 'sunny' },
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use canonical tool name',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const argumentsDone = events.find(event => event.type === 'response.function_call_arguments.done');
    const completedToolCall = events.find(
      event => event.type === 'response.output_item.done' && event.item?.type === 'function_call',
    );

    expect(argumentsDone).toMatchObject({
      item_id: 'call_canonical_name',
      name: 'weather',
    });
    expect(completedToolCall?.item).toMatchObject({
      id: 'call_canonical_name',
      name: 'weather',
      arguments: JSON.stringify({ city: 'Lagos' }),
    });
  });

  it('reconciles late canonical tool-call chunks after an early tool result', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call-input-streaming-start',
            payload: {
              toolCallId: 'call_late_canonical_args',
              toolName: 'weather',
            },
          },
          {
            type: 'tool-call-delta',
            payload: {
              toolCallId: 'call_late_canonical_args',
              toolName: 'weather',
              argsTextDelta: '{ "city":',
            },
          },
          createWeatherToolResultChunk({ callId: 'call_late_canonical_args', weather: 'sunny' }),
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_late_canonical_args',
              toolName: 'weather',
              args: { city: 'Lagos' },
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use canonical tool args after result',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const argumentsDoneIndex = events.findIndex(event => event.type === 'response.function_call_arguments.done');
    const argumentsDone = events[argumentsDoneIndex];
    const completed = events.find(event => event.type === 'response.completed')!;

    expect(argumentsDoneIndex).toBeGreaterThan(-1);
    expect(JSON.parse(argumentsDone?.arguments)).toEqual({ city: 'Lagos' });
    expect(events.slice(argumentsDoneIndex + 1).map(event => event.type)).not.toContain(
      'response.function_call_arguments.delta',
    );
    const completedToolCall = completed.response.output.find(
      (item: Record<string, unknown>) => item.type === 'function_call',
    );
    expect(completedToolCall).toMatchObject({
      id: 'call_late_canonical_args',
      type: 'function_call',
      call_id: 'call_late_canonical_args',
    });
    expect(JSON.parse(completedToolCall?.arguments)).toEqual({ city: 'Lagos' });
  });

  it('keeps already emitted arguments when a late canonical tool-call disagrees', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call-input-streaming-start',
            payload: {
              toolCallId: 'call_late_disagreeing_canonical_args',
              toolName: 'weather',
            },
          },
          {
            type: 'tool-call-delta',
            payload: {
              toolCallId: 'call_late_disagreeing_canonical_args',
              toolName: 'weather',
              argsTextDelta: JSON.stringify({ city: 'Lagos' }),
            },
          },
          createWeatherToolResultChunk({ callId: 'call_late_disagreeing_canonical_args', weather: 'sunny' }),
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_late_disagreeing_canonical_args',
              toolName: 'weather',
              args: { city: 'Paris' },
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use already completed tool args',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const argumentsDone = events.find(event => event.type === 'response.function_call_arguments.done');
    const completed = events.find(event => event.type === 'response.completed')!;
    const completedToolCall = completed.response.output.find(
      (item: Record<string, unknown>) => item.type === 'function_call',
    );

    expect(JSON.parse(argumentsDone?.arguments)).toEqual({ city: 'Lagos' });
    expect(JSON.parse(completedToolCall?.arguments)).toEqual({ city: 'Lagos' });
  });

  it('ignores late argument deltas after a function call is completed', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'Done.',
        chunks: [
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_late_delta',
              toolName: 'weather',
              args: { city: 'Lagos' },
            },
          },
          createWeatherToolResultChunk({ callId: 'call_late_delta', weather: 'sunny' }),
          {
            type: 'tool-call-delta',
            payload: {
              toolCallId: 'call_late_delta',
              toolName: 'weather',
              argsTextDelta: JSON.stringify({ ignored: true }),
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Ignore late tool delta',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const argumentsDoneIndex = events.findIndex(event => event.type === 'response.function_call_arguments.done');
    const completed = events.find(event => event.type === 'response.completed')!;
    const completedToolCall = completed.response.output.find(
      (item: Record<string, unknown>) => item.type === 'function_call',
    );

    expect(argumentsDoneIndex).toBeGreaterThan(-1);
    expect(events.slice(argumentsDoneIndex + 1).map(event => event.type)).not.toContain(
      'response.function_call_arguments.delta',
    );
    expect(JSON.parse(completedToolCall?.arguments)).toEqual({ city: 'Lagos' });
  });

  it('synthesizes a tool call from result chunks that carry tool metadata', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-result',
            payload: {
              toolCallId: 'call_result_only',
              toolName: 'weather',
              args: { city: 'Lagos' },
              result: { weather: 'sunny' },
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use result-only tool chunk',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;

    expect(completed.response.output).toMatchObject([
      {
        id: 'call_result_only',
        type: 'function_call',
        call_id: 'call_result_only',
        name: 'weather',
        arguments: JSON.stringify({ city: 'Lagos' }),
      },
      {
        id: 'call_result_only:output',
        type: 'function_call_output',
        call_id: 'call_result_only',
        output: JSON.stringify({ weather: 'sunny' }),
      },
    ]);
  });

  it('waits for late canonical args after an arg-less early tool result', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-result',
            payload: {
              toolCallId: 'call_argless_result_before_canonical',
              toolName: 'weather',
              result: { weather: 'sunny' },
            },
          },
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_argless_result_before_canonical',
              toolName: 'weather',
              args: { city: 'Lagos' },
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use late canonical args after result',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const completedToolCall = completed.response.output.find(
      (item: Record<string, unknown>) => item.type === 'function_call',
    );

    expect(JSON.parse(completedToolCall?.arguments)).toEqual({ city: 'Lagos' });
    expect(events.find(event => event.type === 'response.function_call_arguments.done')?.arguments).toBe(
      JSON.stringify({ city: 'Lagos' }),
    );
  });

  it('falls back to empty arguments when a deferred tool result never receives canonical args', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call-input-streaming-start',
            payload: {
              toolCallId: 'call_unfinished_args',
              toolName: 'weather',
            },
          },
          {
            type: 'tool-call-delta',
            payload: {
              toolCallId: 'call_unfinished_args',
              toolName: 'weather',
              argsTextDelta: '{ "city":',
            },
          },
          createWeatherToolResultChunk({ callId: 'call_unfinished_args', weather: 'sunny' }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use unfinished tool args',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const argumentsDone = events.find(event => event.type === 'response.function_call_arguments.done');
    const completed = events.find(event => event.type === 'response.completed')!;

    expect(argumentsDone?.arguments).toBe('{}');
    expect(completed.response.output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'call_unfinished_args',
          type: 'function_call',
          arguments: '{}',
        }),
      ]),
    );
  });

  it('defaults final tool-call chunks without args to an empty object', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'Done.',
        chunks: [
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_final_zero_args',
              toolName: 'weather',
            },
          },
          createWeatherToolResultChunk({ callId: 'call_final_zero_args', weather: 'sunny' }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use the zero argument tool',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completedToolCall = events.find(
      event => event.type === 'response.output_item.done' && event.item?.type === 'function_call',
    );

    expect(completedToolCall?.item).toMatchObject({
      id: 'call_final_zero_args',
      type: 'function_call',
      arguments: '{}',
      status: 'completed',
    });
  });

  it('streams tool errors as function call outputs', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call-input-streaming-start',
            payload: {
              toolCallId: 'call_tool_error',
              toolName: 'weather',
            },
          },
          {
            type: 'tool-error',
            payload: {
              toolCallId: 'call_tool_error',
              toolName: 'weather',
              error: 'service unavailable',
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use the failing tool',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completedOutput = events.find(
      event => event.type === 'response.output_item.done' && event.item?.type === 'function_call_output',
    );

    expect(completedOutput?.item).toMatchObject({
      id: 'call_tool_error:output',
      type: 'function_call_output',
      call_id: 'call_tool_error',
      output: JSON.stringify({ error: 'service unavailable' }),
    });
  });

  it('uses streamed tool items as the completed output fallback when db messages are unavailable', async () => {
    const toolTurn = { callId: 'call_stream_fallback', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const storedMessages = await memory.recall({
      threadId: completed.response.conversation_id,
      perPage: false,
    });
    const storedMessagesById = new Map(storedMessages.messages.map(message => [message.id, message] as const));
    const syntheticToolCall = storedMessagesById.get(`${completed.response.id}:tool-call:${toolTurn.callId}`);
    const syntheticToolResult = storedMessagesById.get(`${completed.response.id}:tool-result:${toolTurn.callId}`);
    const syntheticMessage = storedMessagesById.get(completed.response.id);

    expect(completed.response.output).toMatchObject([
      {
        id: 'call_stream_fallback',
        type: 'function_call',
        call_id: 'call_stream_fallback',
        arguments: JSON.stringify({ city: 'Lagos' }),
      },
      {
        id: 'call_stream_fallback:output',
        type: 'function_call_output',
        call_id: 'call_stream_fallback',
        output: JSON.stringify({ weather: 'sunny' }),
      },
      {
        type: 'message',
        content: [{ text: 'The lookup is done.' }],
      },
    ]);
    expect(syntheticToolCall).toBeDefined();
    expect(syntheticToolResult).toBeDefined();
    expect(syntheticMessage).toBeDefined();
    expect(syntheticToolCall!.createdAt.getTime()).toBeLessThan(syntheticToolResult!.createdAt.getTime());
    expect(syntheticToolResult!.createdAt.getTime()).toBeLessThan(syntheticMessage!.createdAt.getTime());

    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    expect(retrieved.output).toMatchObject([
      {
        id: 'call_stream_fallback',
        type: 'function_call',
        call_id: 'call_stream_fallback',
        arguments: JSON.stringify({ city: 'Lagos' }),
      },
      {
        id: 'call_stream_fallback:output',
        type: 'function_call_output',
        call_id: 'call_stream_fallback',
        output: JSON.stringify({ weather: 'sunny' }),
      },
      {
        type: 'message',
        content: [{ text: 'The lookup is done.' }],
      },
    ]);
  });

  it('stores final text when fallback output only contains tool items', async () => {
    const resolvedMessages = await resolveResponseTurnMessagesForStorage({
      result: {
        response: Promise.resolve({ id: 'model-response', dbMessages: [] }),
      } as any,
      responseId: 'resp_tool_only_fallback',
      text: 'The lookup is done.',
      threadContext: {
        resourceId: 'resource-1',
        threadId: 'thread-1',
      },
      fallbackOutputItems: [
        {
          id: 'call_tool_only_fallback',
          type: 'function_call',
          call_id: 'call_tool_only_fallback',
          name: 'weather',
          arguments: JSON.stringify({ city: 'Lagos' }),
          status: 'completed',
        },
        {
          id: 'call_tool_only_fallback:output',
          type: 'function_call_output',
          call_id: 'call_tool_only_fallback',
          output: JSON.stringify({ weather: 'sunny' }),
        },
      ],
    });

    expect(resolvedMessages.map(message => message.id)).toEqual([
      'resp_tool_only_fallback:tool-call:call_tool_only_fallback',
      'resp_tool_only_fallback:tool-result:call_tool_only_fallback',
      'resp_tool_only_fallback',
    ]);
    expect(resolvedMessages.at(-1)?.content.parts).toEqual([
      expect.objectContaining({ type: 'text', text: 'The lookup is done.' }),
    ]);
    expect(resolvedMessages[0]!.createdAt.getTime()).toBeLessThan(resolvedMessages[1]!.createdAt.getTime());
    expect(resolvedMessages[1]!.createdAt.getTime()).toBeLessThan(resolvedMessages[2]!.createdAt.getTime());
  });

  it('orders multiple assistant text messages by fallback output item ids', async () => {
    const fallbackOutputItems = [
      {
        id: 'assistant-first',
        type: 'message' as const,
        role: 'assistant' as const,
        status: 'completed' as const,
        content: [{ type: 'output_text' as const, text: 'First.', annotations: [], logprobs: [] }],
      },
      {
        id: 'assistant-second',
        type: 'message' as const,
        role: 'assistant' as const,
        status: 'completed' as const,
        content: [{ type: 'output_text' as const, text: 'Second.', annotations: [], logprobs: [] }],
      },
    ];
    const resolvedMessages = await resolveResponseTurnMessagesForStorage({
      result: {
        response: Promise.resolve({
          id: 'model-response',
          dbMessages: [
            createDbMessage({
              id: 'assistant-second',
              role: 'assistant',
              createdAt: new Date('2026-03-23T10:59:00.000Z'),
              parts: [{ type: 'text', text: 'Second.' }],
            }),
            createDbMessage({
              id: 'assistant-first',
              role: 'assistant',
              createdAt: new Date('2026-03-23T10:58:00.000Z'),
              parts: [{ type: 'text', text: 'First.' }],
            }),
          ],
        }),
      } as any,
      responseId: 'resp_multi_text_fallback',
      text: 'Second.',
      threadContext: {
        resourceId: 'resource-1',
        threadId: 'thread-1',
      },
      fallbackOutputItems,
    });
    const responseOutput = mapMastraMessagesToResponseOutputItems({
      fallbackOutputItems,
      fallbackText: 'Second.',
      messages: resolvedMessages,
      outputMessageId: 'resp_multi_text_fallback',
      status: 'completed',
    });

    expect(resolvedMessages.map(message => message.id)).toEqual(['assistant-first', 'assistant-second']);
    expect(responseOutput.map(item => item.id)).toEqual(['assistant-first', 'assistant-second']);
  });

  it('preserves malformed streamed tool arguments in fallback storage', async () => {
    const malformedArguments = '{"city":';

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_malformed_args',
              toolName: 'weather',
              args: malformedArguments,
            },
          },
          {
            type: 'tool-result',
            payload: {
              toolCallId: 'call_malformed_args',
              toolName: 'weather',
              result: { weather: 'sunny' },
            },
          },
          {
            type: 'text-delta',
            payload: {
              text: 'Done.',
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check malformed tool args',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const storedMessages = await memory.recall({
      threadId: completed.response.conversation_id,
      perPage: false,
    });
    const syntheticToolCall = storedMessages.messages.find(
      message => message.id === `${completed.response.id}:tool-call:call_malformed_args`,
    );
    const toolInvocation = syntheticToolCall?.content.parts.find(
      part => part.type === 'tool-invocation',
    )?.toolInvocation;

    expect(completed.response.output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'call_malformed_args',
          type: 'function_call',
          arguments: malformedArguments,
        }),
      ]),
    );
    expect(toolInvocation).toMatchObject({
      toolCallId: 'call_malformed_args',
      args: { __raw: malformedArguments },
    });
  });

  it('merges streamed fallback tool items when db messages are partial', async () => {
    const toolTurn = { callId: 'call_partial_db_messages', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'assistant-partial-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup is done.' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    expect(completed.response.output).toMatchObject([
      {
        id: 'call_partial_db_messages',
        type: 'function_call',
        call_id: 'call_partial_db_messages',
      },
      {
        id: 'call_partial_db_messages:output',
        type: 'function_call_output',
        call_id: 'call_partial_db_messages',
      },
      {
        id: completed.response.id,
        type: 'message',
        content: [{ text: 'The lookup is done.' }],
      },
    ]);
    expect(retrieved.output).toMatchObject([
      {
        id: 'call_partial_db_messages',
        type: 'function_call',
        call_id: 'call_partial_db_messages',
      },
      {
        id: 'call_partial_db_messages:output',
        type: 'function_call_output',
        call_id: 'call_partial_db_messages',
      },
      {
        id: completed.response.id,
        type: 'message',
        content: [{ text: 'The lookup is done.' }],
      },
    ]);
  });

  it('does not let a partial assistant text db message suppress completed fallback text', async () => {
    const toolTurn = { callId: 'call_partial_text_db_message', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'assistant-partial-text',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolCallId: toolTurn.callId,
                  toolName: 'weather',
                  args: { city: toolTurn.city },
                },
              },
              { type: 'text', text: 'The lookup' },
            ],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });
    const storedMessages = await memory.recall({
      threadId: completed.response.conversation_id,
      perPage: false,
    });
    const expectedOutput = [
      {
        id: toolTurn.callId,
        type: 'function_call',
        call_id: toolTurn.callId,
        name: 'weather',
        arguments: JSON.stringify({ city: 'Lagos' }),
      },
      {
        id: `${toolTurn.callId}:output`,
        type: 'function_call_output',
        call_id: toolTurn.callId,
        output: JSON.stringify({ weather: 'sunny' }),
      },
      {
        id: completed.response.id,
        type: 'message',
        content: [expect.objectContaining({ text: 'The lookup is done.' })],
      },
    ];

    for (const output of [completed.response.output, retrieved.output]) {
      expect(output).toMatchObject(expectedOutput);
      expect(output).toHaveLength(expectedOutput.length);
    }
    const storedPartialMessage = storedMessages.messages.find(message => message.id === 'assistant-partial-text');
    expect(storedPartialMessage?.content.parts).toEqual([
      expect.objectContaining({
        type: 'tool-invocation',
        toolInvocation: expect.objectContaining({
          toolCallId: toolTurn.callId,
          toolName: 'weather',
          args: { city: toolTurn.city },
        }),
      }),
    ]);
  });

  it('does not duplicate fallback text when persisted assistant text only differs by surrounding whitespace', async () => {
    const toolTurn = { callId: 'call_trimmed_text_db_message', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'assistant-whitespace-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup is done.\n' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    for (const output of [completed.response.output, retrieved.output]) {
      expect(output).toHaveLength(3);
      expect(output.filter(item => item.type === 'message')).toHaveLength(1);
      expect(output).toMatchObject([
        {
          id: toolTurn.callId,
          type: 'function_call',
          call_id: toolTurn.callId,
        },
        {
          id: `${toolTurn.callId}:output`,
          type: 'function_call_output',
          call_id: toolTurn.callId,
        },
        {
          id: completed.response.id,
          type: 'message',
          content: [{ text: 'The lookup is done.\n' }],
        },
      ]);
    }
  });

  it('does not duplicate fallback text for non-prefix assistant text mismatches', async () => {
    const toolTurn = { callId: 'call_mismatched_text_db_message', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'assistant-mismatched-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup is done!' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    for (const output of [completed.response.output, retrieved.output]) {
      expect(output).toHaveLength(3);
      expect(output.filter(item => item.type === 'message')).toHaveLength(1);
      expect(output).toMatchObject([
        {
          id: toolTurn.callId,
          type: 'function_call',
          call_id: toolTurn.callId,
        },
        {
          id: `${toolTurn.callId}:output`,
          type: 'function_call_output',
          call_id: toolTurn.callId,
        },
        {
          id: completed.response.id,
          type: 'message',
          content: [{ text: 'The lookup is done!' }],
        },
      ]);
    }
  });

  it('does not add fallback text when a partial db message precedes a non-prefix text mismatch', async () => {
    const toolTurn = { callId: 'call_partial_then_mismatched_text', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'assistant-partial-before-mismatch',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:58:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup' }],
          }),
          createDbMessage({
            id: 'assistant-mismatched-after-partial',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup is done!' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });
    const storedMessages = await memory.recall({
      threadId: completed.response.conversation_id,
      perPage: false,
    });

    for (const output of [completed.response.output, retrieved.output]) {
      const messageTexts = output.flatMap(item =>
        item.type === 'message' ? [item.content.map(part => part.text).join('')] : [],
      );

      expect(output).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: toolTurn.callId,
            type: 'function_call',
            call_id: toolTurn.callId,
          }),
          expect.objectContaining({
            id: `${toolTurn.callId}:output`,
            type: 'function_call_output',
            call_id: toolTurn.callId,
          }),
        ]),
      );
      expect(messageTexts).toEqual(expect.arrayContaining(['The lookup', 'The lookup is done!']));
      expect(messageTexts).toHaveLength(2);
      expect(messageTexts).not.toContain('The lookup is done.');
    }
    expect(storedMessages.messages.map(message => message.id)).toContain('assistant-partial-before-mismatch');
  });

  it('strips partial assistant text when a later db message already has the completed fallback text', async () => {
    const toolTurn = { callId: 'call_partial_then_final_text', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'assistant-earlier-partial-text',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:58:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup' }],
          }),
          createDbMessage({
            id: 'assistant-later-final-text',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup is done.' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });
    const storedMessages = await memory.recall({
      threadId: completed.response.conversation_id,
      perPage: false,
    });

    for (const output of [completed.response.output, retrieved.output]) {
      expect(output).toHaveLength(3);
      expect(output.filter(item => item.type === 'message')).toHaveLength(1);
      expect(output).toMatchObject([
        {
          id: toolTurn.callId,
          type: 'function_call',
          call_id: toolTurn.callId,
        },
        {
          id: `${toolTurn.callId}:output`,
          type: 'function_call_output',
          call_id: toolTurn.callId,
        },
        {
          id: completed.response.id,
          type: 'message',
          content: [{ text: 'The lookup is done.' }],
        },
      ]);
    }
    expect(storedMessages.messages.map(message => message.id)).not.toContain('assistant-earlier-partial-text');
  });

  it('preserves text-only prefix db messages while storing completed fallback text', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'assistant-partial-text-only',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const storedMessages = await memory.recall({
      threadId: completed.response.conversation_id,
      perPage: false,
    });

    const messageTexts = completed.response.output.flatMap(item =>
      item.type === 'message' ? [item.content.map(part => part.text).join('')] : [],
    );
    expect(messageTexts).toEqual(expect.arrayContaining(['The lookup', 'The lookup is done.']));
    expect(messageTexts).toHaveLength(2);
    expect(storedMessages.messages.map(message => message.id)).toContain('assistant-partial-text-only');

    await DELETE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    const remainingMessages = await memory.recall({
      threadId: completed.response.conversation_id,
      perPage: false,
    });
    expect(remainingMessages.messages.map(message => message.id)).not.toContain('assistant-partial-text-only');
  });

  it('preserves streamed fallback tool calls when db messages only contain tool results', async () => {
    const toolTurn = { callId: 'call_tool_result_only_db_messages', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'tool-result-only',
            role: 'tool',
            type: 'tool-result',
            createdAt: new Date('2026-03-23T10:58:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: toolTurn.callId,
                  toolName: 'weather',
                  result: { weather: toolTurn.weather },
                },
              },
            ],
          }),
          createDbMessage({
            id: 'assistant-result-only-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup is done.' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    for (const output of [completed.response.output, retrieved.output]) {
      expect(output).toMatchObject([
        {
          id: toolTurn.callId,
          type: 'function_call',
          call_id: toolTurn.callId,
          arguments: JSON.stringify({ city: 'Lagos' }),
        },
        {
          id: `${toolTurn.callId}:output`,
          type: 'function_call_output',
          call_id: toolTurn.callId,
          output: JSON.stringify({ weather: 'sunny' }),
        },
        {
          type: 'message',
          content: [{ text: 'The lookup is done.' }],
        },
      ]);
    }
  });

  it('does not let incomplete tool db messages suppress streamed fallback outputs', async () => {
    const toolTurn = { callId: 'call_incomplete_tool_db_message', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'incomplete-tool-result',
            role: 'tool',
            type: 'tool-result',
            createdAt: new Date('2026-03-23T10:58:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: toolTurn.callId,
                  toolName: 'weather',
                },
              },
            ],
          }),
          createDbMessage({
            id: 'assistant-incomplete-tool-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup is done.' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    for (const output of [completed.response.output, retrieved.output]) {
      expect(output).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: `${toolTurn.callId}:output`,
            type: 'function_call_output',
            call_id: toolTurn.callId,
            output: JSON.stringify({ weather: 'sunny' }),
          }),
        ]),
      );
    }
  });

  it('appends a synthetic assistant text message when db messages only contain tool activity', async () => {
    const toolTurn = { callId: 'call_tool_only_db_messages', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: createWeatherToolMessages({ turns: [toolTurn], finalText: '' }).slice(0, 2),
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    expect(completed.response.output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: completed.response.id,
          type: 'message',
          content: [expect.objectContaining({ text: 'The lookup is done.' })],
        }),
      ]),
    );
    expect(retrieved.output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: completed.response.id,
          type: 'message',
          content: [expect.objectContaining({ text: 'The lookup is done.' })],
        }),
      ]),
    );
  });

  it('keeps fallback completed output in streamed output index order when text arrives before tools', async () => {
    const toolTurn = { callId: 'call_after_text', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'Checking first. Done.',
        chunks: [
          {
            type: 'text-delta',
            payload: {
              text: 'Checking first. ',
            },
          },
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'Done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'text-before-tool-result',
            role: 'tool',
            type: 'tool-result',
            createdAt: new Date('2026-03-23T10:58:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: toolTurn.callId,
                  toolName: 'weather',
                  result: { weather: toolTurn.weather },
                },
              },
            ],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const storedMessages = await memory.recall({
      threadId: completed.response.conversation_id,
      perPage: false,
    });
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    expect(completed.response.output).toMatchObject([
      {
        id: completed.response.id,
        type: 'message',
        content: [{ text: 'Checking first. Done.' }],
      },
      {
        id: 'call_after_text',
        type: 'function_call',
        call_id: 'call_after_text',
      },
      {
        id: 'call_after_text:output',
        type: 'function_call_output',
        call_id: 'call_after_text',
      },
    ]);
    expect(storedMessages.messages.map(message => message.id)).toHaveLength(
      new Set(storedMessages.messages.map(message => message.id)).size,
    );
    expect(storedMessages.messages).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: completed.response.id,
          role: 'assistant',
          content: expect.objectContaining({
            parts: expect.arrayContaining([expect.objectContaining({ text: 'Checking first. Done.' })]),
          }),
        }),
        expect.objectContaining({
          id: 'text-before-tool-result',
          role: 'tool',
          type: 'tool-result',
        }),
      ]),
    );
    expect(retrieved.output).toMatchObject([
      {
        id: completed.response.id,
        type: 'message',
        content: [{ text: 'Checking first. Done.' }],
      },
      {
        id: 'call_after_text',
        type: 'function_call',
        call_id: 'call_after_text',
      },
      {
        id: 'call_after_text:output',
        type: 'function_call_output',
        call_id: 'call_after_text',
      },
    ]);
  });

  it('preserves JSON-looking string tool outputs in streamed fallback storage', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_string_output',
              toolName: 'weather',
              args: { city: 'Lagos' },
            },
          },
          {
            type: 'tool-result',
            payload: {
              toolCallId: 'call_string_output',
              toolName: 'weather',
              result: 'null',
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Return a string output',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    expect(completed.response.output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'call_string_output:output',
          type: 'function_call_output',
          output: 'null',
        }),
      ]),
    );
    expect(retrieved.output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'call_string_output:output',
          type: 'function_call_output',
          output: 'null',
        }),
      ]),
    );
  });

  it('preserves primitive tool outputs in streamed response items', async () => {
    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: '',
        chunks: [
          {
            type: 'tool-call',
            payload: {
              toolCallId: 'call_primitive_output',
              toolName: 'weather',
              args: { city: 'Lagos' },
            },
          },
          {
            type: 'tool-result',
            payload: {
              toolCallId: 'call_primitive_output',
              toolName: 'weather',
              result: undefined,
              output: null,
            },
          },
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Return a primitive output',
      store: false,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;

    expect(completed.response.output).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'call_primitive_output:output',
          type: 'function_call_output',
          output: 'null',
        }),
      ]),
    );
  });

  it('does not let arg-less assistant db tool results suppress streamed fallback calls', async () => {
    const toolTurn = { callId: 'call_argless_assistant_db_result', city: 'Lagos', weather: 'sunny' };

    vi.spyOn(toolAgent, 'stream').mockResolvedValue(
      createStreamResultFromChunks({
        text: 'The lookup is done.',
        chunks: [
          ...createWeatherToolCallChunk(toolTurn),
          createWeatherToolResultChunk(toolTurn),
          {
            type: 'text-delta',
            payload: {
              text: 'The lookup is done.',
            },
          },
        ],
        dbMessages: [
          createDbMessage({
            id: 'assistant-argless-tool-result',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:58:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: toolTurn.callId,
                  toolName: 'weather',
                  result: { weather: toolTurn.weather },
                },
              },
            ],
          }),
          createDbMessage({
            id: 'assistant-argless-result-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:59:00.000Z'),
            parts: [{ type: 'text', text: 'The lookup is done.' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Check Lagos',
      store: true,
      stream: true,
    })) as Response;

    const events = (await readSseEvents(response)) as Array<Record<string, any>>;
    const completed = events.find(event => event.type === 'response.completed')!;
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: completed.response.id,
    });

    for (const output of [completed.response.output, retrieved.output]) {
      expect(output).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: toolTurn.callId,
            type: 'function_call',
            call_id: toolTurn.callId,
            arguments: JSON.stringify({ city: 'Lagos' }),
          }),
        ]),
      );
    }
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
        id: 'call_1',
        type: 'function_call',
        call_id: 'call_1',
        name: 'weather',
        arguments: JSON.stringify({ city: 'Lagos' }),
      },
      {
        id: 'call_1:output',
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
          id: 'call_1',
          type: 'function_call',
          call_id: 'call_1',
          name: 'weather',
          arguments: JSON.stringify({ city: 'Lagos' }),
        },
        {
          id: 'call_1:output',
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

  it('preserves persisted zero-argument assistant tool calls without args', async () => {
    vi.spyOn(toolAgent, 'generate').mockResolvedValue(
      createGenerateResult({
        text: 'The zero-argument tool is done.',
        dbMessages: [
          createDbMessage({
            id: 'assistant-zero-arg-tool-call',
            role: 'assistant',
            type: 'tool-call',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolCallId: 'call_zero_arg_persisted',
                  toolName: 'weather',
                },
              },
            ],
          }),
          createDbMessage({
            id: 'tool-zero-arg-result',
            role: 'tool',
            type: 'tool-result',
            createdAt: new Date('2026-03-23T10:00:01.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_zero_arg_persisted',
                  toolName: 'weather',
                  result: { weather: 'sunny' },
                },
              },
            ],
          }),
          createDbMessage({
            id: 'assistant-zero-arg-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:00:02.000Z'),
            parts: [{ type: 'text', text: 'The zero-argument tool is done.' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use the zero argument tool',
      store: true,
      stream: false,
    })) as Response;

    const created = await readJson(response);
    const storedMessages = await memory.recall({ threadId: created.conversation_id, perPage: false });
    const storedMessageIds = storedMessages.messages.map(message => message.id);
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    expect(storedMessageIds).toEqual(
      expect.arrayContaining(['assistant-zero-arg-tool-call', 'tool-zero-arg-result', created.id]),
    );
    expect(storedMessageIds).not.toContain(`${created.id}:tool-call:call_zero_arg_persisted`);

    for (const output of [created.output, retrieved.output]) {
      expect(output).toMatchObject([
        {
          id: 'call_zero_arg_persisted',
          type: 'function_call',
          call_id: 'call_zero_arg_persisted',
          name: 'weather',
          arguments: '{}',
        },
        {
          id: 'call_zero_arg_persisted:output',
          type: 'function_call_output',
          call_id: 'call_zero_arg_persisted',
          output: JSON.stringify({ weather: 'sunny' }),
        },
        {
          id: created.id,
          type: 'message',
          content: [{ text: 'The zero-argument tool is done.' }],
        },
      ]);
    }
  });

  it('normalizes persisted null tool args to an empty object', async () => {
    const output = mapMastraMessagesToResponseOutputItems({
      fallbackText: 'The null-args tool is done.',
      outputMessageId: 'resp_null_args',
      status: 'completed',
      messages: [
        createDbMessage({
          id: 'assistant-null-args-tool-call',
          role: 'assistant',
          type: 'tool-call',
          createdAt: new Date('2026-03-23T10:00:00.000Z'),
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call_null_args',
                toolName: 'weather',
                args: null,
              },
            },
          ],
        }),
        createDbMessage({
          id: 'tool-null-args-result',
          role: 'tool',
          type: 'tool-result',
          createdAt: new Date('2026-03-23T10:00:01.000Z'),
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_null_args',
                toolName: 'weather',
                result: { weather: 'sunny' },
              },
            },
          ],
        }),
        createDbMessage({
          id: 'assistant-null-args-final',
          role: 'assistant',
          createdAt: new Date('2026-03-23T10:00:02.000Z'),
          parts: [{ type: 'text', text: 'The null-args tool is done.' }],
        }),
      ],
    });

    expect(output).toMatchObject([
      {
        id: 'call_null_args',
        type: 'function_call',
        call_id: 'call_null_args',
        name: 'weather',
        arguments: '{}',
      },
      {
        id: 'call_null_args:output',
        type: 'function_call_output',
        call_id: 'call_null_args',
        output: JSON.stringify({ weather: 'sunny' }),
      },
      {
        id: 'resp_null_args',
        type: 'message',
        content: [{ text: 'The null-args tool is done.' }],
      },
    ]);
  });

  it('preserves persisted zero-argument assistant result-state tool calls without args', async () => {
    vi.spyOn(toolAgent, 'generate').mockResolvedValue(
      createGenerateResult({
        text: 'The result-state tool is done.',
        dbMessages: [
          createDbMessage({
            id: 'assistant-zero-arg-result-state',
            role: 'assistant',
            type: 'tool-call',
            createdAt: new Date('2026-03-23T10:00:00.000Z'),
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_zero_arg_result_state',
                  toolName: 'weather',
                  result: { weather: 'sunny' },
                },
              },
            ],
          }),
          createDbMessage({
            id: 'assistant-zero-arg-result-state-final',
            role: 'assistant',
            createdAt: new Date('2026-03-23T10:00:01.000Z'),
            parts: [{ type: 'text', text: 'The result-state tool is done.' }],
          }),
        ],
      }),
    );

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      agent_id: 'tool-agent',
      input: 'Use the zero argument tool',
      store: true,
      stream: false,
    })) as Response;

    const created = await readJson(response);
    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    for (const output of [created.output, retrieved.output]) {
      expect(output).toMatchObject([
        {
          id: 'call_zero_arg_result_state',
          type: 'function_call',
          call_id: 'call_zero_arg_result_state',
          name: 'weather',
          arguments: '{}',
        },
        {
          id: 'call_zero_arg_result_state:output',
          type: 'function_call_output',
          call_id: 'call_zero_arg_result_state',
          output: JSON.stringify({ weather: 'sunny' }),
        },
        {
          id: created.id,
          type: 'message',
          content: [{ text: 'The result-state tool is done.' }],
        },
      ]);
    }
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
