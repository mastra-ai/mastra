import * as crypto from 'node:crypto';
import { openai } from '@ai-sdk/openai';
import type { Task, MessageSendParams } from '@mastra/core/a2a';
import { MastraA2AError } from '@mastra/core/a2a';
import type { AgentConfig } from '@mastra/core/agent';
import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import type { MastraStorage } from '@mastra/core/storage';
import canonicalize from 'canonicalize';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSuccessResponse } from '../a2a/protocol';
import { DefaultPushNotificationSender, DEFAULT_PUSH_NOTIFICATION_TOKEN_HEADER } from '../a2a/push-notification-sender';
import { InMemoryPushNotificationStore } from '../a2a/push-notification-store';
import { InMemoryTaskStore } from '../a2a/store';
import {
  AGENT_EXECUTION_ROUTE,
  GET_AGENT_CARD_ROUTE,
  getAgentCardByIdHandler,
  getAgentExecutionHandler,
  handleTaskGet,
  handleTaskList,
  handleMessageSend,
  handleMessageStream,
  handleTaskCancel,
  handleTaskResubscribe,
  resolveA2AProtocolVersion,
} from './a2a';

class MockAgent extends Agent {
  constructor(config: AgentConfig) {
    super(config);

    this.generate = vi.fn();
    this.stream = vi.fn();
    this.__updateInstructions = vi.fn();
  }

  generate(args: any) {
    return this.generate(args);
  }

  stream(args: any) {
    return this.stream(args);
  }

  __updateInstructions(args: any) {
    return this.__updateInstructions(args);
  }
}

function createMockMastra(agents: Record<string, Agent>) {
  return new Mastra({
    logger: false,
    agents: agents,
    storage: {
      init: vi.fn(),
      __setLogger: vi.fn(),
      getEvalsByAgentName: vi.fn(),
      getStorage: () => {
        return {
          getEvalsByAgentName: vi.fn(),
        };
      },
    } as unknown as MastraStorage,
  });
}

function createStreamResult({
  chunks,
  text,
  object,
  streamEvents,
  toolCalls = [],
  toolResults = [],
  usage = undefined,
  finishReason = 'stop',
}: {
  chunks: string[];
  text?: string;
  object?: Record<string, unknown>;
  streamEvents?: unknown[];
  toolCalls?: unknown[];
  toolResults?: unknown[];
  usage?: unknown;
  finishReason?: string;
}) {
  const fullStreamEvents = streamEvents ?? [
    ...chunks.map(chunk => ({ type: 'text-delta', textDelta: chunk })),
    ...(object ? [{ type: 'object-result', object }] : []),
  ];

  // Mirrors MastraModelOutput: `suspendPayload`/`resumeSchema` resolve with the
  // first suspension chunk's payload when the run suspends.
  const suspensionEvent = fullStreamEvents.find(
    (event): event is { type: string; payload?: { resumeSchema?: unknown } } =>
      typeof event === 'object' &&
      event !== null &&
      'type' in event &&
      ((event as { type: string }).type === 'tool-call-suspended' ||
        (event as { type: string }).type === 'tool-call-approval'),
  );

  return {
    suspendPayload: Promise.resolve(suspensionEvent?.payload),
    resumeSchema: Promise.resolve(suspensionEvent?.payload?.resumeSchema),
    textStream: (async function* () {
      for (const chunk of chunks) {
        yield chunk;
      }
    })(),
    fullStream: (async function* () {
      for (const event of fullStreamEvents) {
        yield event;
      }
    })(),
    text: Promise.resolve(text ?? chunks.join('')),
    object: Promise.resolve(object),
    toolCalls: Promise.resolve(toolCalls),
    toolResults: Promise.resolve(toolResults),
    usage: Promise.resolve(usage),
    finishReason: Promise.resolve(finishReason),
  };
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

async function seedTask(
  taskStore: InMemoryTaskStore,
  taskId: string,
  contextId = crypto.randomUUID(),
  state: Task['status']['state'] = 'submitted',
) {
  await taskStore.save({
    agentId: 'test-agent',
    data: {
      id: taskId,
      contextId,
      status: { state, timestamp: new Date().toISOString() },
      artifacts: [],
      history: [],
      kind: 'task',
    },
  });
}

describe('A2A Handler', () => {
  it('creates a JSON-RPC success response for request ID zero', () => {
    expect(createSuccessResponse(0, { ok: true })).toEqual({
      jsonrpc: '2.0',
      id: 0,
      result: { ok: true },
    });
  });

  describe('getAgentCardByIdHandler', () => {
    let mockMastra: Mastra;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });

      mockMastra = createMockMastra({
        'test-agent': mockAgent,
      });
    });

    it('should return the agent card', async () => {
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
        agentId: 'test-agent',
      });
      expect(agentCard).toMatchInlineSnapshot(`
        {
          "additionalInterfaces": [],
          "capabilities": {
            "extensions": [],
            "pushNotifications": false,
            "stateTransitionHistory": false,
            "streaming": true,
          },
          "defaultInputModes": [
            "text/plain",
          ],
          "defaultOutputModes": [
            "text/plain",
          ],
          "description": "test instructions",
          "name": "test-agent",
          "protocolVersion": "0.3.0",
          "provider": {
            "organization": "Mastra",
            "url": "https://mastra.ai",
          },
          "security": [],
          "securitySchemes": {},
          "skills": [],
          "supportsAuthenticatedExtendedCard": false,
          "url": "/a2a/test-agent",
          "version": "1.0",
        }
      `);
    });

    it('should allow custom execution URL', async () => {
      const customUrl = '/custom/execution/url';
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
        agentId: 'test-agent',
        executionUrl: customUrl,
      });
      expect(agentCard.url).toBe(customUrl);
    });

    it('should allow custom provider details', async () => {
      const customProvider = {
        organization: 'Custom Org',
        url: 'https://custom.org',
      };
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
        agentId: 'test-agent',
        provider: customProvider,
      });
      expect(agentCard.provider).toEqual(customProvider);
    });

    it('should allow custom version', async () => {
      const customVersion = '2.0';
      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
        agentId: 'test-agent',
        version: customVersion,
      });
      expect(agentCard.version).toBe(customVersion);
    });

    it('should build an absolute execution url when request context is available', async () => {
      const response = await GET_AGENT_CARD_ROUTE.handler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
        agentId: 'test-agent',
        abortSignal: AbortSignal.abort(),
        routePrefix: '/api',
        request: new Request('http://localhost:4111/api/.well-known/test-agent/agent-card.json', {
          headers: {
            host: 'localhost:4111',
          },
        }),
      } as any);

      expect(response.url).toBe('http://localhost:4111/api/a2a/test-agent');
      expect(response.capabilities.pushNotifications).toBe(true);
    });

    it('should sign the agent card when A2A signing is configured', async () => {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
        namedCurve: 'P-256',
      });
      const privateJwk = privateKey.export({ format: 'jwk' });
      mockMastra.setServer({
        a2a: {
          agentCardSigning: {
            privateKey: privateJwk,
            protectedHeader: {
              alg: 'ES256',
              kid: 'test-key',
            },
            header: {
              issuer: 'mastra-test',
            },
          },
        },
      } as any);

      const agentCard = await getAgentCardByIdHandler({
        mastra: mockMastra,
        requestContext: new RequestContext(),
        agentId: 'test-agent',
      });

      expect(agentCard.signatures).toHaveLength(1);

      const [signature] = agentCard.signatures!;
      const unsignedCard = structuredClone(agentCard) as typeof agentCard & {
        signatures?: typeof agentCard.signatures;
      };
      delete unsignedCard.signatures;
      const canonicalPayload = canonicalize(unsignedCard);

      expect(canonicalPayload).toBeTruthy();

      const signingInput = `${signature.protected}.${Buffer.from(canonicalPayload!, 'utf8').toString('base64url')}`;
      const verification = crypto.verify(
        'sha256',
        Buffer.from(signingInput, 'utf8'),
        {
          key: publicKey,
          dsaEncoding: 'ieee-p1363',
        },
        Buffer.from(signature.signature, 'base64url'),
      );

      expect(verification).toBe(true);
      expect(JSON.parse(Buffer.from(signature.protected, 'base64url').toString('utf8'))).toMatchObject({
        alg: 'ES256',
        kid: 'test-key',
      });
      expect(signature.header).toEqual({
        issuer: 'mastra-test',
      });
    });
  });

  describe('handleMessageSend', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      vi.useFakeTimers();
      const mockAgent = new MockAgent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });

      mockMastra = createMockMastra({
        'test-agent': mockAgent,
      });

      mockTaskStore = new InMemoryTaskStore();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should successfully process a task and save it', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = {
        generate: vi.fn().mockResolvedValue({ text: agentResponseText }),
      } as unknown as Agent;

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));
      const requestContext = new RequestContext();
      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [
            {
              artifactId: expect.stringContaining(':response'),
              name: 'response.txt',
              parts: [
                {
                  text: 'Hello, user!',
                  kind: 'text',
                },
              ],
            },
          ],
          id: expect.any(String),
          contextId: expect.any(String),
          metadata: {
            execution: {
              toolCalls: undefined,
              toolResults: undefined,
              usage: undefined,
              finishReason: undefined,
            },
          },
          status: {
            message: undefined,
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          history: [
            {
              kind: 'message',
              messageId: 'test-message-id',
              parts: [
                {
                  text: 'Hello, agent!',
                  kind: 'text',
                },
              ],
              role: 'user',
            },
          ],
          kind: 'task',
        },
      });
    });

    it('rejects a message that references an unknown task', async () => {
      const taskId = 'unknown-task-id';
      const mockAgent = { generate: vi.fn() } as unknown as Agent;

      await expect(
        handleMessageSend({
          requestId: 'unknown-task-request',
          params: {
            message: {
              messageId: 'unknown-task-message',
              taskId,
              kind: 'message',
              role: 'user',
              parts: [{ kind: 'text', text: 'Continue' }],
            },
          },
          taskStore: mockTaskStore,
          agent: mockAgent,
          agentId: 'test-agent',
          requestContext: new RequestContext(),
        }),
      ).rejects.toThrow(MastraA2AError.taskNotFound(taskId));
      expect(mockAgent.generate).not.toHaveBeenCalled();
    });

    it.each(['completed', 'failed', 'canceled', 'rejected'] as const)(
      'does not restart a task in the %s terminal state',
      async state => {
        const taskId = `terminal-${state}`;
        await seedTask(mockTaskStore, taskId, 'terminal-context', state);
        const mockAgent = { generate: vi.fn() } as unknown as Agent;

        await expect(
          handleMessageSend({
            requestId: `terminal-${state}-request`,
            params: {
              message: {
                messageId: `terminal-${state}-message`,
                taskId,
                kind: 'message',
                role: 'user',
                parts: [{ kind: 'text', text: 'Restart' }],
              },
            },
            taskStore: mockTaskStore,
            agent: mockAgent,
            agentId: 'test-agent',
            requestContext: new RequestContext(),
          }),
        ).rejects.toMatchObject({ code: -32600 });
        expect((await mockTaskStore.load({ agentId: 'test-agent', taskId }))?.status.state).toBe(state);
        expect(mockAgent.generate).not.toHaveBeenCalled();
      },
    );

    it('should return a working task before non-blocking execution completes', async () => {
      const taskId = 'non-blocking-task-id';
      const contextId = 'non-blocking-context-id';
      const generation = createDeferred<{ text: string }>();
      const mockAgent = {
        generate: vi.fn().mockReturnValue(generation.promise),
      } as unknown as Agent;
      const params: MessageSendParams = {
        message: {
          messageId: 'non-blocking-message-id',
          taskId,
          contextId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Run this in the background' }],
        },
        configuration: { blocking: false },
      };
      const requestContext = new RequestContext();
      await seedTask(mockTaskStore, taskId, contextId);

      const responsePromise = handleMessageSend({
        requestId: 'non-blocking-request-id',
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId: 'test-agent',
        requestContext,
      });
      let returned = false;
      void responsePromise.then(() => {
        returned = true;
      });

      await vi.advanceTimersByTimeAsync(0);

      expect(returned).toBe(true);
      const response = await responsePromise;
      expect(response.result).toMatchObject({
        id: taskId,
        contextId,
        status: { state: 'working' },
      });
      expect(mockAgent.generate).toHaveBeenCalledWith(expect.any(Array), {
        runId: taskId,
        requestContext,
        threadId: contextId,
        resourceId: 'test-agent',
      });
      expect((await mockTaskStore.load({ agentId: 'test-agent', taskId }))?.status.state).toBe('working');

      generation.resolve({ text: 'Background result' });

      await vi.waitFor(async () => {
        expect(
          await handleTaskGet({
            requestId: 'get-completed-task',
            taskStore: mockTaskStore,
            agentId: 'test-agent',
            taskId,
          }),
        ).toMatchObject({
          result: {
            id: taskId,
            contextId,
            status: { state: 'completed' },
            artifacts: [{ parts: [{ kind: 'text', text: 'Background result' }] }],
          },
        });
      });
    });

    it('should return an existing working task without starting duplicate non-blocking execution', async () => {
      const taskId = 'duplicate-non-blocking-task-id';
      const generation = createDeferred<{ text: string }>();
      const mockAgent = {
        generate: vi.fn().mockReturnValue(generation.promise),
      } as unknown as Agent;
      await seedTask(mockTaskStore, taskId);

      const firstResponse = await handleMessageSend({
        requestId: 'first-non-blocking-request-id',
        params: {
          message: {
            messageId: 'first-non-blocking-message-id',
            taskId,
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Run once' }],
          },
          configuration: { blocking: false },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
      });

      const duplicateResponse = await handleMessageSend({
        requestId: 'duplicate-non-blocking-request-id',
        params: {
          message: {
            messageId: 'duplicate-non-blocking-message-id',
            taskId,
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Run again' }],
          },
          configuration: { blocking: false },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
      });

      expect(firstResponse.result?.status.state).toBe('working');
      expect(duplicateResponse.result).toEqual(firstResponse.result);
      expect(mockAgent.generate).toHaveBeenCalledTimes(1);
      expect((await mockTaskStore.load({ agentId: 'test-agent', taskId }))?.history).toHaveLength(1);

      generation.resolve({ text: 'Completed once' });
      await vi.waitFor(async () => {
        expect(await mockTaskStore.load({ agentId: 'test-agent', taskId })).toMatchObject({
          status: { state: 'completed' },
        });
      });
    });

    it('should persist non-blocking execution failures after returning', async () => {
      const taskId = 'failed-background-task-id';
      const generation = createDeferred<{ text: string }>();
      const mockAgent = {
        generate: vi.fn().mockReturnValue(generation.promise),
      } as unknown as Agent;
      await seedTask(mockTaskStore, taskId);

      const response = await handleMessageSend({
        requestId: 'failed-background-request-id',
        params: {
          message: {
            messageId: 'failed-background-message-id',
            taskId,
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Fail later' }],
          },
          configuration: { blocking: false },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
      });

      expect(response.result?.status.state).toBe('working');
      generation.reject(new Error('Background failure'));

      await vi.waitFor(async () => {
        expect(await mockTaskStore.load({ agentId: 'test-agent', taskId })).toMatchObject({
          status: {
            state: 'failed',
            message: {
              parts: [{ kind: 'text', text: 'Handler failed: Background failure' }],
            },
          },
        });
      });
    });

    it('should not overwrite a canceled non-blocking task when execution finishes', async () => {
      const taskId = 'canceled-background-task-id';
      const generation = createDeferred<{ text: string }>();
      const mockAgent = {
        generate: vi.fn().mockReturnValue(generation.promise),
      } as unknown as Agent;
      const save = vi.spyOn(mockTaskStore, 'save');
      await seedTask(mockTaskStore, taskId);

      await handleMessageSend({
        requestId: 'canceled-background-request-id',
        params: {
          message: {
            messageId: 'canceled-background-message-id',
            taskId,
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Cancel me' }],
          },
          configuration: { blocking: false },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
      });

      await handleTaskCancel({
        requestId: 'cancel-request-id',
        taskStore: mockTaskStore,
        agentId: 'test-agent',
        taskId,
      });
      generation.resolve({ text: 'Too late' });
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(0);

      expect((await mockTaskStore.load({ agentId: 'test-agent', taskId }))?.status.state).toBe('canceled');
      expect(save.mock.calls.some(([{ data }]) => data.status.state === 'completed')).toBe(false);
    });

    it('should wait for execution when blocking is true', async () => {
      const generation = createDeferred<{ text: string }>();
      const mockAgent = {
        generate: vi.fn().mockReturnValue(generation.promise),
      } as unknown as Agent;
      const responsePromise = handleMessageSend({
        requestId: 'blocking-request-id',
        params: {
          message: {
            messageId: 'blocking-message-id',
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Wait for me' }],
          },
          configuration: { blocking: true },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
      });
      let returned = false;
      void responsePromise.then(() => {
        returned = true;
      });

      await vi.advanceTimersByTimeAsync(0);
      expect(returned).toBe(false);

      generation.resolve({ text: 'Blocking result' });
      await expect(responsePromise).resolves.toMatchObject({
        result: {
          status: { state: 'completed' },
          artifacts: [{ parts: [{ kind: 'text', text: 'Blocking result' }] }],
        },
      });
    });

    it('should accept file parts (FileWithUri + FileWithBytes) and pass them through to the converter', async () => {
      // Regression test for the handler-level schema rejecting non-text parts.
      // Pre-fix, params.message.parts was validated as `kind: z.enum(['text'])`
      // which rejected `kind: 'file'` and `kind: 'data'` before convertToCoreMessage
      // (which already handles all three) could see them.
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [
            { kind: 'text', text: 'Please summarize the attached invoice.' },
            {
              kind: 'file',
              file: { uri: 'https://example.com/invoice.pdf', mimeType: 'application/pdf', name: 'invoice.pdf' },
            },
            { kind: 'file', file: { bytes: 'AAAA', mimeType: 'image/png', name: 'screenshot.png' } },
          ],
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: 'Summary attached.' });

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      // Validation passes — no JSON-RPC error returned.
      expect('error' in result).toBe(false);

      // convertToCoreMessage forwarded the file parts as CoreMessage `file` parts.
      const generateArgs = (mockAgent.generate as ReturnType<typeof vi.fn>).mock.calls[0];
      const coreMessages = generateArgs[0] as Array<{ role: string; content: Array<unknown> }>;
      expect(coreMessages).toHaveLength(1);
      expect(coreMessages[0].role).toBe('user');
      expect(coreMessages[0].content).toEqual([
        { type: 'text', text: 'Please summarize the attached invoice.' },
        { type: 'file', data: new URL('https://example.com/invoice.pdf'), mimeType: 'application/pdf' },
        { type: 'file', data: 'AAAA', mimeType: 'image/png' },
      ]);
    });

    it('should reject parts with an unknown discriminator', async () => {
      // The widened schema is still strict on the part kind — discriminatedUnion
      // rejects anything other than text | file | data, matching the @a2a-js/sdk
      // Part union exactly.
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const params = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'bogus', text: 'nope' }],
        },
      } as unknown as MessageSendParams;

      const result = await getAgentExecutionHandler({
        requestId,
        mastra: mockMastra,
        method: 'message/send',
        params,
        taskStore: mockTaskStore,
        agentId,
        requestContext: new RequestContext(),
      });

      expect('error' in result).toBe(true);
      // -32602 is the JSON-RPC "invalid params" code that MastraA2AError.invalidParams produces.
      // @ts-expect-error - error is present in the failure branch
      expect(result.error.code).toBe(-32602);
    });

    it('should handle errors from agent.generate and save failed state', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const errorMessage = 'Agent failed!';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockRejectedValue is not available on the Agent class
      mockAgent.generate.mockRejectedValue(new Error(errorMessage));
      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      // Because the a2a spec requires the server to create the the taskId, we don't know the id
      // to query the store with, so we just check the internal store directly
      const store = Array.from((mockTaskStore as any).store.values());
      expect(store.length).toBe(1);

      const task = store[0] as Task;
      expect(task?.status.state).toBe('failed');
      // @ts-expect-error - error is not always available but we know it is
      result.error.data.stack = result.error?.data.stack.split('\n')[0];
      expect(result).toMatchInlineSnapshot(`
        {
          "error": {
            "code": -32603,
            "data": {
              "stack": "Error: Agent failed!",
            },
            "message": "Agent failed!",
          },
          "id": "test-request-id",
          "jsonrpc": "2.0",
        }
      `);
    });

    it('should pass contextId as threadId and agentId as resourceId to agent.generate for memory', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId, // Include contextId to test memory integration
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with threadId and resourceId (defaults to agentId)
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: agentId,
        }),
      );
    });

    it('should include structured output as a data artifact part', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Summarize this order';
      const structured = {
        summary: 'Order confirmed.',
        total: 33.98,
      };

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: 'Order confirmed.', object: structured });

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));
      const requestContext = new RequestContext();
      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      expect(result.result.artifacts).toEqual([
        {
          artifactId: expect.stringContaining(':response'),
          name: 'response.json',
          parts: [
            { kind: 'text', text: 'Order confirmed.' },
            { kind: 'data', data: structured },
          ],
        },
      ]);
    });

    it('should allow user to pass resourceId via params metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const customResourceId = 'custom-user-resource';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
        },
        metadata: {
          resourceId: customResourceId, // User-provided resourceId
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with user-provided resourceId
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: customResourceId,
        }),
      );
    });

    it('should allow user to pass resourceId via message metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const customResourceId = 'custom-message-resource';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
          metadata: {
            resourceId: customResourceId, // User-provided resourceId in message
          },
        },
      };

      const mockAgent = {
        generate: vi.fn().mockResolvedValue({ text: agentResponseText }),
      } as unknown as Agent;

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with user-provided resourceId from message
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: customResourceId,
        }),
      );
    });

    it('should prefer params metadata resourceId over message metadata resourceId', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const paramsResourceId = 'params-resource';
      const messageResourceId = 'message-resource';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
          metadata: {
            resourceId: messageResourceId,
          },
        },
        metadata: {
          resourceId: paramsResourceId, // Should take precedence
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that params metadata resourceId takes precedence
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: paramsResourceId,
        }),
      );
    });

    it('should allow user to pass custom resourceId via params metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const customResourceId = 'custom-user-resource-id';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
        },
        metadata: {
          resourceId: customResourceId, // User-provided resourceId
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with the custom resourceId
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: customResourceId,
        }),
      );
    });

    it('should allow user to pass custom resourceId via message metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const contextId = 'test-context-id';
      const customResourceId = 'message-level-resource-id';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          contextId,
          metadata: {
            resourceId: customResourceId, // User-provided resourceId at message level
          },
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was called with the custom resourceId
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.objectContaining({
          threadId: contextId,
          resourceId: customResourceId,
        }),
      );
    });

    it('should not pass threadId/resourceId when contextId is not provided', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: {
          messageId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: userMessage }],
          // No contextId
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });

      const requestContext = new RequestContext();
      await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify that agent.generate was NOT called with threadId/resourceId
      expect(mockAgent.generate).toHaveBeenCalledWith(
        expect.any(Array),
        expect.not.objectContaining({
          threadId: expect.any(String),
        }),
      );
    });

    it('should update an existing task and append new message/history', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Follow-up message!';
      const agentResponseText = 'Follow-up response!';
      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };
      // Existing task/history

      const existingTask: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: {
          state: 'completed' as const,
          message: {
            messageId,
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Old response' }],
          },
          timestamp: new Date('2025-05-07T12:00:00.000Z').toISOString(),
        },
        artifacts: [],
        history: [
          {
            kind: 'message',
            messageId: 'test-history-message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Old message' }],
          },
          {
            kind: 'message',
            messageId: 'test-history-response',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Old response' }],
          },
        ],
        metadata: undefined,
        kind: 'task',
      };

      // Use real InMemoryTaskStore
      await mockTaskStore.save({ agentId, data: existingTask });

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: agentResponseText });
      vi.setSystemTime(new Date('2025-05-08T12:00:00.000Z'));

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      const task = await mockTaskStore.load({ agentId, taskId });
      expect(task?.status.state).toBe('completed');
      expect(result?.result?.status.timestamp).not.toBe(existingTask.status.timestamp);
      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [
            {
              artifactId: expect.stringContaining(':response'),
              name: 'response.txt',
              parts: [
                {
                  text: 'Follow-up response!',
                  kind: 'text',
                },
              ],
            },
          ],
          id: expect.any(String),
          contextId: expect.any(String),
          history: [
            {
              kind: 'message',
              messageId: 'test-message-id',
              parts: [
                {
                  kind: 'text',
                  text: 'Follow-up message!',
                },
              ],
              role: 'user',
            },
          ],
          metadata: {
            execution: {
              toolCalls: undefined,
              toolResults: undefined,
              usage: undefined,
              finishReason: undefined,
            },
          },
          status: {
            message: undefined,
            state: 'completed',
            timestamp: '2025-05-08T12:00:00.000Z',
          },
          kind: 'task',
        },
      });
    });

    it('should store execution details (toolCalls, toolResults, usage) in task metadata', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Create a chart';
      const agentResponseText = 'Here is your chart';

      const mockExecutionData = {
        text: agentResponseText,
        toolCalls: [
          {
            toolCallId: 'call_123',
            toolName: 'createChart',
            args: { data: 'sales data' },
          },
        ],
        toolResults: [
          {
            toolCallId: 'call_123',
            toolName: 'createChart',
            result: { chartUrl: 'https://example.com/chart.png' },
          },
        ],
        usage: {
          promptTokens: 150,
          completionTokens: 200,
          totalTokens: 350,
        },
        finishReason: 'stop',
      };

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue(mockExecutionData);

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));
      const requestContext = new RequestContext();
      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify the execution metadata is stored
      expect(result.result?.metadata).toEqual({
        execution: {
          toolCalls: mockExecutionData.toolCalls,
          toolResults: mockExecutionData.toolResults,
          usage: mockExecutionData.usage,
          finishReason: mockExecutionData.finishReason,
        },
      });

      // Verify the task was saved with the metadata
      const taskId = result.result?.id;
      if (!taskId) {
        throw new Error('Task ID is required');
      }
      const savedTask = await mockTaskStore.load({ agentId, taskId });
      expect(savedTask?.metadata).toEqual({
        execution: {
          toolCalls: mockExecutionData.toolCalls,
          toolResults: mockExecutionData.toolResults,
          usage: mockExecutionData.usage,
          finishReason: mockExecutionData.finishReason,
        },
      });
    });

    it('should preserve existing metadata when adding execution details', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello';
      const agentResponseText = 'Hi there';

      const existingMetadata = {
        customField: 'custom value',
        anotherField: 123,
      };

      const mockExecutionData = {
        text: agentResponseText,
        toolCalls: [],
        toolResults: [],
        usage: {
          promptTokens: 10,
          completionTokens: 20,
          totalTokens: 30,
        },
        finishReason: 'stop',
      };

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
        metadata: existingMetadata,
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue(mockExecutionData);

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));
      const requestContext = new RequestContext();
      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext,
      });

      // Verify both existing metadata and execution metadata are present
      expect(result.result?.metadata).toEqual({
        ...existingMetadata,
        execution: {
          toolCalls: mockExecutionData.toolCalls,
          toolResults: mockExecutionData.toolResults,
          usage: mockExecutionData.usage,
          finishReason: mockExecutionData.finishReason,
        },
      });
    });

    it('should persist push notification config from message/send and deliver on completion', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const taskId = 'push-task-id';
      const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
      const pushNotificationStore = new InMemoryPushNotificationStore();
      const pushNotificationSender = new DefaultPushNotificationSender(pushNotificationStore, {
        fetch: fetchMock,
        lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
      });
      const generation = createDeferred<{ text: string }>();

      const params: MessageSendParams = {
        message: {
          messageId,
          taskId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Notify me when done' }],
        },
        configuration: {
          blocking: false,
          pushNotificationConfig: {
            url: 'https://example.com/webhook',
            token: 'notification-token',
          },
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockReturnValue is not available on the Agent class
      mockAgent.generate.mockReturnValue(generation.promise);
      await seedTask(mockTaskStore, taskId);

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        pushNotificationStore,
        pushNotificationSender,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      expect(result.result?.status.state).toBe('working');
      expect(fetchMock).not.toHaveBeenCalled();

      const storedConfig = pushNotificationStore.get({
        agentId,
        params: { id: taskId },
      });
      expect(storedConfig).toEqual({
        taskId,
        pushNotificationConfig: {
          id: taskId,
          token: 'notification-token',
          url: 'https://example.com/webhook',
        },
      });

      generation.resolve({ text: 'Done.' });

      await vi.waitFor(async () => {
        expect(await mockTaskStore.load({ agentId, taskId })).toMatchObject({
          status: { state: 'completed' },
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
      });
      expect(fetchMock).toHaveBeenCalledWith(
        'https://93.184.216.34/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.any(Headers),
          body: expect.any(String),
        }),
      );

      const [, requestInit] = fetchMock.mock.calls[0]!;
      expect((requestInit!.headers as Headers).get('host')).toBe('example.com');
      expect((requestInit!.headers as Headers).get(DEFAULT_PUSH_NOTIFICATION_TOKEN_HEADER)).toBe('notification-token');
      expect(JSON.parse(requestInit!.body as string)).toMatchObject({
        id: taskId,
        status: {
          state: 'completed',
        },
      });
    });

    it('should not fail the request when push notification delivery fails', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const taskId = 'push-task-id';
      const fetchMock = vi.fn().mockRejectedValue(new Error('Webhook unavailable'));
      const pushNotificationStore = new InMemoryPushNotificationStore();
      const pushNotificationSender = new DefaultPushNotificationSender(pushNotificationStore, {
        fetch: fetchMock,
        lookup: vi.fn().mockResolvedValue([{ address: '93.184.216.34', family: 4 }]),
      });
      const logger = {
        error: vi.fn(),
      } as any;

      const params: MessageSendParams = {
        message: {
          messageId,
          taskId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Notify me when done' }],
        },
        configuration: {
          pushNotificationConfig: {
            url: 'https://example.com/webhook',
          },
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: 'Done.' });
      await seedTask(mockTaskStore, taskId);

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        pushNotificationStore,
        pushNotificationSender,
        agent: mockAgent,
        agentId,
        logger,
        requestContext: new RequestContext(),
      });

      expect(result.result?.status.state).toBe('completed');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to deliver A2A push notification', expect.any(Error));
      });
    });

    it('uses a provided push notification store even when no sender is passed', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const taskId = 'push-task-id';
      const pushNotificationStore = new InMemoryPushNotificationStore();
      const logger = {
        error: vi.fn(),
      } as any;

      const params: MessageSendParams = {
        message: {
          messageId,
          taskId,
          kind: 'message',
          role: 'user',
          parts: [{ kind: 'text', text: 'Notify me when done' }],
        },
        configuration: {
          pushNotificationConfig: {
            url: 'http://localhost:9999/webhook',
          },
        },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: 'Done.' });
      await seedTask(mockTaskStore, taskId);

      const result = await handleMessageSend({
        requestId,
        params,
        taskStore: mockTaskStore,
        pushNotificationStore,
        agent: mockAgent,
        agentId,
        logger,
        requestContext: new RequestContext(),
      });

      expect(result.result?.status.state).toBe('completed');
      expect(
        pushNotificationStore.get({
          agentId,
          params: { id: taskId },
        }),
      ).toEqual({
        taskId,
        pushNotificationConfig: {
          id: taskId,
          url: 'http://localhost:9999/webhook',
        },
      });

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith('Failed to deliver A2A push notification', expect.any(Error));
      });
    });
  });

  describe('handleMessageStream', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });
      mockMastra = createMockMastra({ 'test-agent': mockAgent });
      mockTaskStore = new InMemoryTaskStore();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('rejects a stream message that references an unknown task', async () => {
      const taskId = 'unknown-stream-task';
      const mockAgent = { stream: vi.fn() } as unknown as Agent;
      const stream = handleMessageStream({
        requestId: 'unknown-stream-request',
        params: {
          message: {
            messageId: 'unknown-stream-message',
            taskId,
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Continue' }],
          },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
      });

      await expect(stream.next()).rejects.toThrow(MastraA2AError.taskNotFound(taskId));
      expect(mockAgent.stream).not.toHaveBeenCalled();
    });

    it('should yield working state and then completed result', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const agentResponseText = 'Hello, user!';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.stream.mockResolvedValue(
        createStreamResult({
          chunks: [agentResponseText],
        }),
      );

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      const first = await gen.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          contextId: expect.any(String),
          history: [
            {
              kind: 'message',
              messageId: 'test-message-id',
              parts: [{ kind: 'text', text: 'Hello, agent!' }],
              role: 'user',
            },
          ],
          id: expect.any(String),
          kind: 'task',
          metadata: undefined,
          status: {
            message: {
              kind: 'message',
              messageId: expect.any(String),
              parts: [{ kind: 'text', text: 'Generating response...' }],
              role: 'agent',
            },
            state: 'working',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
        },
      });

      const second = await gen.next();
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifact: {
            artifactId: expect.stringContaining(':response'),
            name: 'response.txt',
            parts: [
              {
                text: 'Hello, user!',
                kind: 'text',
              },
            ],
          },
          contextId: first.value?.result.contextId,
          kind: 'artifact-update',
          lastChunk: true,
          taskId: first.value?.result.id,
        },
      });
      expect(second.done).toBe(false);

      const third = await gen.next();
      expect(third.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          contextId: first.value?.result.contextId,
          final: true,
          kind: 'status-update',
          status: {
            message: undefined,
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          taskId: first.value?.result.id,
        },
      });
      expect(third.done).toBe(false);

      const done = await gen.next();
      expect(done.done).toBe(true);
    });

    it('should yield working state and then error if agent fails', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Hello, agent!';
      const errorMessage = 'Agent failed!';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockRejectedValue is not available on the Agent class
      mockAgent.stream.mockRejectedValue(new Error(errorMessage));

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      const first = await gen.next();
      expect(first.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          kind: 'task',
          status: {
            state: 'working',
            message: {
              role: 'agent',
              parts: [{ kind: 'text', text: 'Generating response...' }],
            },
          },
        },
      });

      const second = await gen.next();
      expect(second.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          final: true,
          kind: 'status-update',
          status: {
            state: 'failed',
            message: {
              parts: [{ kind: 'text', text: `Handler failed: ${errorMessage}` }],
            },
          },
        },
      });
      expect(second.done).toBe(false);

      const done = await gen.next();
      expect(done.done).toBe(true);
    });

    it('passes request abortSignal to agent stream execution', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const requestAbortController = new AbortController();
      let streamAbortSignal: AbortSignal | undefined;

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'Hello' }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockImplementation is not available on the Agent class
      mockAgent.stream.mockImplementation((_messages, options) => {
        streamAbortSignal = options.abortSignal;
        return createStreamResult({ chunks: ['Hello'] });
      });

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
        abortSignal: requestAbortController.signal,
      });

      const first = await gen.next();
      requestAbortController.abort('client disconnected');
      const canceled = await gen.next();

      expect(streamAbortSignal?.aborted).toBe(true);
      expect(streamAbortSignal?.reason).toBe('client disconnected');
      expect(canceled.value).toMatchObject({
        result: {
          final: true,
          status: { state: 'canceled' },
        },
      });
      expect(await mockTaskStore.load({ agentId, taskId: (first.value?.result as { id: string }).id })).toMatchObject({
        status: { state: 'canceled' },
      });
    });

    it('does not mark request-driven abort errors as failed', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const requestAbortController = new AbortController();
      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'Hello' }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockImplementation is not available on the Agent class
      mockAgent.stream.mockImplementation((_messages, options) => {
        throw options.abortSignal?.reason;
      });

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
        abortSignal: requestAbortController.signal,
      });

      const first = await gen.next();
      requestAbortController.abort(new DOMException('Client disconnected.', 'AbortError'));
      const canceled = await gen.next();

      expect(canceled.value).toMatchObject({
        result: {
          final: true,
          status: { state: 'canceled' },
        },
      });
      expect(await mockTaskStore.load({ agentId, taskId: (first.value?.result as { id: string }).id })).toMatchObject({
        status: { state: 'canceled' },
      });
    });

    it('aborts the active stream and does not let late chunks overwrite a canceled task', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const taskId = 'cancel-stream-task';
      const continueStream = createDeferred<void>();
      let streamAbortSignal: AbortSignal | undefined;

      const params: MessageSendParams = {
        message: { messageId, taskId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'Hello' }] },
      };

      await seedTask(mockTaskStore, taskId);

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockImplementation is not available on the Agent class
      mockAgent.stream.mockImplementation((_messages, options) => {
        streamAbortSignal = options.abortSignal;
        return {
          ...createStreamResult({ chunks: [], text: 'First second' }),
          fullStream: (async function* () {
            yield { type: 'text-delta', textDelta: 'First ' };
            await continueStream.promise;
            yield { type: 'text-delta', textDelta: 'second' };
          })(),
        };
      });

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      await gen.next();
      const nextStreamEvent = gen.next();
      await vi.waitFor(() => {
        expect(streamAbortSignal).toBeDefined();
      });

      const cancelResult = await handleTaskCancel({
        requestId: 'cancel-request-id',
        taskStore: mockTaskStore,
        agentId,
        taskId,
      });

      expect(cancelResult.result?.status.state).toBe('canceled');
      expect(streamAbortSignal?.aborted).toBe(true);

      continueStream.resolve();
      const canceledUpdate = await nextStreamEvent;
      expect(canceledUpdate.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          final: true,
          kind: 'status-update',
          status: {
            state: 'canceled',
          },
          taskId,
        },
      });

      const savedTask = await mockTaskStore.load({ agentId, taskId });
      expect(savedTask?.status.state).toBe('canceled');
      await gen.return(undefined);
    });

    it('should stream structured output as a data artifact part', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';
      const userMessage = 'Summarize this order';
      const structured = {
        summary: 'Order confirmed.',
        total: 33.98,
      };

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: userMessage }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.stream.mockResolvedValue(
        createStreamResult({
          chunks: ['Order confirmed.'],
          object: structured,
        }),
      );

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      const first = await gen.next();
      expect(first.value?.result.kind).toBe('task');

      const second = await gen.next();
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifact: {
            artifactId: expect.stringContaining(':response:text'),
            name: 'response.txt',
            parts: [
              {
                text: 'Order confirmed.',
                kind: 'text',
              },
            ],
          },
          contextId: first.value?.result.contextId,
          kind: 'artifact-update',
          lastChunk: false,
          taskId: first.value?.result.id,
        },
      });
      expect(second.done).toBe(false);

      const third = await gen.next();
      expect(third.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifact: {
            artifactId: expect.stringContaining(':response:data'),
            name: 'response.json',
            parts: [
              {
                kind: 'data',
                data: structured,
              },
            ],
          },
          contextId: first.value?.result.contextId,
          kind: 'artifact-update',
          lastChunk: true,
          taskId: first.value?.result.id,
        },
      });
      expect(third.done).toBe(false);
    });

    it('should stream text chunks as incremental artifact updates', async () => {
      const requestId = 'test-request-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const params: MessageSendParams = {
        message: { messageId, kind: 'message', role: 'user', parts: [{ kind: 'text', text: 'Hello' }] },
      };

      const mockAgent = mockMastra.getAgentById(agentId);
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.stream.mockResolvedValue(
        createStreamResult({
          chunks: ['Hello, ', 'user!'],
        }),
      );

      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const gen = handleMessageStream({
        requestId,
        params,
        taskStore: mockTaskStore,
        agentId,
        agent: mockAgent,
        requestContext: new RequestContext(),
      });

      const first = await gen.next();
      expect(first.value?.result.kind).toBe('task');

      const second = await gen.next();
      expect(second.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          kind: 'artifact-update',
          lastChunk: false,
          artifact: {
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'Hello, ' }],
          },
        },
      });

      const third = await gen.next();
      expect(third.value).toMatchObject({
        id: requestId,
        jsonrpc: '2.0',
        result: {
          kind: 'artifact-update',
          lastChunk: true,
          artifact: {
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'user!' }],
          },
        },
      });
    });
  });

  describe('HITL (input-required)', () => {
    let mockTaskStore: InMemoryTaskStore;
    const agentId = 'test-agent';

    beforeEach(() => {
      mockTaskStore = new InMemoryTaskStore();
    });

    function createSuspendedTask({
      taskId,
      contextId,
      suspendedRunId,
      suspendedToolCallId,
      suspendedRequiresApproval,
      state = 'input-required',
    }: {
      taskId: string;
      contextId: string;
      suspendedRunId: string;
      suspendedToolCallId?: string;
      suspendedRequiresApproval?: boolean;
      state?: 'input-required' | 'auth-required';
    }): Task {
      return {
        id: taskId,
        contextId,
        status: {
          state,
          timestamp: new Date().toISOString(),
        },
        artifacts: [],
        history: [],
        metadata: {
          suspendedRunId,
          ...(suspendedToolCallId ? { suspendedToolCallId } : {}),
          ...(suspendedRequiresApproval ? { suspendedRequiresApproval } : {}),
        },
        kind: 'task',
      };
    }

    it('should mark the task input-required when agent.generate suspends', async () => {
      const mockAgent = {
        generate: vi.fn().mockResolvedValue({
          text: 'Working on it',
          finishReason: 'suspended',
          suspendPayload: {
            toolCallId: 'tc-1',
            toolName: 'clarify',
            suspendPayload: { message: 'Which city do you mean?' },
          },
          resumeSchema: '{"type":"object"}',
          runId: 'run-suspended-1',
        }),
      } as unknown as Agent;

      const params: MessageSendParams = {
        message: {
          messageId: 'hitl-message-1',
          kind: 'message',
          role: 'user',
          taskId: 'task-hitl-1',
          contextId: 'ctx-hitl-1',
          parts: [{ kind: 'text', text: 'Book a flight' }],
        },
      };
      await seedTask(mockTaskStore, 'task-hitl-1', 'ctx-hitl-1');

      const result: any = await handleMessageSend({
        requestId: 'hitl-request-1',
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      const task = result.result;
      expect(task.status.state).toBe('input-required');
      expect(task.metadata.suspendedRunId).toBe('run-suspended-1');
      expect(task.status.message).toMatchObject({
        role: 'agent',
        kind: 'message',
        taskId: 'task-hitl-1',
        contextId: 'ctx-hitl-1',
        parts: [
          { kind: 'text', text: 'Which city do you mean?' },
          {
            kind: 'data',
            data: {
              suspendPayload: {
                toolCallId: 'tc-1',
                toolName: 'clarify',
                suspendPayload: { message: 'Which city do you mean?' },
              },
              resumeSchema: '{"type":"object"}',
            },
          },
        ],
      });

      const saved = await mockTaskStore.load({ agentId, taskId: 'task-hitl-1' });
      expect(saved?.status.state).toBe('input-required');
    });

    it('should resume the suspended run when a message arrives for an input-required task', async () => {
      await mockTaskStore.save({
        agentId,
        data: createSuspendedTask({
          taskId: 'task-hitl-2',
          contextId: 'ctx-hitl-2',
          suspendedRunId: 'run-suspended-2',
        }),
      });

      const generate = vi.fn();
      const resumeGenerate = vi.fn().mockResolvedValue({ text: 'Flight booked!', finishReason: 'stop' });
      const mockAgent = { generate, resumeGenerate } as unknown as Agent;

      const params: MessageSendParams = {
        message: {
          messageId: 'hitl-message-2',
          kind: 'message',
          role: 'user',
          taskId: 'task-hitl-2',
          contextId: 'ctx-hitl-2',
          parts: [{ kind: 'text', text: '{"approved":true}' }],
        },
      };

      const result: any = await handleMessageSend({
        requestId: 'hitl-request-2',
        params,
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      expect(generate).not.toHaveBeenCalled();
      expect(resumeGenerate).toHaveBeenCalledTimes(1);
      expect(resumeGenerate).toHaveBeenCalledWith(
        { approved: true },
        expect.objectContaining({ runId: 'run-suspended-2' }),
      );

      const task = result.result;
      expect(task.status.state).toBe('completed');
      expect(task.metadata.suspendedRunId).toBeUndefined();
    });

    it('resumes a suspended run when credentials arrive for an auth-required task', async () => {
      await mockTaskStore.save({
        agentId,
        data: createSuspendedTask({
          taskId: 'task-auth-required',
          contextId: 'ctx-auth-required',
          suspendedRunId: 'run-auth-required',
          state: 'auth-required',
        }),
      });
      const resumeGenerate = vi.fn().mockResolvedValue({ text: 'Authenticated', finishReason: 'stop' });
      const mockAgent = { generate: vi.fn(), resumeGenerate } as unknown as Agent;

      const result = await handleMessageSend({
        requestId: 'auth-required-request',
        params: {
          message: {
            messageId: 'auth-required-message',
            kind: 'message',
            role: 'user',
            taskId: 'task-auth-required',
            parts: [{ kind: 'data', data: { token: 'credential' } }],
          },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      expect(resumeGenerate).toHaveBeenCalledWith(
        { token: 'credential' },
        expect.objectContaining({ runId: 'run-auth-required' }),
      );
      expect(result.result?.status.state).toBe('completed');
    });

    it('should pass raw text as resume data when the follow-up message is not JSON', async () => {
      await mockTaskStore.save({
        agentId,
        data: createSuspendedTask({
          taskId: 'task-hitl-3',
          contextId: 'ctx-hitl-3',
          suspendedRunId: 'run-suspended-3',
        }),
      });

      const resumeGenerate = vi.fn().mockResolvedValue({ text: 'Done', finishReason: 'stop' });
      const mockAgent = { generate: vi.fn(), resumeGenerate } as unknown as Agent;

      await handleMessageSend({
        requestId: 'hitl-request-3',
        params: {
          message: {
            messageId: 'hitl-message-3',
            kind: 'message',
            role: 'user',
            taskId: 'task-hitl-3',
            parts: [{ kind: 'text', text: 'Paris, France' }],
          },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      expect(resumeGenerate).toHaveBeenCalledWith(
        'Paris, France',
        expect.objectContaining({ runId: 'run-suspended-3' }),
      );
    });

    it('should prefer a structured data part as resume data', async () => {
      await mockTaskStore.save({
        agentId,
        data: createSuspendedTask({
          taskId: 'task-hitl-4',
          contextId: 'ctx-hitl-4',
          suspendedRunId: 'run-suspended-4',
        }),
      });

      const resumeGenerate = vi.fn().mockResolvedValue({ text: 'Done', finishReason: 'stop' });
      const mockAgent = { generate: vi.fn(), resumeGenerate } as unknown as Agent;

      await handleMessageSend({
        requestId: 'hitl-request-4',
        params: {
          message: {
            messageId: 'hitl-message-4',
            kind: 'message',
            role: 'user',
            taskId: 'task-hitl-4',
            parts: [{ kind: 'data', data: { approved: false, reason: 'too expensive' } }],
          },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      expect(resumeGenerate).toHaveBeenCalledWith(
        { approved: false, reason: 'too expensive' },
        expect.objectContaining({ runId: 'run-suspended-4' }),
      );
    });

    it('should yield a final input-required status update when the agent suspends mid-stream', async () => {
      const mockAgent = {
        stream: vi.fn().mockResolvedValue(
          createStreamResult({
            chunks: [],
            streamEvents: [
              { type: 'text-delta', payload: { text: 'Checking flights...' } },
              {
                type: 'tool-call-suspended',
                payload: {
                  toolCallId: 'tc-stream-1',
                  toolName: 'clarify',
                  args: {},
                  suspendPayload: { message: 'Economy or business class?' },
                  resumeSchema: '{"type":"object"}',
                },
              },
            ],
          }),
        ),
      } as unknown as Agent;
      await seedTask(mockTaskStore, 'task-hitl-stream-1', 'ctx-hitl-stream-1');

      const gen = handleMessageStream({
        requestId: 'hitl-stream-1',
        params: {
          message: {
            messageId: 'hitl-stream-message-1',
            kind: 'message',
            role: 'user',
            taskId: 'task-hitl-stream-1',
            contextId: 'ctx-hitl-stream-1',
            parts: [{ kind: 'text', text: 'Book a flight' }],
          },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      const events: any[] = [];
      for await (const event of gen) {
        events.push(event);
      }

      const finalEvent = events.at(-1);
      expect(finalEvent.result).toMatchObject({
        kind: 'status-update',
        taskId: 'task-hitl-stream-1',
        final: true,
        status: {
          state: 'input-required',
          message: {
            role: 'agent',
            parts: [
              { kind: 'text', text: 'Economy or business class?' },
              {
                kind: 'data',
                data: {
                  suspendPayload: {
                    toolCallId: 'tc-stream-1',
                    toolName: 'clarify',
                    args: {},
                    suspendPayload: { message: 'Economy or business class?' },
                    resumeSchema: '{"type":"object"}',
                  },
                  resumeSchema: '{"type":"object"}',
                },
              },
            ],
          },
        },
      });

      // Partial streamed text is preserved as an artifact.
      const artifactEvents = events.filter(event => event.result?.kind === 'artifact-update');
      expect(artifactEvents.at(-1)?.result.artifact.parts).toEqual([{ kind: 'text', text: 'Checking flights...' }]);

      const saved = await mockTaskStore.load({ agentId, taskId: 'task-hitl-stream-1' });
      expect(saved?.status.state).toBe('input-required');
      expect(saved?.metadata?.suspendedRunId).toBe('task-hitl-stream-1');
    });

    it('should resume the suspended run when a message/stream arrives for an input-required task', async () => {
      await mockTaskStore.save({
        agentId,
        data: createSuspendedTask({
          taskId: 'task-hitl-stream-2',
          contextId: 'ctx-hitl-stream-2',
          suspendedRunId: 'run-suspended-stream-2',
        }),
      });

      const stream = vi.fn();
      const resumeStream = vi.fn().mockResolvedValue(
        createStreamResult({
          chunks: ['Flight booked!'],
        }),
      );
      const mockAgent = { stream, resumeStream } as unknown as Agent;

      const gen = handleMessageStream({
        requestId: 'hitl-stream-2',
        params: {
          message: {
            messageId: 'hitl-stream-message-2',
            kind: 'message',
            role: 'user',
            taskId: 'task-hitl-stream-2',
            contextId: 'ctx-hitl-stream-2',
            parts: [{ kind: 'text', text: '{"seatClass":"economy"}' }],
          },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      const events: any[] = [];
      for await (const event of gen) {
        events.push(event);
      }

      expect(stream).not.toHaveBeenCalled();
      expect(resumeStream).toHaveBeenCalledTimes(1);
      expect(resumeStream).toHaveBeenCalledWith(
        { seatClass: 'economy' },
        expect.objectContaining({ runId: 'run-suspended-stream-2' }),
      );

      const finalEvent = events.at(-1);
      expect(finalEvent.result).toMatchObject({
        kind: 'status-update',
        final: true,
        status: { state: 'completed' },
      });

      const saved = await mockTaskStore.load({ agentId, taskId: 'task-hitl-stream-2' });
      expect(saved?.status.state).toBe('completed');
      expect(saved?.metadata?.suspendedRunId).toBeUndefined();
    });

    it('should record toolCallId and approval flag when the suspension is a tool approval', async () => {
      const mockAgent = {
        // Approval suspensions carry no nested `suspendPayload` (ToolCallApprovalPayload).
        generate: vi.fn().mockResolvedValue({
          text: '',
          finishReason: 'suspended',
          suspendPayload: {
            toolCallId: 'tc-approval-1',
            toolName: 'bookFlight',
            args: { city: 'Paris' },
            resumeSchema: '{"type":"object"}',
          },
          resumeSchema: '{"type":"object"}',
          runId: 'run-approval-1',
        }),
      } as unknown as Agent;
      await seedTask(mockTaskStore, 'task-hitl-approval-1', 'ctx-hitl-approval-1');

      const result: any = await handleMessageSend({
        requestId: 'hitl-approval-1',
        params: {
          message: {
            messageId: 'hitl-approval-message-1',
            kind: 'message',
            role: 'user',
            taskId: 'task-hitl-approval-1',
            contextId: 'ctx-hitl-approval-1',
            parts: [{ kind: 'text', text: 'Book a flight' }],
          },
        },
        taskStore: mockTaskStore,
        agent: mockAgent,
        agentId,
        requestContext: new RequestContext(),
      });

      expect(result.result.status.state).toBe('input-required');
      expect(result.result.metadata).toMatchObject({
        suspendedRunId: 'run-approval-1',
        suspendedToolCallId: 'tc-approval-1',
        suspendedRequiresApproval: true,
      });
    });

    it.each([
      ['yes', { approved: true }],
      ['Approved!', { approved: true }],
      ['no', { approved: false }],
      ['Declined', { approved: false }],
    ])(
      'should coerce the plain-text approval reply %j to %j and pass the suspended toolCallId',
      async (replyText, expectedResumeData) => {
        const taskId = `task-hitl-approval-reply-${replyText}`;
        await mockTaskStore.save({
          agentId,
          data: createSuspendedTask({
            taskId,
            contextId: 'ctx-hitl-approval-reply',
            suspendedRunId: 'run-approval-reply',
            suspendedToolCallId: 'tc-approval-reply',
            suspendedRequiresApproval: true,
          }),
        });

        const resumeGenerate = vi.fn().mockResolvedValue({ text: 'Done', finishReason: 'stop' });
        const mockAgent = { generate: vi.fn(), resumeGenerate } as unknown as Agent;

        await handleMessageSend({
          requestId: 'hitl-approval-reply',
          params: {
            message: {
              messageId: `hitl-approval-reply-message-${replyText}`,
              kind: 'message',
              role: 'user',
              taskId,
              parts: [{ kind: 'text', text: replyText }],
            },
          },
          taskStore: mockTaskStore,
          agent: mockAgent,
          agentId,
          requestContext: new RequestContext(),
        });

        expect(resumeGenerate).toHaveBeenCalledWith(
          expectedResumeData,
          expect.objectContaining({ runId: 'run-approval-reply', toolCallId: 'tc-approval-reply' }),
        );
      },
    );

    it('should clear approval metadata when a resumed run suspends for free-form input', async () => {
      const generate = vi.fn().mockResolvedValue({
        text: '',
        finishReason: 'suspended',
        suspendPayload: {
          toolCallId: 'tc-round-1',
          toolName: 'bookFlight',
          args: { city: 'Paris' },
          resumeSchema: '{"type":"object"}',
        },
        resumeSchema: '{"type":"object"}',
        runId: 'run-round-1',
      });
      const resumeGenerate = vi
        .fn()
        .mockResolvedValueOnce({
          text: '',
          finishReason: 'suspended',
          suspendPayload: {
            toolCallId: 'tc-round-2',
            toolName: 'clarify',
            suspendPayload: { message: 'Is tomorrow acceptable?' },
          },
          runId: 'run-round-1',
        })
        .mockResolvedValueOnce({ text: 'Flight booked!', finishReason: 'stop' });
      const mockAgent = { generate, resumeGenerate } as unknown as Agent;

      const sendMessage = (messageId: string, text: string) =>
        handleMessageSend({
          requestId: messageId,
          params: {
            message: {
              messageId,
              kind: 'message',
              role: 'user',
              taskId: 'task-hitl-rounds',
              contextId: 'ctx-hitl-rounds',
              parts: [{ kind: 'text', text }],
            },
          },
          taskStore: mockTaskStore,
          agent: mockAgent,
          agentId,
          requestContext: new RequestContext(),
        });

      await seedTask(mockTaskStore, 'task-hitl-rounds', 'ctx-hitl-rounds');
      const first: any = await sendMessage('round-message-1', 'Book a flight');
      expect(first.result.status.state).toBe('input-required');
      expect(first.result.metadata.suspendedToolCallId).toBe('tc-round-1');
      expect(first.result.metadata.suspendedRequiresApproval).toBe(true);

      const second: any = await sendMessage('round-message-2', 'yes');
      expect(second.result.status.state).toBe('input-required');
      expect(second.result.status.message.parts[0]).toEqual({ kind: 'text', text: 'Is tomorrow acceptable?' });
      expect(second.result.metadata.suspendedToolCallId).toBe('tc-round-2');
      expect(second.result.metadata.suspendedRequiresApproval).toBeUndefined();

      const third: any = await sendMessage('round-message-3', 'yes');
      expect(third.result.status.state).toBe('completed');
      expect(third.result.metadata.suspendedRunId).toBeUndefined();
      expect(third.result.metadata.suspendedToolCallId).toBeUndefined();

      expect(generate).toHaveBeenCalledTimes(1);
      expect(resumeGenerate).toHaveBeenCalledTimes(2);
      expect(resumeGenerate).toHaveBeenNthCalledWith(
        1,
        { approved: true },
        expect.objectContaining({ runId: 'run-round-1', toolCallId: 'tc-round-1' }),
      );
      expect(resumeGenerate).toHaveBeenNthCalledWith(
        2,
        'yes',
        expect.objectContaining({ runId: 'run-round-1', toolCallId: 'tc-round-2' }),
      );
    });

    it('should resume only once when concurrent follow-up messages arrive for the same input-required task', async () => {
      await mockTaskStore.save({
        agentId,
        data: createSuspendedTask({
          taskId: 'task-hitl-race',
          contextId: 'ctx-hitl-race',
          suspendedRunId: 'run-race',
        }),
      });

      const resumeGenerate = vi.fn().mockResolvedValue({ text: 'Done', finishReason: 'stop' });
      const generate = vi.fn().mockResolvedValue({ text: 'Fresh run', finishReason: 'stop' });
      const mockAgent = { generate, resumeGenerate } as unknown as Agent;

      const sendFollowUp = (messageId: string) =>
        handleMessageSend({
          requestId: messageId,
          params: {
            message: {
              messageId,
              kind: 'message',
              role: 'user',
              taskId: 'task-hitl-race',
              parts: [{ kind: 'text', text: '{"approved":true}' }],
            },
          },
          taskStore: mockTaskStore,
          agent: mockAgent,
          agentId,
          requestContext: new RequestContext(),
        });

      const results = await Promise.all([sendFollowUp('race-message-1'), sendFollowUp('race-message-2')]);

      expect(resumeGenerate).toHaveBeenCalledTimes(1);
      expect(generate).not.toHaveBeenCalled();
      expect(results.map(result => result.result?.status.state)).toEqual(['completed', 'completed']);

      const task = await mockTaskStore.load({ agentId, taskId: 'task-hitl-race' });
      expect(task?.status.state).toBe('completed');
      expect(task?.history).toHaveLength(1);
      expect(['race-message-1', 'race-message-2']).toContain(task?.history?.[0]?.messageId);
    });
  });

  describe('handleTaskResubscribe with interrupted tasks', () => {
    const agentId = 'test-agent';

    it.each(['input-required', 'auth-required'] as const)(
      'should end the stream immediately when the task is already %s',
      async state => {
        const taskStore = new InMemoryTaskStore();
        await taskStore.save({
          agentId,
          data: {
            id: 'task-resub-input',
            contextId: 'ctx-resub-input',
            status: { state, timestamp: new Date().toISOString() },
            artifacts: [],
            history: [],
            metadata: { suspendedRunId: 'run-resub' },
            kind: 'task',
          },
        });

        const events: any[] = [];
        for await (const event of handleTaskResubscribe({
          requestId: 'resub-input-1',
          taskStore,
          agentId,
          taskId: 'task-resub-input',
        })) {
          events.push(event);
        }

        expect(events).toHaveLength(1);
        expect(events[0].result.status.state).toBe(state);
      },
    );

    it('should emit a final status update and end when a working task transitions to input-required', async () => {
      const taskStore = new InMemoryTaskStore();
      const workingTask: Task = {
        id: 'task-resub-transition',
        contextId: 'ctx-resub-transition',
        status: { state: 'working', timestamp: new Date().toISOString() },
        artifacts: [],
        history: [],
        metadata: {},
        kind: 'task',
      };
      await taskStore.save({ agentId, data: workingTask });

      const events: any[] = [];
      const consume = (async () => {
        for await (const event of handleTaskResubscribe({
          requestId: 'resub-transition-1',
          taskStore,
          agentId,
          taskId: 'task-resub-transition',
        })) {
          events.push(event);
        }
      })();

      await taskStore.save({
        agentId,
        data: {
          ...workingTask,
          status: { state: 'input-required', timestamp: new Date().toISOString() },
        },
      });

      await consume;

      const finalEvent = events.at(-1);
      expect(finalEvent.result).toMatchObject({
        kind: 'status-update',
        final: true,
        status: { state: 'input-required' },
      });
    });
  });

  describe('handleTaskGet', () => {
    it('should return the task', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const mockTaskStore = new InMemoryTaskStore();
      const task: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: {
          state: 'completed',
          message: {
            messageId,
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Hello, user!' }],
          },
          timestamp: new Date('2025-05-08T11:47:38.458Z').toISOString(),
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };
      await mockTaskStore.save({ agentId, data: task });

      const result = await handleTaskGet({
        requestId,
        taskStore: mockTaskStore,
        agentId,
        taskId,
      });

      expect(result!.result).toEqual(task);
      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          id: 'test-task-id',
          contextId: expect.any(String),
          metadata: undefined,
          status: {
            message: {
              messageId: expect.any(String),
              parts: [
                {
                  text: 'Hello, user!',
                  kind: 'text',
                },
              ],
              role: 'agent',
              kind: 'message',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          kind: 'task',
        },
      });
    });

    it('should return an error when task cannot be found', async () => {
      const requestId = 'test-request-id';
      const nonExistentTaskId = 'non-existent-task-id';
      const agentId = 'test-agent';

      const mockTaskStore = new InMemoryTaskStore();
      await expect(
        handleTaskGet({
          requestId,
          taskStore: mockTaskStore,
          agentId,
          taskId: nonExistentTaskId,
        }),
      ).rejects.toThrow(MastraA2AError.taskNotFound(nonExistentTaskId));
    });
  });

  describe('handleTaskCancel', () => {
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      mockTaskStore = new InMemoryTaskStore();
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should successfully cancel a task in a non-final state', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const task: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: {
          state: 'working',
          message: { messageId, kind: 'message', role: 'agent', parts: [{ kind: 'text', text: 'Working...' }] },
          timestamp: new Date('2025-05-08T11:47:38.458Z').toISOString(),
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId, data: task });
      vi.setSystemTime(new Date('2025-05-08T11:47:38.458Z'));

      const result = await handleTaskCancel({
        requestId,
        taskStore: mockTaskStore,
        agentId,
        taskId,
      });

      // Verify task was updated to canceled state
      const updatedData = await mockTaskStore.load({ agentId, taskId });
      expect(updatedData?.status.state).toBe('canceled');
      expect(result).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifacts: [],
          id: expect.any(String),
          contextId: expect.any(String),
          metadata: undefined,
          status: {
            message: {
              messageId: expect.any(String),
              parts: [
                {
                  text: 'Task cancelled by request.',
                  kind: 'text',
                },
              ],
              role: 'agent',
              kind: 'message',
            },
            state: 'canceled',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          kind: 'task',
        },
      });
    });

    it('should not cancel a task in a final state', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const messageId = 'test-message-id';
      const agentId = 'test-agent';

      const task: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: {
          state: 'completed',
          message: { messageId, kind: 'message', role: 'agent', parts: [{ kind: 'text', text: 'Done!' }] },
          timestamp: new Date('2025-05-08T11:47:38.458Z').toISOString(),
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId, data: task });

      await expect(
        handleTaskCancel({
          requestId,
          taskStore: mockTaskStore,
          agentId,
          taskId,
        }),
      ).rejects.toThrow(MastraA2AError.taskNotCancelable(taskId));

      // Verify task remained in completed state
      const updatedData = await mockTaskStore.load({ agentId, taskId });
      expect(updatedData?.status.state).toBe('completed');
    });

    it('should preserve a concurrent terminal update instead of overwriting it with cancellation', async () => {
      const requestId = 'test-request-id';
      const taskId = 'test-task-id';
      const agentId = 'test-agent';
      const task: Task = {
        id: taskId,
        contextId: 'test-session-id',
        status: { state: 'working' },
        artifacts: [],
        kind: 'task',
      };

      await mockTaskStore.save({ agentId, data: task });

      const originalSave = mockTaskStore.save.bind(mockTaskStore);
      let injectConflict = true;
      vi.spyOn(mockTaskStore, 'save').mockImplementation(async input => {
        if (injectConflict && input.expectedVersion === 1) {
          injectConflict = false;
          await originalSave({
            agentId,
            data: { ...task, status: { state: 'completed' } },
            expectedVersion: 1,
          });
        }
        return originalSave(input);
      });

      await expect(handleTaskCancel({ requestId, taskStore: mockTaskStore, agentId, taskId })).rejects.toThrow(
        MastraA2AError.taskNotCancelable(taskId),
      );

      expect((await mockTaskStore.load({ agentId, taskId }))?.status.state).toBe('completed');
      expect(mockTaskStore.activeCancellations.has(taskId)).toBe(false);
    });

    it('should throw error when canceling non-existent task', async () => {
      const requestId = 'test-request-id';
      const nonExistentTaskId = 'non-existent-task-id';
      const agentId = 'test-agent';

      await expect(
        handleTaskCancel({
          requestId,
          taskStore: mockTaskStore,
          agentId,
          taskId: nonExistentTaskId,
        }),
      ).rejects.toThrow(MastraA2AError.taskNotFound(nonExistentTaskId));
    });
  });

  describe('getAgentExecutionHandler', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });

      mockMastra = createMockMastra({
        'test-agent': mockAgent,
      });
      mockTaskStore = new InMemoryTaskStore();
    });

    it('stores, retrieves, lists, and deletes push notification configs', async () => {
      const pushNotificationStore = new InMemoryPushNotificationStore();

      await mockTaskStore.save({
        agentId: 'test-agent',
        data: {
          id: 'task-1',
          contextId: 'context-1',
          status: {
            state: 'working',
            message: undefined,
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          artifacts: [],
          metadata: undefined,
          kind: 'task',
        },
      });

      const setResult = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/pushNotificationConfig/set' as any,
        params: { taskId: 'task-1', pushNotificationConfig: { url: 'https://example.com' } } as any,
        taskStore: mockTaskStore,
        pushNotificationStore,
      });

      expect(setResult).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          taskId: 'task-1',
          pushNotificationConfig: {
            id: 'task-1',
            url: 'https://example.com',
          },
        },
      });

      const getResult = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/pushNotificationConfig/get' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
        pushNotificationStore,
      });
      expect(getResult).toEqual(setResult);

      const listResult = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/pushNotificationConfig/list' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
        pushNotificationStore,
      });
      expect(listResult).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: [setResult.result],
      });

      const deleteResult = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/pushNotificationConfig/delete' as any,
        params: { id: 'task-1', pushNotificationConfigId: 'task-1' } as any,
        taskStore: mockTaskStore,
        pushNotificationStore,
      });
      expect(deleteResult).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: null,
      });

      const listAfterDeleteResult = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/pushNotificationConfig/list' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
        pushNotificationStore,
      });
      expect(listAfterDeleteResult).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: [],
      });
    });

    it('returns task not found when configuring push notifications for an unknown task', async () => {
      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/pushNotificationConfig/set' as any,
        params: { taskId: 'missing-task', pushNotificationConfig: { url: 'https://example.com' } } as any,
        taskStore: mockTaskStore,
        pushNotificationStore: new InMemoryPushNotificationStore(),
      });

      expect(result).toMatchObject({
        error: {
          code: -32001,
          message: 'Task not found: missing-task',
        },
        id: 'test-request-id',
        jsonrpc: '2.0',
      });
    });

    it('returns authenticated extended card not configured for agent/getAuthenticatedExtendedCard', async () => {
      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'agent/getAuthenticatedExtendedCard' as any,
        params: undefined as any,
        taskStore: mockTaskStore,
      });

      expect(result).toMatchObject({
        error: {
          code: -32007,
          message: 'Extended agent card is not configured',
        },
        id: 'test-request-id',
        jsonrpc: '2.0',
      });
    });

    it('resubscribes to an existing terminal task by returning the current task snapshot and closing', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'completed',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Done!' }],
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
      });

      const first = await result.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: task,
      });

      const done = await result.next();
      expect(done.done).toBe(true);
    });

    it('returns the current task snapshot first, then streams live artifact and status updates', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'working',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Still working...' }],
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [
          {
            artifactId: 'response:text',
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'Still working...' }],
          },
        ],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
      });

      const first = await result.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: task,
      });

      const secondPromise = result.next();
      await expect(Promise.race([secondPromise.then(() => 'resolved'), Promise.resolve('pending')])).resolves.toBe(
        'pending',
      );

      await mockTaskStore.save({
        agentId: 'test-agent',
        data: {
          ...task,
          artifacts: [
            ...task.artifacts!,
            {
              artifactId: 'response:data',
              name: 'response.json',
              parts: [{ kind: 'data', data: { total: 33.98 } }],
            },
          ],
          status: {
            state: 'completed',
            message: {
              messageId: 'message-2',
              kind: 'message',
              role: 'agent',
              parts: [{ kind: 'text', text: 'Done!' }],
            },
            timestamp: '2025-05-08T11:48:38.458Z',
          },
        },
      });

      const second = await secondPromise;
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifact: {
            artifactId: 'response:data',
            name: 'response.json',
            parts: [{ kind: 'data', data: { total: 33.98 } }],
          },
          contextId: 'context-1',
          kind: 'artifact-update',
          lastChunk: true,
          taskId: 'task-1',
        },
      });

      const third = await result.next();
      expect(third.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          contextId: 'context-1',
          final: true,
          kind: 'status-update',
          status: {
            message: {
              kind: 'message',
              messageId: 'message-2',
              parts: [{ kind: 'text', text: 'Done!' }],
              role: 'agent',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:48:38.458Z',
          },
          taskId: 'task-1',
        },
      });

      const done = await result.next();
      expect(done.done).toBe(true);
    });

    it('streams artifact updates even when task status does not change', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'working',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Still working...' }],
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
      });

      const first = await result.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: task,
      });

      const secondPromise = result.next();

      await mockTaskStore.save({
        agentId: 'test-agent',
        data: {
          ...task,
          artifacts: [
            {
              artifactId: 'response:text',
              name: 'response.txt',
              parts: [{ kind: 'text', text: 'Partial result' }],
            },
          ],
        },
      });

      const second = await secondPromise;
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifact: {
            artifactId: 'response:text',
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'Partial result' }],
          },
          contextId: 'context-1',
          kind: 'artifact-update',
          lastChunk: false,
          taskId: 'task-1',
        },
      });
    });

    it('streams status updates when only status message metadata changes', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'working',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Still working...' }],
            metadata: { phase: 'initial' },
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
      });

      const first = await result.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: task,
      });

      const secondPromise = result.next();

      await mockTaskStore.save({
        agentId: 'test-agent',
        data: {
          ...task,
          status: {
            ...task.status,
            message: {
              ...task.status.message!,
              metadata: { phase: 'updated' },
            },
          },
        },
      });

      const second = await secondPromise;
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          contextId: 'context-1',
          final: false,
          kind: 'status-update',
          status: {
            message: {
              kind: 'message',
              messageId: 'message-1',
              metadata: { phase: 'updated' },
              parts: [{ kind: 'text', text: 'Still working...' }],
              role: 'agent',
            },
            state: 'working',
            timestamp: '2025-05-08T11:47:38.458Z',
          },
          taskId: 'task-1',
        },
      });
    });

    it('streams each changed artifact in order before the final status update', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'working',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Still working...' }],
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
      });

      const first = await result.next();
      expect(first.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: task,
      });

      const secondPromise = result.next();

      await mockTaskStore.save({
        agentId: 'test-agent',
        data: {
          ...task,
          artifacts: [
            {
              artifactId: 'response:text',
              name: 'response.txt',
              parts: [{ kind: 'text', text: 'Partial result' }],
            },
            {
              artifactId: 'response:data',
              name: 'response.json',
              parts: [{ kind: 'data', data: { total: 33.98 } }],
            },
          ],
          status: {
            state: 'completed',
            message: {
              messageId: 'message-2',
              kind: 'message',
              role: 'agent',
              parts: [{ kind: 'text', text: 'Done!' }],
            },
            timestamp: '2025-05-08T11:48:38.458Z',
          },
        },
      });

      const second = await secondPromise;
      expect(second.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifact: {
            artifactId: 'response:text',
            name: 'response.txt',
            parts: [{ kind: 'text', text: 'Partial result' }],
          },
          contextId: 'context-1',
          kind: 'artifact-update',
          lastChunk: false,
          taskId: 'task-1',
        },
      });

      const third = await result.next();
      expect(third.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          artifact: {
            artifactId: 'response:data',
            name: 'response.json',
            parts: [{ kind: 'data', data: { total: 33.98 } }],
          },
          contextId: 'context-1',
          kind: 'artifact-update',
          lastChunk: true,
          taskId: 'task-1',
        },
      });

      const fourth = await result.next();
      expect(fourth.value).toEqual({
        id: 'test-request-id',
        jsonrpc: '2.0',
        result: {
          contextId: 'context-1',
          final: true,
          kind: 'status-update',
          status: {
            message: {
              kind: 'message',
              messageId: 'message-2',
              parts: [{ kind: 'text', text: 'Done!' }],
              role: 'agent',
            },
            state: 'completed',
            timestamp: '2025-05-08T11:48:38.458Z',
          },
          taskId: 'task-1',
        },
      });

      const done = await result.next();
      expect(done.done).toBe(true);
    });

    it('unregisters resubscribe listeners when the abort signal is triggered', async () => {
      const task: Task = {
        id: 'task-1',
        contextId: 'context-1',
        status: {
          state: 'working',
          message: {
            messageId: 'message-1',
            kind: 'message',
            role: 'agent',
            parts: [{ kind: 'text', text: 'Still working...' }],
          },
          timestamp: '2025-05-08T11:47:38.458Z',
        },
        artifacts: [],
        metadata: undefined,
        kind: 'task',
      };

      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      const abortController = new AbortController();
      const result = await getAgentExecutionHandler({
        requestId: 'test-request-id',
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        method: 'tasks/resubscribe' as any,
        params: { id: 'task-1' } as any,
        taskStore: mockTaskStore,
        abortSignal: abortController.signal,
      });

      const first = await result.next();
      expect(first.value).toMatchObject({
        result: task,
      });

      const pendingNext = result.next();
      expect(((mockTaskStore as any).listeners.get('test-agent-task-1') as Set<unknown> | undefined)?.size).toBe(1);

      abortController.abort();

      await expect(pendingNext).rejects.toMatchObject({ name: 'AbortError' });
      expect(((mockTaskStore as any).listeners.get('test-agent-task-1') as Set<unknown> | undefined)?.size).toBe(
        undefined,
      );
    });
  });

  describe('A2A protocol version negotiation', () => {
    it.each([
      [undefined, '0.3'],
      ['', '0.3'],
      ['0.3', '0.3'],
      ['1.0', '1.0'],
    ] as const)('resolves %s to protocol version %s', (header, expected) => {
      const request = new Request('http://localhost/api/a2a/test-agent', {
        headers: header === undefined ? undefined : { 'A2A-Version': header },
      });

      expect(resolveA2AProtocolVersion(request)).toBe(expected);
    });

    it('rejects unsupported protocol versions', () => {
      const request = new Request('http://localhost/api/a2a/test-agent', {
        headers: { 'A2A-Version': '2.0' },
      });

      expect(() => resolveA2AProtocolVersion(request)).toThrow('Version not supported: 2.0');
    });
  });

  describe('AGENT_EXECUTION_ROUTE', () => {
    let mockMastra: Mastra;
    let mockTaskStore: InMemoryTaskStore;

    beforeEach(() => {
      const mockAgent = new MockAgent({
        id: 'test-agent',
        name: 'test-agent',
        instructions: 'test instructions',
        model: openai('gpt-4o'),
      });

      mockMastra = createMockMastra({
        'test-agent': mockAgent,
      });
      mockTaskStore = new InMemoryTaskStore();
    });

    it('returns JSON for non-streaming A2A methods', async () => {
      const response = await AGENT_EXECUTION_ROUTE.handler({
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        taskStore: mockTaskStore,
        abortSignal: AbortSignal.abort(),
        id: 1,
        method: 'tasks/get',
        params: { id: 'missing-task' },
      });

      expect(response.headers.get('Content-Type')).toContain('application/json');

      const payload = await response.json();
      expect(payload).toMatchObject({
        id: 1,
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Task not found: missing-task',
        },
      });
    });

    it('accepts and returns A2A v1 message shapes', async () => {
      const mockAgent = mockMastra.getAgentById('test-agent');
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.generate.mockResolvedValue({ text: 'Hello from v1' });

      const response = await AGENT_EXECUTION_ROUTE.handler({
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        taskStore: mockTaskStore,
        abortSignal: AbortSignal.abort(),
        request: new Request('http://localhost/api/a2a/test-agent', {
          headers: { 'A2A-Version': '1.0' },
        }),
        id: 2,
        method: 'message/send',
        params: {
          message: {
            messageId: 'v1-message',
            role: 'ROLE_USER',
            parts: [{ text: 'Hello' }],
          },
          configuration: { returnImmediately: false },
        },
      });

      expect(await response.json()).toMatchObject({
        jsonrpc: '2.0',
        id: 2,
        result: {
          task: {
            status: { state: 'TASK_STATE_COMPLETED' },
            artifacts: [{ parts: [{ text: 'Hello from v1' }] }],
          },
        },
      });
    });

    it('lists tasks using the A2A v1 pagination response', async () => {
      const task = {
        id: 'task-1',
        contextId: 'context-1',
        kind: 'task' as const,
        status: { state: 'completed' as const, timestamp: '2026-08-06T12:00:00.000Z' },
      };
      await mockTaskStore.save({ agentId: 'test-agent', data: task });

      expect(
        handleTaskList({
          requestId: 3,
          taskStore: mockTaskStore,
          agentId: 'test-agent',
          params: { contextId: 'context-1', pageSize: 10 },
        }),
      ).toEqual({
        jsonrpc: '2.0',
        id: 3,
        result: {
          tasks: [
            expect.objectContaining({
              id: 'task-1',
              status: expect.objectContaining({ state: 'TASK_STATE_COMPLETED' }),
            }),
          ],
          nextPageToken: '',
          pageSize: 10,
          totalSize: 1,
        },
      });
    });

    it('returns a protocol error for unsupported A2A versions', async () => {
      const response = await AGENT_EXECUTION_ROUTE.handler({
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        taskStore: mockTaskStore,
        abortSignal: AbortSignal.abort(),
        request: new Request('http://localhost/api/a2a/test-agent', {
          headers: { 'A2A-Version': '2.0' },
        }),
        id: 2,
        method: 'tasks/get',
        params: { id: 'missing-task' },
      });

      expect(await response.json()).toEqual({
        jsonrpc: '2.0',
        id: 2,
        error: {
          code: -32009,
          message: 'Version not supported: 2.0',
          data: { version: '2.0' },
        },
      });
    });

    it('returns SSE for streaming A2A methods', async () => {
      const mockAgent = mockMastra.getAgentById('test-agent');
      // @ts-expect-error - mockResolvedValue is not available on the Agent class
      mockAgent.stream.mockResolvedValue(
        createStreamResult({
          chunks: ['Hello from SSE'],
        }),
      );

      const response = await AGENT_EXECUTION_ROUTE.handler({
        mastra: mockMastra,
        agentId: 'test-agent',
        requestContext: new RequestContext(),
        taskStore: mockTaskStore,
        abortSignal: new AbortController().signal,
        id: 42,
        method: 'message/stream',
        params: {
          message: {
            messageId: 'user-message-id',
            kind: 'message',
            role: 'user',
            parts: [{ kind: 'text', text: 'Hello' }],
          },
          configuration: {
            blocking: true,
          },
        },
      });

      expect(response.headers.get('Content-Type')).toContain('text/event-stream');

      const body = await response.text();
      expect(body).toContain('data: {"jsonrpc":"2.0","id":42,"result":{"id":');
      expect(body).toContain('"kind":"task"');
      expect(body).toContain('"kind":"status-update"');
      expect(body).toContain('Hello from SSE');
    });
  });
});
