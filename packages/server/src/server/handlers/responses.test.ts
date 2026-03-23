import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { HTTPException } from '../http-exception';
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

function createStreamResult(text: string, providerMetadata?: Record<string, Record<string, unknown> | undefined>) {
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

function mockAgentSpecVersion(agent: Agent, specificationVersion: 'v1' | 'v2' = 'v2') {
  vi.spyOn(agent, 'getModel').mockResolvedValue({ specificationVersion } as never);
}

describe('Responses Handlers', () => {
  let storage: InMemoryStore;
  let memory: MockMemory;
  let agent: Agent;
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

    mastra = new Mastra({
      logger: false,
      storage,
      agents: {
        'test-agent': agent,
      },
    });

    mockAgentSpecVersion(agent);
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

    const retrieved = await GET_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      responseId: created.id,
    });

    expect(retrieved).toEqual(created);
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

  it('returns 400 when store is requested without agent_id', async () => {
    await expect(
      CREATE_RESPONSE_ROUTE.handler({
        ...createTestServerContext({ mastra }),
        model: 'openai/gpt-5',
        input: 'Hello',
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

  it('supports model-only execution without a Mastra agent', async () => {
    const getModelSpy = vi
      .spyOn(Agent.prototype, 'getModel')
      .mockResolvedValue({ specificationVersion: 'v2' } as never);
    const generateSpy = vi
      .spyOn(Agent.prototype, 'generate')
      .mockResolvedValue(createGenerateResult({ text: 'Model only' }));

    const response = (await CREATE_RESPONSE_ROUTE.handler({
      ...createTestServerContext({ mastra }),
      model: 'openai/gpt-5',
      input: 'Hello',
      stream: false,
      store: false,
    })) as Response;

    const created = await readJson(response);
    expect(created).toMatchObject({
      model: 'openai/gpt-5',
      status: 'completed',
      store: false,
      output: [
        {
          content: [{ text: 'Model only' }],
        },
      ],
    });
    expect(generateSpy).toHaveBeenCalled();
    generateSpy.mockRestore();
    getModelSpy.mockRestore();
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
    const generateSpy = vi.spyOn(agent, 'generate').mockResolvedValue(
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
      agent_id: 'test-agent',
      input: 'What is the weather in Lagos?',
      store: true,
      stream: false,
    })) as Response;

    const created = await readJson(response);
    const threadId = (generateSpy.mock.calls[0]?.[1] as { memory?: { thread?: string } })?.memory?.thread;
    const storedMessages = await memory.recall({ threadId: threadId!, perPage: false });

    expect(created.id).toBe(created.output[0].id);
    expect(created.tools).toEqual([
      {
        type: 'tool',
        toolCallId: 'call_1',
        toolName: 'weather',
        state: 'result',
        args: { city: 'Lagos' },
        result: { weather: 'sunny' },
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
          type: 'tool',
          toolCallId: 'call_1',
          toolName: 'weather',
          state: 'result',
          args: { city: 'Lagos' },
          result: { weather: 'sunny' },
        },
      ],
      output: [
        {
          id: created.id,
          content: [{ text: 'The weather is sunny.' }],
        },
      ],
    });
  });

  it('deletes all persisted messages for a tool-backed turn', async () => {
    vi.spyOn(agent, 'generate').mockResolvedValue(
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
      agent_id: 'test-agent',
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
});
