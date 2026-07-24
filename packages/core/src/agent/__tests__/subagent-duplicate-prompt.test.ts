import { randomUUID } from 'node:crypto';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { MockMemory } from '../../memory/mock';
import type { OutputProcessor, ProcessOutputResultArgs } from '../../processors/index';
import { InMemoryStore } from '../../storage';
import { Agent } from '../agent';

/**
 * Regression tests for the duplicate delegation prompt bug.
 *
 * When a supervisor with memory delegates to a memory-less sub-agent, the
 * delegation prompt could be persisted twice to the sub-agent thread:
 *  1. by a processor persisting input messages during the sub-agent run
 *     (e.g. observational memory finalizing a turn), and
 *  2. by core's explicit post-run delegation transcript save, which used to
 *     rebuild the prompt as a brand-new message with a fresh ID.
 *
 * The fix pre-builds the prompt as a DB message with a stable ID and passes it
 * into the sub-agent run, so both writes upsert the same row.
 */

const DELEGATION_PROMPT = 'What is the capital of France?';
const SUB_AGENT_RESPONSE = 'The capital of France is Paris.';

function makeSubAgentModel() {
  return new MockLanguageModelV2({
    doGenerate: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      finishReason: 'stop' as const,
      usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
      text: SUB_AGENT_RESPONSE,
      content: [{ type: 'text' as const, text: SUB_AGENT_RESPONSE }],
      warnings: [],
    }),
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'sub-id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: SUB_AGENT_RESPONSE },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 5, outputTokens: 10, totalTokens: 15 },
        },
      ]),
    }),
  });
}

function makeSupervisorModel() {
  let generateCallCount = 0;
  let streamCallCount = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      generateCallCount++;
      if (generateCallCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          finishReason: 'tool-calls' as const,
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          text: '',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'supervisor-call-1',
              toolName: 'agent-subAgent',
              input: JSON.stringify({ prompt: DELEGATION_PROMPT }),
            },
          ],
          warnings: [],
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        finishReason: 'stop' as const,
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        text: 'Done',
        content: [{ type: 'text' as const, text: 'Done' }],
        warnings: [],
      };
    },
    doStream: async () => {
      streamCallCount++;
      if (streamCallCount === 1) {
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'supervisor-call-1',
              toolName: 'agent-subAgent',
              input: JSON.stringify({ prompt: DELEGATION_PROMPT }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
        };
      }
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      };
    },
  });
}

/**
 * Mimics observational memory's turn finalization: persist the run's input and
 * response messages (with their MessageList IDs) while the run is finishing.
 * Records the IDs of persisted input messages so tests can assert the post-run
 * transcript save upserts the same rows.
 */
function makeOmLikeInputPersister(memory: MockMemory, persistedInputIds: string[]): OutputProcessor {
  return {
    id: 'om-like-input-persister',
    async processOutputResult({ messageList }: ProcessOutputResultArgs) {
      const input = messageList.get.input.db();
      persistedInputIds.push(...input.map(m => m.id));
      const toPersist = [...input, ...messageList.get.response.db()];
      if (toPersist.length > 0) {
        await memory.saveMessages({ messages: toPersist });
      }
      return messageList;
    },
  };
}

async function runDelegation({
  method,
  persistInputDuringRun,
}: {
  method: 'generate' | 'stream';
  persistInputDuringRun: boolean;
}) {
  const store = new InMemoryStore();
  const supervisorMemory = new MockMemory({ storage: store });
  const persistedInputIds: string[] = [];

  const subAgent = new Agent({
    id: 'sub-agent-dup-prompt',
    name: 'Sub Agent',
    description: 'A sub-agent without its own memory',
    instructions: 'Answer questions.',
    model: makeSubAgentModel(),
    ...(persistInputDuringRun
      ? { outputProcessors: [makeOmLikeInputPersister(supervisorMemory, persistedInputIds)] }
      : {}),
  });

  const supervisor = new Agent({
    id: 'supervisor-dup-prompt',
    name: 'Supervisor',
    instructions: 'Delegate to the sub-agent.',
    model: makeSupervisorModel(),
    agents: { subAgent },
    memory: supervisorMemory,
  });

  const resourceId = randomUUID();
  const threadId = randomUUID();
  const options = { maxSteps: 3, memory: { resource: resourceId, thread: threadId } };

  if (method === 'generate') {
    await supervisor.generate(DELEGATION_PROMPT, options);
  } else {
    const streamResult = await supervisor.stream(DELEGATION_PROMPT, options);
    for await (const _chunk of streamResult.fullStream) {
      // drain
    }
  }

  // The sub-agent inherits the supervisor's memory; its delegation thread is
  // created under the derived sub-agent resource ID.
  const subAgentResourceId = `${resourceId}-subAgent`;
  const memoryStorage = await store.getStore('memory');
  expect(memoryStorage).toBeDefined();

  const { threads } = await memoryStorage!.listThreads({ filter: { resourceId: subAgentResourceId } });
  expect(threads.length).toBe(1);

  const { messages } = await memoryStorage!.listMessages({ threadId: threads[0]!.id, perPage: 100 });
  return { messages, persistedInputIds };
}

describe.each(['generate', 'stream'] as const)('sub-agent delegation prompt persistence (%s)', method => {
  it('persists the delegation prompt exactly once when nothing else saves during the run', async () => {
    const { messages } = await runDelegation({ method, persistInputDuringRun: false });

    const userMessages = messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBe(1);
    expect(JSON.stringify(userMessages[0]!.content)).toContain(DELEGATION_PROMPT);

    const assistantMessages = messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBe(1);
    expect(JSON.stringify(assistantMessages[0]!.content)).toContain(SUB_AGENT_RESPONSE);
  });

  it('persists the delegation prompt exactly once when a processor persists input mid-run (OM-style)', async () => {
    const { messages, persistedInputIds } = await runDelegation({ method, persistInputDuringRun: true });

    const userMessages = messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBe(1);
    expect(JSON.stringify(userMessages[0]!.content)).toContain(DELEGATION_PROMPT);

    // The mid-run write and the post-run transcript save must target the same
    // row: the persisted prompt keeps the ID the run's MessageList used.
    expect(persistedInputIds).toContain(userMessages[0]!.id);

    const assistantMessages = messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBe(1);
    expect(JSON.stringify(assistantMessages[0]!.content)).toContain(SUB_AGENT_RESPONSE);
  });
});

describe('sub-agent delegation with own memory config (fallback input path)', () => {
  it('still runs and saves the delegation prompt once when the sub-agent has defaultOptions.memory', async () => {
    // When the sub-agent has its own memory config, supervisor memory is NOT
    // injected and the delegation prompt must be passed as plain content — a
    // DB message stamped with the delegation threadId would collide with the
    // sub-agent's own thread and make MessageList throw.
    const subAgentStore = new InMemoryStore();
    const subAgentMemory = new MockMemory({ storage: subAgentStore });

    const subAgent = new Agent({
      id: 'sub-agent-own-memory',
      name: 'Sub Agent Own Memory',
      description: 'A sub-agent with its own memory config',
      instructions: 'Answer questions.',
      model: makeSubAgentModel(),
      memory: subAgentMemory,
      defaultOptions: {
        memory: { thread: 'sub-own-thread', resource: 'sub-own-resource' },
      },
    });

    const supervisor = new Agent({
      id: 'supervisor-own-memory',
      name: 'Supervisor',
      instructions: 'Delegate to the sub-agent.',
      model: makeSupervisorModel(),
      agents: { subAgent },
      memory: new MockMemory({ storage: new InMemoryStore() }),
    });

    let delegationThreadId: string | undefined;
    const result = await supervisor.generate(DELEGATION_PROMPT, {
      maxSteps: 3,
      memory: { resource: randomUUID(), thread: randomUUID() },
      delegation: {
        onDelegationComplete: ctx => {
          delegationThreadId = (ctx.result as { subAgentThreadId?: string } | undefined)?.subAgentThreadId;
        },
      },
    });

    // The run must not throw (threadId validation) and must produce output.
    expect(result.text).toBeDefined();
    expect(delegationThreadId).toBeDefined();

    // The delegation transcript save writes the prompt exactly once to the
    // delegation thread in the sub-agent's own memory.
    const memoryStorage = await subAgentStore.getStore('memory');
    const { messages } = await memoryStorage!.listMessages({ threadId: delegationThreadId!, perPage: 100 });
    const userMessages = messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBe(1);
    expect(JSON.stringify(userMessages[0]!.content)).toContain(DELEGATION_PROMPT);
  });
});
