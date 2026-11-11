/**
 * A `MessageHistory({ storage })` output processor with no Memory instance, where the thread lives
 * only in the request context (`requestContext.set('MastraMemory', ...)`) — no `memory.thread` and no
 * `threadId` argument. The processor resolves that thread itself, so the run must write it to
 * storage, authorize a memory write for it, and undo the save when a later processor trips.
 */
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import type { OutputResult } from '..';
import type { MastraDBMessage } from '../../agent';
import { Agent, MessageList } from '../../agent';
import type { IFGAProvider } from '../../auth/ee/interfaces/fga';
import { Mastra } from '../../mastra';
import type { MemoryRuntimeContext } from '../../memory';
import type { Processor } from '../../processors';
import { RequestContext } from '../../request-context';
import { InMemoryStore } from '../../storage';
import { MessageHistory } from './message-history';

const THREAD = 'thread-reqctx';
const RESOURCE = 'resource-reqctx';

/** A turn whose thread exists only in the request context. */
function requestContextWithThread() {
  const requestContext = new RequestContext();
  requestContext.set('MastraMemory', { thread: { id: THREAD }, resourceId: RESOURCE } satisfies MemoryRuntimeContext);
  return requestContext;
}

function userMessage(): MastraDBMessage {
  return {
    id: 'msg-user',
    role: 'user',
    content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
    createdAt: new Date(),
  };
}

function assistantMessage(): MastraDBMessage {
  return {
    id: 'msg-assistant',
    role: 'assistant',
    content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
    createdAt: new Date(),
  };
}

const stopResult: OutputResult = {
  text: 'Hi there!',
  usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
  finishReason: 'stop',
  steps: [],
};

// processOutputResult runs the output pass the way the runner does, minus span plumbing.
function runOutputResult(
  processor: MessageHistory,
  messageList: MessageList,
  requestContext: RequestContext,
  messages: MastraDBMessage[],
) {
  return processor.processOutputResult({
    messageList,
    messages,
    result: stopResult,
    abort: ((reason?: string) => {
      throw new Error(reason);
    }) as (reason?: string) => never,
    requestContext,
  });
}

function createMockFGAProvider(): IFGAProvider {
  return {
    check: vi.fn().mockResolvedValue(true),
    require: vi.fn().mockResolvedValue(undefined),
    filterAccessible: vi.fn(),
  };
}

function createMockModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      finishReason: 'stop',
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      content: [{ type: 'text', text: 'ok' }],
    }),
  });
}

/** Runs after MessageHistory in the same pass, so it trips on an already-saved turn. */
function createTripwireProcessor(): Processor {
  return {
    id: 'tripwire',
    processOutputResult: async ({ abort }) => abort('blocked by guardrail'),
  };
}

describe('MessageHistory with a request-context thread and no Memory instance', () => {
  it('stores the turn under the request-context thread', async () => {
    const memoryStore = (await new InMemoryStore().getStore('memory'))!;
    const processor = new MessageHistory({ storage: memoryStore });

    const user = userMessage();
    const assistant = assistantMessage();
    // The MessageList carries no thread: only the request context names one.
    const messageList = new MessageList().add([user], 'input').add([assistant], 'response');

    await runOutputResult(processor, messageList, requestContextWithThread(), [user, assistant]);

    const { messages } = await memoryStore.listMessages({ threadId: THREAD });
    expect(messages.map(message => [message.role, message.id])).toEqual([
      ['user', 'msg-user'],
      ['assistant', 'msg-assistant'],
    ]);
    expect(messages.map(message => message.threadId)).toEqual([THREAD, THREAD]);
    expect(messages.map(message => message.resourceId)).toEqual([RESOURCE, RESOURCE]);
  });

  it('authorizes a memory:write check for the request-context thread on finish', async () => {
    const memoryStore = (await new InMemoryStore().getStore('memory'))!;
    const processor = new MessageHistory({ storage: memoryStore });
    const fgaProvider = createMockFGAProvider();

    const agent = new Agent({
      id: 'request-context-agent',
      name: 'request-context-agent',
      instructions: 'test',
      model: createMockModel(),
      outputProcessors: [processor],
    });
    // Registering the agent with a Mastra that carries an FGA provider makes the framework's
    // `memory:write` checks actually reach the provider.
    new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore(), server: { fga: fgaProvider } });

    // No `memory.thread` and no `threadId` argument: the request context is the only thread source.
    const requestContext = requestContextWithThread();
    requestContext.set('user', { id: 'user-1' });

    await agent.generate('Hello', { requestContext: requestContext as any });

    expect(fgaProvider.require).toHaveBeenCalledWith(
      { id: 'user-1' },
      expect.objectContaining({
        resource: { type: 'thread', id: THREAD },
        permission: 'memory:write',
      }),
    );
  });

  it('rolls back the saved reply when a later output processor trips, with no Memory instance', async () => {
    const memoryStore = (await new InMemoryStore().getStore('memory'))!;
    const processor = new MessageHistory({ storage: memoryStore });

    const agent = new Agent({
      id: 'tripwire-request-context-agent',
      name: 'tripwire-request-context-agent',
      instructions: 'test',
      model: createMockModel(),
      // MessageHistory saves the turn first, then the guardrail rejects it — so the rollback has
      // to remove what the processor wrote, with no Memory instance to fall back on.
      outputProcessors: [processor, createTripwireProcessor()],
    });

    const result = await agent.generate('Hello', { requestContext: requestContextWithThread() as any });

    expect(result.tripwire?.reason).toBe('blocked by guardrail');
    const { messages } = await memoryStore.listMessages({ threadId: THREAD });
    // The processor did save the turn (the user row, stamped from the request context)…
    expect(messages.map(message => message.role)).toEqual(['user']);
    // …and the blocked reply was rolled back rather than left in the thread.
    expect(messages.some(message => message.role === 'assistant')).toBe(false);
  });
});
