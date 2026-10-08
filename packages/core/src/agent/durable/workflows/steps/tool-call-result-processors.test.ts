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
 *   4. A throwing chunk-pipeline processor (processOutputStream) fails the
 *      step before the gated tool-result chunk is emitted.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChunkFrom } from '../../../../stream/types';
import type { MastraToolInvocationOptions } from '../../../../tools/types';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { MastraDBMessage } from '../../../message-list';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { emitChunkEvent } from '../../stream-adapter';
import { createDurableLLMMappingStep } from './llm-mapping';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', async () => ({
  ...(await vi.importActual<typeof import('../../utils/resolve-runtime')>('../../utils/resolve-runtime')),
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(false),
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

// Production always supplies a logger; the spies let tests assert non-fatal warnings.
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
    saveQueueManager: {},
  } as any);
}

function runToolCallStep(
  mastra: Record<string, unknown> = { getLogger: () => noopLogger },
  requestContextEntries?: Record<string, unknown>,
) {
  const step = createDurableToolCallStep();
  return (step as any).execute({
    inputData: { toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS },
    mastra,
    suspend: vi.fn(),
    resumeData: undefined,
    requestContext: new Map(),
    getInitData: () => ({ ...makeInitData(), requestContextEntries }),
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
  it.each(['placeholder', 'empty'] as const)(
    'rehydrates output processors before emitting a tool result from a %s registry',
    async registryState => {
      const seen: string[] = [];
      const outputProcessor = {
        id: 'resumed-tool-result-watcher',
        name: 'resumed-tool-result-watcher',
        processOutputStream: async ({ part, requestContext }: any) => {
          seen.push(part.type);
          expect(requestContext?.get('tenantId')).toBe('redacted-tenant');
          return { ...part, payload: { ...part.payload, result: REDACTED_RESULT } };
        },
      };
      const execute = vi.fn().mockResolvedValue(RAW_RESULT);
      const agent = {
        getToolsForExecution: vi.fn().mockResolvedValue({ [TOOL_NAME]: { execute } }),
        getMemory: vi.fn().mockResolvedValue(undefined),
        getWorkspace: vi.fn().mockResolvedValue(undefined),
        listInputProcessors: vi.fn().mockResolvedValue([]),
        listOutputProcessors: vi.fn().mockResolvedValue([outputProcessor]),
        __resolveRunErrorProcessors: vi.fn().mockResolvedValue({ errorProcessors: [] }),
        __listLLMRequestProcessors: vi.fn().mockResolvedValue([]),
      };
      if (registryState === 'placeholder') {
        globalRunRegistry.set(RUN_ID, {
          isPlaceholder: true,
          tools: {},
          model: undefined as any,
          requestContext: new Map(),
        } as any);
      }

      const output = await runToolCallStep(
        {
          getAgentById: vi.fn().mockReturnValue(agent),
          getLogger: () => noopLogger,
          listTools: () => ({}),
        },
        { tenantId: 'redacted-tenant' },
      );

      expect(output.result).toEqual(RAW_RESULT);
      expect(execute).toHaveBeenCalledOnce();
      expect(seen).toEqual(['tool-result']);
      expect(globalRunRegistry.get(RUN_ID)).toMatchObject({ outputProcessors: [outputProcessor] });
      expect(globalRunRegistry.get(RUN_ID)?.processorStates).toBeInstanceOf(Map);
      expect(vi.mocked(emitChunkEvent)).toHaveBeenCalledWith(
        expect.anything(),
        RUN_ID,
        expect.objectContaining({ type: 'tool-result', payload: expect.objectContaining({ result: REDACTED_RESULT }) }),
        true,
      );
      expect(JSON.stringify(vi.mocked(emitChunkEvent).mock.calls)).not.toContain('raw-value');
    },
  );

  it('fails closed when output processors cannot be rebuilt on a cold worker', async () => {
    const execute = vi.fn().mockResolvedValue(RAW_RESULT);
    const agent = {
      getToolsForExecution: vi.fn().mockResolvedValue({ [TOOL_NAME]: { execute } }),
      listOutputProcessors: vi.fn().mockRejectedValue(new Error('processor rebuild failed')),
    };

    await expect(
      runToolCallStep({
        getAgentById: () => agent,
        getLogger: () => noopLogger,
      }),
    ).rejects.toThrow('processor rebuild failed');
    expect(execute).not.toHaveBeenCalled();
    expect(emittedChunksOfType('tool-result')).toHaveLength(0);
  });

  it('preserves live output processors and state when rebuilding only the save queue', async () => {
    const processOutputStream = vi.fn(async ({ part }: any) => part);
    const processor = { id: 'live-processor', processOutputStream };
    setupRegistry(processor, seedMessageList());
    const entry = globalRunRegistry.get(RUN_ID)!;
    entry.saveQueueManager = undefined;
    const processorStates = entry.processorStates;
    const listOutputProcessors = vi.fn().mockRejectedValue(new Error('must not rebuild live processors'));

    await runToolCallStep({
      getLogger: () => noopLogger,
      getAgentById: () => ({
        getToolsForExecution: vi.fn().mockResolvedValue({}),
        listOutputProcessors,
      }),
    });

    expect(listOutputProcessors).not.toHaveBeenCalled();
    expect(entry.outputProcessors).toEqual([processor]);
    expect(entry.processorStates).toBe(processorStates);
    expect(processOutputStream).toHaveBeenCalledOnce();
  });

  it('provides a live conversation reader to tool execution', async () => {
    const messageList = seedMessageList();
    setupRegistry({}, messageList);
    const entry = globalRunRegistry.get(RUN_ID)!;
    let getMessages: MastraToolInvocationOptions['getMessages'];
    const execute = vi.fn(async (_args: unknown, options: MastraToolInvocationOptions) => {
      getMessages = options.getMessages;
      expect(getMessages?.().map(message => message.id)).toEqual(['msg-1']);
      return RAW_RESULT;
    });
    entry.tools = { [TOOL_NAME]: { execute } };
    const output = await runToolCallStep();
    expect(output.error).toBeUndefined();
    expect(execute).toHaveBeenCalledOnce();
    expect(getMessages).toBeTypeOf('function');
    messageList.removeByIds(['msg-1']);
    expect(getMessages?.()).toEqual([]);
  });

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

  it('fails before emitting a gated tool-result when a chunk-pipeline processor throws', async () => {
    const messageList = seedMessageList();
    setupRegistry(
      {
        id: 'gated-stream-crasher',
        name: 'gated-stream-crasher',
        processToolResult: async ({ messageList: ml, toolCallId, toolName, args }: any) => {
          ml.updateToolInvocation({
            type: 'tool-invocation',
            toolInvocation: { state: 'result', toolCallId, toolName, args, result: REDACTED_RESULT },
          });
        },
        processOutputStream: async ({ part }: any) => {
          if (part.type === 'tool-result') {
            throw new Error('stream processor exploded');
          }
          return part;
        },
      },
      messageList,
    );

    await expect(runToolCallStep()).rejects.toThrow('stream processor exploded');
    expect(emittedChunksOfType('tool-result')).toHaveLength(0);
    expect(emittedChunksOfType('tripwire')).toHaveLength(0);
    expect(JSON.stringify(vi.mocked(emitChunkEvent).mock.calls)).not.toContain('raw-value');
  });

  it('keeps the step alive when publishing a processed tool-result chunk fails', async () => {
    const messageList = seedMessageList();
    setupRegistry(
      {
        id: 'passthrough',
        name: 'passthrough',
        processOutputStream: async ({ part }: any) => part,
      },
      messageList,
    );
    vi.mocked(emitChunkEvent).mockRejectedValueOnce(new Error('pubsub closed'));

    const output = await runToolCallStep();

    expect(output.error).toBeUndefined();
    expect(output.result).toEqual(RAW_RESULT);
    expect(noopLogger.warn).toHaveBeenCalledWith(expect.stringContaining('pubsub closed'));
  });

  it('keeps the step alive when publishing a processor writer chunk fails', async () => {
    const messageList = seedMessageList();
    setupRegistry(
      {
        id: 'progress-writer',
        name: 'progress-writer',
        processOutputStream: async ({ part, writer }: any) => {
          await writer.custom({ type: 'data-progress', data: { step: 'redacting' } });
          return part;
        },
      },
      messageList,
    );
    vi.mocked(emitChunkEvent).mockRejectedValueOnce(new Error('pubsub closed'));

    const output = await runToolCallStep();

    expect(output.error).toBeUndefined();
    expect(output.result).toEqual(RAW_RESULT);
    expect(noopLogger.warn).toHaveBeenCalledWith(expect.stringContaining('pubsub closed'));
    expect(JSON.stringify(vi.mocked(emitChunkEvent).mock.calls)).not.toContain('raw-value');
  });
});
