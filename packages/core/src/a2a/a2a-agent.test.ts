import type { AgentCard, Message, Task } from '@a2a-js/sdk-v0_3';
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

const v1Card = {
  name: 'Remote Agent',
  description: 'A remote agent',
  supportedInterfaces: [
    {
      url: 'https://remote.example.com/a2a/remote',
      protocolBinding: 'JSONRPC',
      protocolVersion: '1.0',
    },
  ],
  version: '1.0',
  skills: [],
  defaultInputModes: ['text/plain'],
  defaultOutputModes: ['text/plain'],
  capabilities: {
    streaming: true,
    pushNotifications: false,
    stateTransitionHistory: false,
    extensions: [],
  },
  securityRequirements: [],
  securitySchemes: {},
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

describe('A2AAgent auto negotiation', () => {
  it.each([406, 400, 200])(
    'retries discovery without a version header after version rejection (HTTP %s)',
    async status => {
      const fetchMock = createFetchMock([
        (_input, init) => {
          expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
          return new Response(
            JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32009, message: 'Version not supported' } }),
            { status },
          );
        },
        (_input, init) => {
          const headers = new Headers(init?.headers);
          expect(headers.has('A2A-Version')).toBe(false);
          expect(headers.get('authorization')).toBe('Bearer test');
          return Response.json(baseCard);
        },
        (input, init) => {
          expect(String(input)).toBe(baseCard.url);
          expect(new Headers(init?.headers).has('A2A-Version')).toBe(false);
          expect(JSON.parse(String(init?.body))).toMatchObject({
            method: 'message/send',
            params: { message: { role: 'user', kind: 'message' } },
          });
          return jsonRpcResult(createMessage('legacy response'));
        },
      ]);
      const agent = new A2AAgent({
        url: 'https://remote.example.com',
        protocolVersion: 'auto',
        headers: { 'a2a-VERSION': '9.0', authorization: 'Bearer test' },
        fetch: fetchMock as typeof fetch,
      });
      expect((await agent.generate('hello')).text).toBe('legacy response');
      expect(fetchMock).toHaveBeenCalledTimes(3);
    },
  );

  it.each([401, 403, 400, 500])('does not fall back on HTTP %s discovery failures', async status => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify({ error: { code: -32600, message: 'Failure' } }), { status }),
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      retries: 0,
      fetch: fetchMock as typeof fetch,
    });
    await expect(agent.generate('hello')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]?.method).toBe('GET');
  });

  it('does not fall back on network failure', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Network failed'));
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      retries: 0,
      fetch: fetchMock,
    });
    await expect(agent.generate('hello')).rejects.toThrow('Network failed');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { supportedInterfaces: [] },
    { supportedInterfaces: [{ protocolVersion: '2.0', protocolBinding: 'JSONRPC', url: baseCard.url }] },
  ])(
    'rejects incompatible advertised interfaces without fallback or execution (%j)',
    async ({ supportedInterfaces }) => {
      const fetchMock = createFetchMock([Response.json({ ...baseCard, supportedInterfaces })]);
      const agent = new A2AAgent({
        url: 'https://remote.example.com',
        protocolVersion: 'auto',
        fetch: fetchMock as typeof fetch,
      });
      await expect(agent.generate('hello')).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it.each([false, true])('prefers v1 JSONRPC regardless of interface order (reversed: %s)', async reverse => {
    const interfaces = [
      { protocolBinding: 'JSONRPC', protocolVersion: '0.3', url: 'https://remote.example.com/legacy' },
      ...v1Card.supportedInterfaces,
    ];
    const fetchMock = createFetchMock([
      Response.json({ ...v1Card, supportedInterfaces: reverse ? interfaces.reverse() : interfaces }),
      (input, init) => {
        expect(String(input)).toBe(v1Card.supportedInterfaces[0]!.url);
        expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
        expect(JSON.parse(String(init?.body)).method).toBe('SendMessage');
        return jsonRpcResult({ message: { messageId: 'dual', role: 'ROLE_AGENT', parts: [{ text: 'v1 selected' }] } });
      },
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      fetch: fetchMock as typeof fetch,
    });
    expect((await agent.generate('hello')).text).toBe('v1 selected');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('uses advertised v0.3 endpoint and clears conflicting headers without a second discovery', async () => {
    const fetchMock = createFetchMock([
      Response.json({
        ...v1Card,
        supportedInterfaces: [
          { protocolBinding: 'JSONRPC', protocolVersion: '0.3', url: 'https://remote.example.com/legacy' },
        ],
      }),
      (input, init) => {
        expect(String(input)).toBe('https://remote.example.com/legacy');
        const headers = new Headers(init?.headers);
        expect(headers.has('A2A-Version')).toBe(false);
        expect(headers.get('x-custom')).toBe('preserved');
        expect(JSON.parse(String(init?.body))).toMatchObject({
          method: 'message/send',
          params: { message: { role: 'user', kind: 'message' } },
        });
        return jsonRpcResult(createMessage('advertised legacy'));
      },
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      headers: { 'A2A-VERSION': '1.0', 'x-custom': 'preserved' },
      fetch: fetchMock as typeof fetch,
    });
    expect((await agent.generate('hello')).text).toBe('advertised legacy');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('caches verified negotiation and retains the snapshot after a failed refresh', async () => {
    const verify = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('Untrusted card'));
    const fetchMock = createFetchMock([
      Response.json(v1Card),
      Response.json(baseCard),
      (input, init) => {
        expect(String(input)).toBe(v1Card.supportedInterfaces[0]!.url);
        expect(JSON.parse(String(init?.body)).method).toBe('SendMessage');
        expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
        return jsonRpcResult({ message: { messageId: 'cached', role: 'ROLE_AGENT', parts: [{ text: 'cached v1' }] } });
      },
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      verifyAgentCard: { verify },
      fetch: fetchMock as typeof fetch,
    });
    const card = await agent.getAgentCard();
    expect(await agent.getAgentCard()).toBe(card);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(agent.getAgentCard({ forceRefresh: true })).rejects.toThrow('Untrusted card');
    expect(await agent.getAgentCard()).toBe(card);
    expect((await agent.generate('hello')).text).toBe('cached v1');
    expect(verify).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never retries an execution request under another protocol', async () => {
    const fetchMock = createFetchMock([
      Response.json(v1Card),
      new Response(JSON.stringify({ error: { code: -32009, message: 'Version not supported' } }), { status: 406 }),
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      retries: 0,
      fetch: fetchMock as typeof fetch,
    });
    await expect(agent.generate('hello')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe('POST');
  });

  it('polls an auto-negotiated v1 task with v1 methods and codecs', async () => {
    const fetchMock = createFetchMock([
      Response.json(v1Card),
      jsonRpcResult({ task: { id: 'poll-task', contextId: 'poll-context', status: { state: 'TASK_STATE_WORKING' } } }),
      (input, init) => {
        expect(String(input)).toBe(baseCard.url);
        expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
        expect(JSON.parse(String(init?.body))).toMatchObject({ method: 'GetTask', params: { id: 'poll-task' } });
        return jsonRpcResult({
          id: 'poll-task',
          contextId: 'poll-context',
          status: { state: 'TASK_STATE_COMPLETED' },
          artifacts: [{ artifactId: 'poll-result', parts: [{ text: 'polled v1' }] }],
        });
      },
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      fetch: fetchMock as typeof fetch,
    });
    expect((await agent.generate('hello')).text).toBe('polled v1');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it.each(['generate', 'stream'] as const)(
    'resumes an input-required v1 task via %s after refresh without switching endpoint or codec',
    async resumeMode => {
      const fetchMock = createFetchMock([
        Response.json(v1Card),
        jsonRpcResult({
          task: { id: 'input-task', contextId: 'input-context', status: { state: 'TASK_STATE_INPUT_REQUIRED' } },
        }),
        Response.json({ ...baseCard, url: 'https://remote.example.com/new-legacy' }),
        (input, init) => {
          expect(String(input)).toBe(baseCard.url);
          expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
          expect(JSON.parse(String(init?.body))).toMatchObject({
            method: resumeMode === 'generate' ? 'SendMessage' : 'SendStreamingMessage',
            params: { message: { role: 'ROLE_USER', taskId: 'input-task', contextId: 'input-context' } },
          });
          const message = { messageId: 'input-result', role: 'ROLE_AGENT', parts: [{ text: 'resumed input' }] };
          return resumeMode === 'generate' ? jsonRpcResult({ message }) : createSseResponse([{ message }]);
        },
      ]);
      const agent = new A2AAgent({
        url: 'https://remote.example.com',
        protocolVersion: 'auto',
        fetch: fetchMock as typeof fetch,
      });
      const initial = await agent.generate('hello', { runId: 'input-run' });
      expect(initial.suspendPayload).toMatchObject({ taskId: 'input-task', waitingForInput: true });
      await agent.getAgentCard({ forceRefresh: true });
      const resumed =
        resumeMode === 'generate'
          ? await agent.resumeGenerate('answer', { runId: 'input-run' })
          : await agent.resumeStream('answer', { runId: 'input-run' });
      expect(await resumed.text).toBe('resumed input');
      expect(fetchMock).toHaveBeenCalledTimes(4);
    },
  );

  it('does not let an older discovery overwrite a completed refresh', async () => {
    const discoveryStarted = createDeferred<void>();
    const discoveryResponse = createDeferred<Response>();
    const refreshedCard = { ...baseCard, url: 'https://remote.example.com/refreshed' };
    const fetchMock = createFetchMock([
      () => {
        discoveryStarted.resolve();
        return discoveryResponse.promise;
      },
      Response.json(refreshedCard),
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      fetch: fetchMock as typeof fetch,
    });
    const discovery = agent.getAgentCard();
    await discoveryStarted.promise;
    expect(await agent.getAgentCard({ forceRefresh: true })).toEqual(refreshedCard);
    discoveryResponse.resolve(Response.json(v1Card));
    expect((await discovery).protocolVersion).toBe('1.0');
    expect(await agent.getAgentCard()).toEqual(refreshedCard);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not cache a card rejected by the verifier', async () => {
    const verify = vi.fn().mockRejectedValueOnce(new Error('Untrusted card')).mockResolvedValueOnce(undefined);
    const fetchMock = createFetchMock([Response.json(v1Card), Response.json(baseCard)]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion: 'auto',
      verifyAgentCard: { verify },
      fetch: fetchMock as typeof fetch,
    });
    await expect(agent.getAgentCard()).rejects.toThrow('Untrusted card');
    expect(await agent.getAgentCard()).toEqual(baseCard);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it.each(['generate', 'stream'] as const)(
    'keeps active v1 stream and resume%s on their original snapshot across a deferred refresh',
    async resumeMode => {
      const streamRequested = createDeferred<void>();
      const streamResponse = createDeferred<Response>();
      const refreshedCard = { ...baseCard, url: 'https://remote.example.com/new-legacy' };
      const fetchMock = createFetchMock([
        Response.json(v1Card),
        (input, init) => {
          expect(String(input)).toBe(baseCard.url);
          expect(JSON.parse(String(init?.body)).method).toBe('SendStreamingMessage');
          streamRequested.resolve();
          return streamResponse.promise;
        },
        Response.json(refreshedCard),
        (input, init) => {
          expect(String(input)).toBe(baseCard.url);
          expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
          expect(JSON.parse(String(init?.body))).toMatchObject({
            method: resumeMode === 'generate' ? 'GetTask' : 'SubscribeToTask',
            params: { id: 'old-task' },
          });
          const task = {
            id: 'old-task',
            contextId: 'old-context',
            status: { state: 'TASK_STATE_COMPLETED' },
            artifacts: [{ artifactId: 'result', parts: [{ text: 'original v1' }] }],
          };
          return resumeMode === 'generate' ? jsonRpcResult(task) : createSseResponse([{ task }]);
        },
        (input, init) => {
          expect(String(input)).toBe(refreshedCard.url);
          expect(new Headers(init?.headers).has('A2A-Version')).toBe(false);
          expect(JSON.parse(String(init?.body))).toMatchObject({
            method: 'message/send',
            params: { message: { kind: 'message', role: 'user' } },
          });
          return jsonRpcResult(createMessage('new v0.3'));
        },
      ]);
      const agent = new A2AAgent({
        url: 'https://remote.example.com',
        protocolVersion: 'auto',
        fetch: fetchMock as typeof fetch,
      });
      const initialPromise = agent.stream('start', { runId: 'old-run' });
      await streamRequested.promise;
      expect((await agent.getAgentCard({ forceRefresh: true })).url).toBe(refreshedCard.url);
      streamResponse.resolve(
        createSseResponse([
          { task: { id: 'old-task', contextId: 'old-context', status: { state: 'TASK_STATE_WORKING' } } },
        ]),
      );
      const initial = await initialPromise;
      const events: string[] = [];
      for await (const event of initial.fullStream) {
        events.push(event.type);
      }
      expect(events).toEqual(['start', 'tool-call-suspended']);
      expect(await initial.suspendPayload).toMatchObject({ taskId: 'old-task', waitingForInput: false });
      const resumed =
        resumeMode === 'generate'
          ? await agent.resumeGenerate(undefined, { runId: 'old-run' })
          : await agent.resumeStream(undefined, { runId: 'old-run' });
      expect(await resumed.text).toBe('original v1');
      expect((await resumed.task)?.status.state).toBe('completed');
      expect((await agent.generate('new run')).text).toBe('new v0.3');
      expect(fetchMock).toHaveBeenCalledTimes(5);
    },
  );
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

  it('uses cached run state in resumeGenerate() and continues with context and task ids', async () => {
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
        expect(body.params.message.taskId).toBe('task-input');
        expect(body.params.message).not.toHaveProperty('referenceTaskIds');
        expect(body.params.message.parts[0].text).toContain('user follow-up');
        // Structured resume data also travels as a data part (spec-idiomatic carrier).
        expect(body.params.message.parts[1]).toEqual({ kind: 'data', data: { note: 'user follow-up' } });
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

  it('surfaces auth-required as a resumable interruption instead of polling', async () => {
    const authRequiredTask = createTask({
      id: 'task-auth',
      status: {
        state: 'auth-required',
        timestamp: new Date().toISOString(),
        message: {
          kind: 'message',
          role: 'agent',
          messageId: 'm-auth',
          parts: [{ kind: 'text', text: 'Authentication required' }],
        } as Message,
      },
    });
    const fetchMock = createFetchMock([
      new Response(JSON.stringify({ ...baseCard, capabilities: { ...baseCard.capabilities, streaming: false } }), {
        status: 200,
      }),
      jsonRpcResult(authRequiredTask),
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      fetch: fetchMock as typeof fetch,
      backoffMs: 0,
      maxBackoffMs: 0,
    });

    const result = await agent.generate('Authenticate', { runId: 'run-auth' });

    expect(result.finishReason).toBe('suspended');
    expect(result.resumePayload).toMatchObject({ taskId: 'task-auth', waitingForInput: true });
    expect(result.task?.status.state).toBe('auth-required');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('continues an input-required task over message/stream with the task id when resuming', async () => {
    const inputRequiredStreamTask = createTask({
      id: 'task-stream-input',
      contextId: 'ctx-stream-input',
      status: {
        state: 'input-required',
        timestamp: new Date().toISOString(),
        message: {
          kind: 'message',
          role: 'agent',
          messageId: 'm-stream-input',
          parts: [{ kind: 'text', text: 'Which city?' }],
        } as Message,
      },
    });

    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      createSseResponse([inputRequiredStreamTask]),
      (input, init) => {
        const body = JSON.parse(String(init?.body ?? '{}'));
        expect(body.method).toBe('message/stream');
        expect(body.params.message.contextId).toBe('ctx-stream-input');
        expect(body.params.message.taskId).toBe('task-stream-input');
        expect(body.params.message).not.toHaveProperty('referenceTaskIds');
        expect(body.params.message.parts[0].text).toContain('Paris');
        // Structured resume data also travels as a data part (spec-idiomatic carrier).
        expect(body.params.message.parts[1]).toEqual({ kind: 'data', data: { city: 'Paris' } });

        return createSseResponse([
          createTask({ id: 'task-stream-input', contextId: 'ctx-stream-input' }),
          {
            kind: 'status-update',
            taskId: 'task-stream-input',
            contextId: 'ctx-stream-input',
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

    const initial = await agent.stream('Book a flight', { runId: 'stream-run-hitl' });
    expect(await initial.suspendPayload).toMatchObject({
      taskId: 'task-stream-input',
      waitingForInput: true,
    });

    const resumed = await agent.resumeStream({ city: 'Paris' }, { runId: 'stream-run-hitl' });
    expect((await resumed.task)?.status.state).toBe('completed');
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
          append: false,
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
          append: true,
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
    expect((await stream.task)?.artifacts).toEqual([
      {
        artifactId: 'response:text',
        name: 'response.txt',
        parts: [
          { kind: 'text', text: 'Hello' },
          { kind: 'text', text: ' world' },
        ],
      },
    ]);
  });

  it('replaces streamed artifact text when append is false', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      createSseResponse([
        createTask(),
        {
          kind: 'artifact-update',
          taskId: 'task-1',
          contextId: 'ctx-1',
          append: false,
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
          append: false,
          lastChunk: true,
          artifact: {
            artifactId: 'response:text',
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'Goodbye' }],
          },
        },
      ]),
    ]);
    const agent = new A2AAgent({ url: 'https://remote.example.com', fetch: fetchMock as typeof fetch });

    const stream = await agent.stream('Replace artifact', { runId: 'stream-run-replace' });

    expect(await stream.text).toBe('Goodbye');
    expect((await stream.task)?.artifacts).toMatchObject([
      {
        artifactId: 'response:text',
        parts: [{ kind: 'text', text: 'Goodbye' }],
      },
    ]);
  });

  it('throws the remote JSON-RPC error returned with HTTP 200', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify({ ...baseCard, capabilities: { ...baseCard.capabilities, streaming: false } }), {
        status: 200,
      }),
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          error: { code: -32001, message: 'Task not found', data: { taskId: 'missing' } },
        }),
        { status: 200 },
      ),
    ]);
    const agent = new A2AAgent({ url: 'https://remote.example.com', fetch: fetchMock as typeof fetch });

    await expect(agent.generate('Continue missing task')).rejects.toMatchObject({
      code: -32001,
      message: 'Task not found',
      data: { taskId: 'missing' },
    });
  });

  it('accepts a JSON-RPC success response with a null error field', async () => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify({ ...baseCard, capabilities: { ...baseCard.capabilities, streaming: false } }), {
        status: 200,
      }),
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          result: createMessage('Successful response'),
          error: null,
        }),
        { status: 200 },
      ),
    ]);
    const agent = new A2AAgent({ url: 'https://remote.example.com', fetch: fetchMock as typeof fetch });

    await expect(agent.generate('Accept null error')).resolves.toMatchObject({ text: 'Successful response' });
  });

  it('throws JSON-RPC errors received through SSE', async () => {
    const encoder = new TextEncoder();
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(baseCard), { status: 200 }),
      new Response(
        new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  jsonrpc: '2.0',
                  id: '1',
                  error: { code: -32006, message: 'Invalid agent response' },
                })}\n\n`,
              ),
            );
            controller.close();
          },
        }),
        { status: 200, headers: { 'content-type': 'text/event-stream' } },
      ),
    ]);
    const agent = new A2AAgent({ url: 'https://remote.example.com', fetch: fetchMock as typeof fetch });
    const stream = await agent.stream('Stream error');
    const resultPromises = [stream.text, stream.task, stream.suspendPayload, stream.resumeSchema, stream.getResult()];

    await expect(async () => {
      for await (const _chunk of stream.fullStream) {
        // Consume the stream so protocol errors surface to callers.
      }
    }).rejects.toMatchObject({ code: -32006, message: 'Invalid agent response' });
    const settled = await Promise.allSettled(resultPromises);
    expect(settled).toHaveLength(5);
    expect(settled.every(result => result.status === 'rejected' && result.reason.code === -32006)).toBe(true);
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

  it.each(['1.0', 'auto'] as const)(
    'delegates to a v1-only remote using v1 headers and wire messages (%s)',
    async protocolVersion => {
      const fetchMock = createFetchMock([
        (input, init) => {
          expect(input.toString()).toBe('https://remote.example.com/.well-known/agent-card.json');
          expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
          return new Response(JSON.stringify(v1Card), { status: 200 });
        },
        (_input, init) => {
          expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
          const request = JSON.parse(String(init?.body));
          expect(request.method).toBe('SendMessage');
          expect(request.params.message).toMatchObject({ role: 'ROLE_USER' });
          expect(request.params.message).not.toHaveProperty('kind');
          return jsonRpcResult({
            message: {
              messageId: 'v1-message-1',
              role: 'ROLE_AGENT',
              parts: [{ text: 'V1 delegation complete' }],
            },
          });
        },
      ]);
      const agent = new A2AAgent({
        url: 'https://remote.example.com',
        protocolVersion,
        headers: { 'a2a-version': '0.3' },
        fetch: fetchMock as typeof fetch,
      });

      const output = await agent.generate('Use A2A v1');

      expect(output.text).toBe('V1 delegation complete');
      expect(output.message?.role).toBe('agent');
    },
  );

  it.each(['1.0', 'auto'] as const)('uses GetTask when resuming a non-terminal v1 task (%s)', async protocolVersion => {
    const fetchMock = createFetchMock([
      new Response(JSON.stringify(v1Card), { status: 200 }),
      createSseResponse([
        {
          task: {
            id: 'v1-task-1',
            contextId: 'v1-context-1',
            status: { state: 'TASK_STATE_WORKING' },
          },
        },
      ]),
      (_input, init) => {
        const request = JSON.parse(String(init?.body));
        expect(request.method).toBe('GetTask');
        expect(request.method).not.toBe('tasks/get');
        expect(request.params.id).toBe('v1-task-1');
        return jsonRpcResult({
          id: 'v1-task-1',
          contextId: 'v1-context-1',
          status: { state: 'TASK_STATE_COMPLETED' },
          artifacts: [{ artifactId: 'v1-artifact-1', parts: [{ text: 'V1 resumed result' }] }],
        });
      },
    ]);
    const agent = new A2AAgent({
      url: 'https://remote.example.com',
      protocolVersion,
      fetch: fetchMock as typeof fetch,
    });

    const initial = await agent.stream('Start v1 work', { runId: 'v1-generate-resume' });
    expect(await initial.suspendPayload).toMatchObject({ taskId: 'v1-task-1', waitingForInput: false });

    const resumed = await agent.resumeGenerate(undefined, { runId: 'v1-generate-resume' });

    expect(resumed.text).toBe('V1 resumed result');
    expect(resumed.task?.status.state).toBe('completed');
  });

  it.each(['1.0', 'auto'] as const)(
    'uses SubscribeToTask when resuming a non-terminal v1 stream (%s)',
    async protocolVersion => {
      const fetchMock = createFetchMock([
        new Response(JSON.stringify(v1Card), { status: 200 }),
        createSseResponse([
          {
            task: {
              id: 'v1-task-1',
              contextId: 'v1-context-1',
              status: { state: 'TASK_STATE_WORKING' },
            },
          },
        ]),
        (_input, init) => {
          const request = JSON.parse(String(init?.body));
          expect(request.method).toBe('SubscribeToTask');
          expect(request.method).not.toBe('tasks/resubscribe');
          expect(request.params.id).toBe('v1-task-1');
          return createSseResponse([
            {
              artifactUpdate: {
                taskId: 'v1-task-1',
                contextId: 'v1-context-1',
                artifact: { artifactId: 'v1-artifact-1', parts: [{ text: 'V1 resubscribed result' }] },
                append: false,
                lastChunk: true,
              },
            },
            {
              statusUpdate: {
                taskId: 'v1-task-1',
                contextId: 'v1-context-1',
                status: { state: 'TASK_STATE_COMPLETED' },
              },
            },
          ]);
        },
      ]);
      const agent = new A2AAgent({
        url: 'https://remote.example.com',
        protocolVersion,
        fetch: fetchMock as typeof fetch,
      });

      const initial = await agent.stream('Start v1 stream', { runId: 'v1-stream-resume' });
      expect(await initial.suspendPayload).toMatchObject({ taskId: 'v1-task-1', waitingForInput: false });

      const resumed = await agent.resumeStream(undefined, { runId: 'v1-stream-resume' });

      expect(await resumed.text).toBe('V1 resubscribed result');
      expect((await resumed.task)?.status.state).toBe('completed');
    },
  );

  it.each(['1.0', 'auto'] as const)(
    'decodes v1 streaming task, artifact, and status payloads (%s)',
    async protocolVersion => {
      const fetchMock = createFetchMock([
        new Response(JSON.stringify(v1Card), { status: 200 }),
        (_input, init) => {
          expect(new Headers(init?.headers).get('A2A-Version')).toBe('1.0');
          const request = JSON.parse(String(init?.body));
          expect(request.method).toBe('SendStreamingMessage');
          return createSseResponse([
            {
              task: {
                id: 'v1-task-1',
                contextId: 'v1-context-1',
                status: { state: 'TASK_STATE_WORKING' },
              },
            },
            {
              artifactUpdate: {
                taskId: 'v1-task-1',
                contextId: 'v1-context-1',
                artifact: { artifactId: 'v1-artifact-1', parts: [{ text: 'V1 streamed ' }] },
                append: false,
                lastChunk: false,
              },
            },
            {
              artifactUpdate: {
                taskId: 'v1-task-1',
                contextId: 'v1-context-1',
                artifact: { artifactId: 'v1-artifact-1', parts: [{ text: 'text' }] },
                append: true,
                lastChunk: true,
              },
            },
            {
              statusUpdate: {
                taskId: 'v1-task-1',
                contextId: 'v1-context-1',
                status: { state: 'TASK_STATE_COMPLETED' },
              },
            },
          ]);
        },
      ]);
      const agent = new A2AAgent({
        url: 'https://remote.example.com',
        protocolVersion,
        fetch: fetchMock as typeof fetch,
      });

      const output = await agent.stream('Stream over A2A v1');
      const eventTypes: string[] = [];
      for await (const event of output.fullStream) {
        eventTypes.push(event.type);
      }

      expect(eventTypes).toEqual(['start', 'text-start', 'text-delta', 'text-delta', 'text-end', 'finish']);
      expect(await output.text).toBe('V1 streamed text');
      expect(await output.task).toMatchObject({
        status: { state: 'completed' },
        artifacts: [
          {
            artifactId: 'v1-artifact-1',
            parts: [
              { kind: 'text', text: 'V1 streamed ' },
              { kind: 'text', text: 'text' },
            ],
          },
        ],
      });
    },
  );
});
