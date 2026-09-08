/**
 * Durable engine: processToolResult hook integration (Option B placement).
 *
 * The durable loop emits tool-result chunks at tool-call time (the stream is
 * pubsub-backed, not request-scoped), so processToolResult must run there —
 * BEFORE emission — for a redaction processor to protect both the stream and
 * the transcript. Processors mutate via messageList.updateToolInvocation; the
 * processed value travels to llm-mapping through the serialized `result` step
 * output field, because llm-mapping re-derives the transcript from the
 * llm-execution snapshot plus the step outputs.
 *
 * These tests pin the three behaviors:
 *   1. A processor mutation is synced into the returned result AND the emitted
 *      tool-result chunk (raw value never reaches subscribers).
 *   2. A tripwire replaces the tool-result chunk with a tripwire chunk and the
 *      step returns `resultBlocked: true` with no result; llm-mapping leaves
 *      the invocation in 'call' state (commit and emission both skipped).
 *   3. A non-tripwire processor failure is non-fatal: the raw result survives.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { MastraDBMessage } from '../../../message-list';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';
import { createDurableLLMMappingStep } from './llm-mapping';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', async () => ({
  restoreRequestContext: (
    await vi.importActual<typeof import('../../utils/resolve-runtime')>('../../utils/resolve-runtime')
  ).restoreRequestContext,
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
  rebuildRunToolsFromMastra: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'run-result-processors-1';
const AGENT_ID = 'agent-1';
const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'user-1';
const TOOL_NAME = 'lookupSecret';
const TOOL_CALL_ID = 'call-secret-1';
const TOOL_ARGS = { key: 'api' };
const RAW_RESULT = { secret: 'raw-value' };
const REDACTED_RESULT = { secret: '[redacted]' };

function mockPubsub() {
  return { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() };
}

function makeInitData() {
  return {
    runId: RUN_ID,
    agentId: AGENT_ID,
    options: { requireToolApproval: false },
    state: { threadId: THREAD_ID, resourceId: RESOURCE_ID, memoryConfig: undefined, threadExists: true },
  };
}

/** Message list holding the pending 'call' invocation, like llm-execution records it. */
function seedMessageList() {
  const messageList = new MessageList({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
  const assistantMessage: MastraDBMessage = {
    id: 'msg-1',
    role: 'assistant',
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'call', toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS },
        },
      ],
    },
    createdAt: new Date(),
  };
  messageList.add(assistantMessage, 'response');
  return messageList;
}

function setupRegistry(processor: Record<string, unknown>, messageList: MessageList) {
  globalRunRegistry.set(RUN_ID, {
    tools: { [TOOL_NAME]: { execute: vi.fn().mockResolvedValue(RAW_RESULT) } },
    model: {} as any,
    outputProcessors: [processor],
    processorStates: new Map(),
    requestContext: new Map(),
    messageList,
  } as any);
}

function runToolCallStep() {
  const step = createDurableToolCallStep();
  return (step as any).execute({
    inputData: { toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS },
    mastra: { getLogger: () => undefined },
    suspend: vi.fn(),
    resumeData: undefined,
    requestContext: new Map(),
    getInitData: () => makeInitData(),
    [PUBSUB_SYMBOL]: mockPubsub(),
  });
}

function emittedChunksOfType(type: string) {
  return vi
    .mocked(emitChunkEvent)
    .mock.calls.map(([, , chunk]) => chunk as any)
    .filter(chunk => chunk?.type === type);
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable tool-call: processToolResult hook (Option B)', () => {
  it('syncs a processor mutation into the emitted chunk and the step output', async () => {
    const messageList = seedMessageList();
    setupRegistry(
      {
        id: 'redactor',
        name: 'redactor',
        processToolResult: async ({ messageList: ml, toolCallId, toolName, args }: any) => {
          ml.updateToolInvocation({
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId, toolName, args, result: REDACTED_RESULT },
          });
        },
      },
      messageList,
    );

    const output = await runToolCallStep();

    // Step output carries the processed value — this is the only channel by
    // which the value reaches llm-mapping's transcript commit.
    expect(output.error).toBeUndefined();
    expect(output.result).toEqual(REDACTED_RESULT);

    // The emitted tool-result chunk carries the processed value, not the raw one.
    const toolResultChunks = emittedChunksOfType('tool-result');
    expect(toolResultChunks).toHaveLength(1);
    expect(toolResultChunks[0].payload.result).toEqual(REDACTED_RESULT);
  });

  it('replaces the tool-result with a tripwire and blocks the commit when a processor aborts', async () => {
    const messageList = seedMessageList();
    setupRegistry(
      {
        id: 'blocker',
        name: 'blocker',
        processToolResult: async ({ abort }: any) => {
          abort('blocked by test');
        },
      },
      messageList,
    );

    const output = await runToolCallStep();

    // No result crosses the boundary; the call is flagged blocked.
    expect(output.resultBlocked).toBe(true);
    expect(output.result).toBeUndefined();
    expect(output.error).toBeUndefined();

    // A tripwire chunk was emitted instead of the tool-result.
    expect(emittedChunksOfType('tool-result')).toHaveLength(0);
    const tripwires = emittedChunksOfType('tripwire');
    expect(tripwires).toHaveLength(1);
    expect(tripwires[0].payload.reason).toBe('blocked by test');
    expect(tripwires[0].payload.processorId).toBe('blocker');

    // llm-mapping skips the blocked entry: the invocation stays in 'call' state.
    const mappingStep = createDurableLLMMappingStep();
    const mappingOutput = await (mappingStep as any).execute({
      inputData: {
        llmOutput: {
          messageListState: seedMessageList().serialize(),
          stepResult: {
            isContinued: true,
            reason: 'tool-calls',
            totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
          text: '',
          toolCalls: [],
        },
        toolResults: [output],
        runId: RUN_ID,
        agentId: AGENT_ID,
        messageId: 'msg-1',
        state: { threadId: THREAD_ID, resourceId: RESOURCE_ID, threadExists: true },
      },
      mastra: { getLogger: () => undefined },
      requestContext: new Map(),
    });

    const recalled = new MessageList({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
    recalled.deserialize(mappingOutput.messageListState);
    const invocation = recalled.get.all
      .db()
      .flatMap((m: MastraDBMessage) => m.content.parts ?? [])
      .find((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === TOOL_CALL_ID) as any;
    expect(invocation?.toolInvocation?.state).toBe('call');
  });

  it('keeps the raw result when a processor fails with a non-tripwire error', async () => {
    const messageList = seedMessageList();
    setupRegistry(
      {
        id: 'crasher',
        name: 'crasher',
        processToolResult: async () => {
          throw new Error('processor exploded');
        },
      },
      messageList,
    );

    const output = await runToolCallStep();

    // Non-fatal: the raw result survives and the chunk is still emitted.
    expect(output.error).toBeUndefined();
    expect(output.resultBlocked).toBeUndefined();
    expect(output.result).toEqual(RAW_RESULT);
    const toolResultChunks = emittedChunksOfType('tool-result');
    expect(toolResultChunks).toHaveLength(1);
    expect(toolResultChunks[0].payload.result).toEqual(RAW_RESULT);
  });
});
