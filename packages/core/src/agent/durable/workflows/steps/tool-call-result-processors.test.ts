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
 *   3. A non-tripwire processor failure is non-fatal but fail-closed: the run
 *      continues with an error placeholder — the raw result never reaches the
 *      stream or the step output (the regular loop rethrows here, so no
 *      engine emits or persists the raw value).
 *   4. A throwing chunk-pipeline processor (processOutputStream) does not
 *      disturb the gated value: the shared ProcessorRunner logs and continues
 *      with the part as it stood after the processToolResult gate
 *      (pre-existing policy, identical in both engines) — the emitted chunk
 *      carries the gated value, never the raw one when a gate is configured.
 *      Value redaction belongs to processToolResult; processOutputStream is
 *      stream-view shaping only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChunkFrom } from '../../../../stream/types';
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

// Production always supplies a logger. An undefined logger makes the runner's
// swallow-catch itself crash (`this.logger.error` TypeErrors), which escapes
// processPart and lands in onProcessorError — a path processor throws never
// take in production. The spies also let tests prove a swallow actually fired.
const noopLogger = { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), trackException: vi.fn() };

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
    mastra: { getLogger: () => noopLogger },
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
    expect(tripwires[0]).toMatchObject({
      runId: RUN_ID,
      from: ChunkFrom.AGENT,
      payload: { reason: 'blocked by test', processorId: 'blocker' },
    });

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
      mastra: { getLogger: () => noopLogger },
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

  it('fails closed with an error placeholder when a processor fails with a non-tripwire error', async () => {
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

    // Non-fatal: the run continues — but the raw result must not survive a
    // throwing processor. Both the step output (persistence channel) and the
    // emitted chunk (stream channel) carry the placeholder instead.
    expect(output.error).toBeUndefined();
    expect(output.resultBlocked).toBeUndefined();
    expect(output.result).toEqual({ error: 'Tool result processing failed' });
    const toolResultChunks = emittedChunksOfType('tool-result');
    expect(toolResultChunks).toHaveLength(1);
    expect(toolResultChunks[0].payload.result).toEqual({ error: 'Tool result processing failed' });
    expect(JSON.stringify(toolResultChunks)).not.toContain('raw-value');
  });

  it('emits the gated value when a chunk-pipeline processor throws (stream falls back to the processToolResult baseline)', async () => {
    const messageList = seedMessageList();
    setupRegistry(
      {
        id: 'gated-stream-crasher',
        name: 'gated-stream-crasher',
        // The authoritative value gate: runs before emission, redacts the raw result.
        processToolResult: async ({ messageList: ml, toolCallId, toolName, args }: any) => {
          ml.updateToolInvocation({
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId, toolName, args, result: REDACTED_RESULT },
          });
        },
        // Stream-view shaping: crashes on the tool-result part.
        processOutputStream: async ({ part }: any) => {
          if (part.type === 'tool-result') {
            throw new Error('stream processor exploded');
          }
          return part;
        },
      },
      messageList,
    );

    const output = await runToolCallStep();

    // The value gate ran before emission: the step output (persistence channel)
    // carries the redacted value.
    expect(output.error).toBeUndefined();
    expect(output.resultBlocked).toBeUndefined();
    expect(output.result).toEqual(REDACTED_RESULT);

    // The stream hook threw, but the shared runner logs and continues with the
    // part as it stood after the processToolResult gate: the chunk is emitted
    // with the gated value — not raw, not dropped.
    const toolResultChunks = emittedChunksOfType('tool-result');
    expect(toolResultChunks).toHaveLength(1);
    expect(toolResultChunks[0].payload.result).toEqual(REDACTED_RESULT);
    expect(JSON.stringify(vi.mocked(emitChunkEvent).mock.calls)).not.toContain('raw-value');
    expect(emittedChunksOfType('tripwire')).toHaveLength(0);

    // The throw actually fired and was swallowed by the runner's catch —
    // guards against this test silently not exercising the crash path.
    expect(noopLogger.error).toHaveBeenCalled();
  });
});
