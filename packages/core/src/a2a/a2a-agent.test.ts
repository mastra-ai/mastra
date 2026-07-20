import type { AgentCard, Message, Task } from '@a2a-js/sdk';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { SubAgent } from '../agent';
import { Agent } from '../agent';
import { RequestContext } from '../request-context';

import { A2AAgent } from './a2a-agent';

type StreamEventWithOptionalId = {
  type: string;
  runId?: string;
  from?: string;
  payload?: {
    id?: string;
  };
};

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

const baseCard: AgentCard = {
  name: 'Remote Agent',
  description: 'A remote agent',
  url: 'https://remote.example.com/a2a/remote',
  version: '1.0',
  protocolVersion: '0.3.0',
  skills: [],
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
    extensions: [],
  },
  security: [],
  securitySchemes: {},
  additionalInterfaces: [],
  supportsAuthenticatedExtendedCard: false,
};

function jsonRpcResult(result: unknown) {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      result,
    }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
      },
    },
  );
}

function createTask(overrides: Partial<Task> = {}): Task {
  return {
    kind: 'task',
    id: 'task-1',
    contextId: 'ctx-1',
    status: {
      state: 'working',
      timestamp: new Date().toISOString(),
    },
    history: [],
    artifacts: [],
    ...overrides,
  } as Task;
}

function createMessage(text: string): Message {
  return {
    kind: 'message',
    role: 'agent',
    messageId: 'message-1',
    parts: [{ kind: 'text', text }],
  } as Message;
}

function createParentModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop',
      usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      text: 'ok',
      content: [{ type: 'text', text: 'ok' }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.close();
        },
      }),
    }),
  });
}

function createFetchMock(
  responses: Array<Response | ((input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>)>,
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const next = responses.shift();
    if (!next) {
      throw new Error('Unexpected fetch call');
    }

    if (typeof next === 'function') {
      return await next(input, init);
    }

    return next;
  });

  return fetchMock;
}

function createSseResponse(events: unknown[]) {
  const encoder = new TextEncoder();
  return new Response(
    new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ result: event })}\n\n`));
        }
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    {
      status: 200,
      headers: {
        'content-type': 'text/event-stream',
      },
    },
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('A2AAgent', () => {
  it('is assignable as a SubAgent and retains injected memory', async () => {
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
    });

    expectTypeOf(agent).toExtend<SubAgent>();
    expect(agent.hasOwnMemory()).toBe(false);

    const memory = {} as any;
    agent.__setMemory(memory);

    expect(agent.hasOwnMemory()).toBe(true);
    await expect(agent.getMemory()).resolves.toBe(memory);
  });

  it('caches the fetched agent card in memory', async () => {
    const fetchMock = createFetchMock([new Response(JSON.stringify(baseCard), { status: 200 })]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const first = await agent.getAgentCard();
    const second = await agent.getAgentCard();

    expect(first).toEqual(baseCard);
    expect(second).toEqual(baseCard);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://remote.example.com/.well-known/agent-card.json',
      expect.any(Object),
    );
  });

  it('uses an explicit agent-card URL as-is', async () => {
    const fetchMock = createFetchMock([new Response(JSON.stringify(baseCard), { status: 200 })]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com/.well-known/concierge/agent-card.json',
      fetch: fetchMock as typeof fetch,
    });

    await agent.getAgentCard();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://remote.example.com/.well-known/concierge/agent-card.json',
      expect.any(Object),
    );
  });

  it('optionally verifies the fetched agent card during bootstrap', async () => {
    const verify = vi.fn();
    const fetchMock = createFetchMock([new Response(JSON.stringify(baseCard), { status: 200 })]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
      verifyAgentCard: { verify },
    });

    await agent.getAgentCard();

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith(
      baseCard,
      expect.objectContaining({ cardUrl: 'https://remote.example.com/.well-known/agent-card.json' }),
    );
  });

  it('can be registered on a parent agent and executed through the generated subagent tool', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify({ ...baseCard, capabilities: { ...baseCard.capabilities, streaming: false } }), {
        status: 200,
      }),
      (input, init) => {
        expect(String(input)).toBe('https://remote.example.com/a2a/remote');
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.method).toBe('message/send');
        return jsonRpcResult(createMessage('Remote subagent response'));
      },
    ]);

    const remote = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const parent = new Agent({
      id: 'parent-agent',
      name: 'Parent Agent',
      instructions: 'Delegate to subagents when needed.',
      model: createParentModel(),
      agents: {
        remote,
      },
    });

    const tools = await parent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'generate',
    });

    const agentTool = tools['agent-remote'];
    expect(agentTool).toBeDefined();

    const result = await agentTool.execute!({ prompt: 'Do the remote thing' }, {
      toolCallId: 'call-1',
      messages: [],
    } as any);

    expect(result.text).toBe('Remote subagent response');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('streams through the generated subagent tool when the parent agent uses stream mode', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      (input, init) => {
        expect(String(input)).toBe('https://remote.example.com/a2a/remote');
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.method).toBe('message/stream');
        return createSseResponse([
          createTask(),
          {
            kind: 'artifact-update',
            taskId: 'task-1',
            contextId: 'ctx-1',
            lastChunk: true,
            artifact: {
              artifactId: 'response:text',
              name: 'response.txt',
              parts: [{ kind: 'text', text: 'Hello from remote stream' }],
            },
          },
          {
            kind: 'status-update',
            taskId: 'task-1',
            contextId: 'ctx-1',
            final: true,
            status: {
              state: 'completed',
              timestamp: new Date().toISOString(),
            },
          },
        ]);
      },
    ]);

    const remote = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const parent = new Agent({
      id: 'parent-agent',
      name: 'Parent Agent',
      instructions: 'Delegate to subagents when needed.',
      model: createParentModel(),
      agents: {
        remote,
      },
    });

    const tools = await parent['convertTools']({
      requestContext: new RequestContext(),
      methodType: 'stream',
    });

    const agentTool = tools['agent-remote'];
    const result = await agentTool.execute!({ prompt: 'Stream the remote thing' }, {
      toolCallId: 'call-2',
      messages: [],
    } as any);

    expect(result.text).toBe('Hello from remote stream');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('waits for a non-stream task to complete in generate()', async () => {
    const workingTask = createTask();
    const completedTask = createTask({
      status: {
        state: 'completed',
        timestamp: new Date().toISOString(),
      },
      artifacts: [
        {
          artifactId: 'response:text',
          name: 'response.txt',
          parts: [{ kind: 'text', text: 'Remote task complete' }],
        },
      ],
    });

    const fetchMock = createFetchMock([
      new Response(JSON.stringify({ ...baseCard, capabilities: { ...baseCard.capabilities, streaming: false } }), {
        status: 200,
      }),
      jsonRpcResult(workingTask),
      jsonRpcResult(completedTask),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
      backoffMs: 0,
      maxBackoffMs: 0,
    });

    const output = await agent.generate('Do the thing');

    expect(output.text).toBe('Remote task complete');
    expect(output.task?.status.state).toBe('completed');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('uses message/send for generate even when remote streaming is supported', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      (input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.method).toBe('message/send');
        return jsonRpcResult(createMessage('Generate path response'));
      },
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const output = await agent.generate('Use the generate path');

    expect(output.text).toBe('Generate path response');
    expect(output.message?.kind).toBe('message');
  });

  it('preserves subagent memory identifiers on returned assistant messages', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      jsonRpcResult(createMessage('Generate path response')),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const output = await agent.generate('Use the generate path', {
      memory: {
        thread: 'subagent-thread-1',
        resource: 'subagent-resource-1',
      },
    });

    expect(output.messages).toHaveLength(1);
    expect(output.messages[0]?.threadId).toBe('subagent-thread-1');
    expect(output.messages[0]?.resourceId).toBe('subagent-resource-1');
  });

  it('uses cached run state in resumeGenerate() and sends a follow-up message with context/reference task ids', async () => {
    const inputRequiredTask = createTask({
      id: 'task-input',
      contextId: 'ctx-input',
      status: {
        state: 'input-required',
        timestamp: new Date().toISOString(),
        message: {
          kind: 'message',
          role: 'agent',
          messageId: 'm-input',
          parts: [{ kind: 'text', text: 'Please provide more info' }],
        } as Message,
      },
    });

    const fetchMock = createFetchMock([
      new Response(JSON.stringify({ ...baseCard, capabilities: { ...baseCard.capabilities, streaming: false } }), {
        status: 200,
      }),
      jsonRpcResult(inputRequiredTask),
      (input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.method).toBe('message/send');
        expect(body.params.message.contextId).toBe('ctx-input');
        expect(body.params.message.referenceTaskIds).toEqual(['task-input']);
        expect(body.params.message.parts[0].text).toContain('user follow-up');
        return jsonRpcResult(createMessage('Follow-up complete'));
      },
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
      backoffMs: 0,
      maxBackoffMs: 0,
    });

    const initial = await agent.generate('Initial task', { runId: 'run-1' });
    expect(initial.resumePayload).toMatchObject({
      taskId: 'task-input',
      contextId: 'ctx-input',
      waitingForInput: true,
    });

    const resumed = await agent.resumeGenerate({ note: 'user follow-up' }, { runId: 'run-1' });
    expect(resumed.text).toBe('Follow-up complete');
    expect(resumed.message?.kind).toBe('message');
  });

  it('falls back to generate() when remote streaming is unsupported', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify({ ...baseCard, capabilities: { ...baseCard.capabilities, streaming: false } }), {
        status: 200,
      }),
      jsonRpcResult(createMessage('Buffered remote response')),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const stream = await agent.stream('Buffered request');
    const events: StreamEventWithOptionalId[] = [];
    for await (const event of stream.fullStream) {
      events.push(event as StreamEventWithOptionalId);
    }

    expect(events.map(event => event.type)).toEqual(['start', 'text-start', 'text-delta', 'text-end', 'finish']);
    expect(events.every(event => event.runId === stream.runId)).toBe(true);
    expect(events.every(event => event.from === 'AGENT')).toBe(true);
    expect(events[0]?.payload?.id).toBe(agent.id);
    expect(events[1]?.payload?.id).toBe('message-1');
    expect(events[2]?.payload?.id).toBe('message-1');
    expect(events[3]?.payload?.id).toBe('message-1');
    expect(events[4]?.payload).toMatchObject({
      stepResult: { reason: 'stop' },
      output: { usage: {} },
      metadata: {},
      messages: { all: [], user: [], nonUser: [] },
      finishReason: 'stop',
      usage: {},
    });
    expect(await stream.text).toBe('Buffered remote response');
    const result = await stream.getResult();
    expect(result.text).toBe('Buffered remote response');
    expect(result.runId).toBe(stream.runId);
  });

  it('consumes remote message/stream events when streaming is supported', async () => {
    const streamTask = createTask();
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      createSseResponse([
        streamTask,
        {
          kind: 'artifact-update',
          taskId: 'task-1',
          contextId: 'ctx-1',
          lastChunk: true,
          artifact: {
            artifactId: 'response:text',
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'Hello from stream' }],
          },
        },
        {
          kind: 'status-update',
          taskId: 'task-1',
          contextId: 'ctx-1',
          final: true,
          status: {
            state: 'completed',
            timestamp: new Date().toISOString(),
          },
        },
      ]),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const stream = await agent.stream('Hello stream', { runId: 'stream-run-2' });
    const events: StreamEventWithOptionalId[] = [];
    for await (const event of stream.fullStream) {
      events.push(event as StreamEventWithOptionalId);
    }

    expect(events.map(event => event.type)).toEqual(['start', 'text-start', 'text-delta', 'text-end', 'finish']);
    expect(events.every(event => event.runId === 'stream-run-2')).toBe(true);
    expect(events.every(event => event.from === 'AGENT')).toBe(true);
    expect(events[0]?.payload?.id).toBe(agent.id);
    expect(events[1]?.payload?.id).toBe('response:text');
    expect(events[2]?.payload?.id).toBe('response:text');
    expect(events[3]?.payload?.id).toBe('response:text');
    expect(events[4]?.payload).toMatchObject({
      stepResult: { reason: 'stop' },
      output: { usage: {} },
      metadata: {},
      messages: { all: [], user: [], nonUser: [] },
      finishReason: 'stop',
      usage: {},
    });
    expect(await stream.text).toBe('Hello from stream');
    expect((await stream.task)?.status.state).toBe('completed');
  });

  it('returns a live stream result before the remote SSE completes', async () => {
    const streamTask = createTask();
    const finalChunkEnqueued = createDeferred<'sse-completed'>();
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            void (async () => {
              await new Promise(resolve => setTimeout(resolve, 25));
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ result: streamTask })}\n\n`));
              await new Promise(resolve => setTimeout(resolve, 25));
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({
                    result: {
                      kind: 'artifact-update',
                      taskId: 'task-1',
                      contextId: 'ctx-1',
                      lastChunk: true,
                      artifact: {
                        artifactId: 'response:text',
                        name: 'response.txt',
                        parts: [{ kind: 'text', text: 'Hello later' }],
                      },
                    },
                  })}\n\n`,
                ),
              );
              finalChunkEnqueued.resolve('sse-completed');
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
            })();
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
          },
        },
      ),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const streamPromise = agent.stream('Live stream please', { runId: 'stream-run-live' });
    const winner = await Promise.race([
      streamPromise.then(() => 'stream-resolved' as const),
      finalChunkEnqueued.promise,
    ]);

    expect(winner).toBe('stream-resolved');

    const stream = await streamPromise;

    const events: string[] = [];
    for await (const event of stream.fullStream) {
      events.push(event.type);
    }

    expect(events).toEqual(['start', 'text-start', 'text-delta', 'text-end', 'tool-call-suspended']);
    expect(await stream.text).toBe('Hello later');
    expect(await stream.suspendPayload).toMatchObject({
      taskId: 'task-1',
      waitingForInput: false,
    });
  });

  it('skips malformed SSE frames and continues processing later valid events', async () => {
    const streamTask = createTask();
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            const encoder = new TextEncoder();
            controller.enqueue(encoder.encode('data: {"result":\n\n'));
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ result: streamTask })}\n\n`));
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  result: {
                    kind: 'artifact-update',
                    taskId: 'task-1',
                    contextId: 'ctx-1',
                    lastChunk: true,
                    artifact: {
                      artifactId: 'response:text',
                      name: 'response.txt',
                      parts: [{ kind: 'text', text: 'Recovered text' }],
                    },
                  },
                })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: {
            'content-type': 'text/event-stream',
          },
        },
      ),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const stream = await agent.stream('Recover after malformed frame', { runId: 'stream-run-malformed' });

    expect(await stream.text).toBe('Recovered text');
    expect((await stream.task)?.status.state).toBe('working');
  });

  it('concatenates streamed artifact text chunks without inserting newlines', async () => {
    const streamTask = createTask();
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      createSseResponse([
        streamTask,
        {
          kind: 'artifact-update',
          taskId: 'task-1',
          contextId: 'ctx-1',
          lastChunk: false,
          artifact: {
            artifactId: 'response:text',
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'Hello' }],
          },
        },
        {
          kind: 'artifact-update',
          taskId: 'task-1',
          contextId: 'ctx-1',
          lastChunk: true,
          artifact: {
            artifactId: 'response:text',
            name: 'response.txt',
            parts: [{ kind: 'text', text: ' world' }],
          },
        },
      ]),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const stream = await agent.stream('Chunked stream', { runId: 'stream-run-chunked' });

    expect(await stream.text).toBe('Hello world');
  });

  it('does not retry non-transient 4xx request failures', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      new Response(JSON.stringify({ error: 'bad request' }), { status: 400 }),
      jsonRpcResult(createMessage('should not retry')),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
      retries: 2,
    });

    await expect(agent.generate('Do not retry 400')).rejects.toMatchObject({
      name: 'MastraA2AError',
      data: {
        status: 400,
      },
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not mix task progress status text into the final streamed text', async () => {
    const streamTask = createTask({
      status: {
        state: 'working',
        timestamp: new Date().toISOString(),
        message: createMessage('Generating response...'),
      },
    });
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      createSseResponse([
        streamTask,
        {
          kind: 'artifact-update',
          taskId: 'task-1',
          contextId: 'ctx-1',
          lastChunk: true,
          artifact: {
            artifactId: 'response:text',
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'Final answer' }],
          },
        },
      ]),
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const stream = await agent.stream('Progressy stream', { runId: 'stream-run-progress' });

    expect(await stream.text).toBe('Final answer');
  });

  it('uses tasks/resubscribe when resuming a non-terminal remote stream', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      createSseResponse([createTask({ status: { state: 'working', timestamp: new Date().toISOString() } })]),
      (input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.method).toBe('tasks/resubscribe');
        expect(body.params.id).toBe('task-1');

        return createSseResponse([
          {
            kind: 'artifact-update',
            taskId: 'task-1',
            contextId: 'ctx-1',
            lastChunk: true,
            artifact: {
              artifactId: 'response:text',
              name: 'response.txt',
              parts: [{ kind: 'text', text: 'Resubscribed text' }],
            },
          },
          {
            kind: 'status-update',
            taskId: 'task-1',
            contextId: 'ctx-1',
            final: true,
            status: {
              state: 'completed',
              timestamp: new Date().toISOString(),
            },
          },
        ]);
      },
    ]);

    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
    });

    const initial = await agent.stream('Start remote work', { runId: 'stream-run-3' });
    expect(await initial.suspendPayload).toMatchObject({
      taskId: 'task-1',
      waitingForInput: false,
    });

    const resumed = await agent.resumeStream(undefined, { runId: 'stream-run-3' });
    const resumedEvents: string[] = [];
    for await (const event of resumed.fullStream) {
      resumedEvents.push(event.type);
    }

    // Resumed runs continue an existing stream, so no `start` chunk is emitted
    // (mirrors the regular Agent loop, which skips `start` when resuming).
    expect(resumedEvents).toEqual(['text-start', 'text-delta', 'text-end', 'finish']);
    expect(await resumed.text).toBe('Resubscribed text');
    expect((await resumed.task)?.status.state).toBe('completed');
  });
});
