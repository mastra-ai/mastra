/**
 * Durable engine: provider-executed tool handling.
 *
 * Provider-executed tools (e.g. Anthropic web_search) are handled entirely by
 * the stream path — llm-execution records their call/result chunks. The durable
 * loop had two gaps relative to the non-durable loop:
 *
 *   1. tool-call only passed through provider-executed calls when the output
 *      was already present. A deferred result (output undefined) fell through
 *      to client execution and surfaced as ToolNotFoundError.
 *   2. llm-mapping committed provider-executed results a second time via
 *      updateToolInvocation, overwriting the entry llm-execution had already
 *      committed from the live stream chunk.
 *
 * These tests pin the aligned behavior: tool-call skips client execution for
 * ALL provider-executed calls, and llm-mapping skips the commit for them.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { MastraDBMessage } from '../../../message-list';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
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

const RUN_ID = 'run-provider-executed-1';
const AGENT_ID = 'agent-1';
const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'user-1';
const PROVIDER_CALL_ID = 'call-provider-1';
const CLIENT_CALL_ID = 'call-client-1';

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

function runToolCallStep(inputData: Record<string, unknown>) {
  const step = createDurableToolCallStep();
  return (step as any).execute({
    inputData,
    mastra: { getLogger: () => undefined },
    suspend: vi.fn(),
    resumeData: undefined,
    requestContext: new Map(),
    getInitData: () => makeInitData(),
    [PUBSUB_SYMBOL]: mockPubsub(),
  });
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) globalRunRegistry.delete(RUN_ID);
  vi.clearAllMocks();
});

describe('durable tool-call: provider-executed passthrough', () => {
  it('threads the output through when the provider already delivered it in-stream', async () => {
    const executeMock = vi.fn();
    globalRunRegistry.set(RUN_ID, {
      tools: { someClientTool: { execute: executeMock } },
      model: {} as any,
    } as any);

    const result = await runToolCallStep({
      toolCallId: PROVIDER_CALL_ID,
      toolName: 'web_search',
      args: { query: 'mastra' },
      providerExecuted: true,
      output: { hits: 3 },
    });

    expect(executeMock).not.toHaveBeenCalled();
    expect(result.error).toBeUndefined();
    expect(result.result).toEqual({ hits: 3 });
    expect(result.providerExecuted).toBe(true);
  });

  it('skips client execution for a deferred provider-executed call (no output yet)', async () => {
    const executeMock = vi.fn();
    globalRunRegistry.set(RUN_ID, {
      tools: { someClientTool: { execute: executeMock } },
      model: {} as any,
    } as any);

    // Before the fix this fell through to client execution: `web_search` is
    // not a client tool, so the step errored with ToolNotFoundError.
    const result = await runToolCallStep({
      toolCallId: PROVIDER_CALL_ID,
      toolName: 'web_search',
      args: { query: 'mastra' },
      providerExecuted: true,
    });

    expect(executeMock).not.toHaveBeenCalled();
    expect(result.error).toBeUndefined();
    expect(result.result).toBeUndefined();
    expect(result.providerExecuted).toBe(true);
  });
});

describe('durable llm-mapping: provider-executed commit gate', () => {
  it('does not re-commit provider-executed results but still commits client results', async () => {
    globalRunRegistry.set(RUN_ID, {
      tools: { clientTool: { execute: vi.fn() } },
      model: {} as any,
    } as any);

    // Seed both invocations as state 'call', the way llm-execution records
    // them from the stream. In the real flow the provider-executed one is
    // then patched to 'result' by buildMessagesFromChunks — llm-mapping must
    // not touch it either way, so asserting it stays 'call' proves the skip.
    const messageList = new MessageList({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
    const assistantMessage: MastraDBMessage = {
      id: 'msg-1',
      role: 'assistant',
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              state: 'call',
              toolCallId: PROVIDER_CALL_ID,
              toolName: 'web_search',
              args: { query: 'mastra' },
            },
          },
          {
            type: 'tool-invocation',
            toolInvocation: { state: 'call', toolCallId: CLIENT_CALL_ID, toolName: 'clientTool', args: { x: 1 } },
          },
        ],
      },
      createdAt: new Date(),
    };
    messageList.add(assistantMessage, 'response');

    const step = createDurableLLMMappingStep();
    const output = await (step as any).execute({
      inputData: {
        llmOutput: {
          messageListState: messageList.serialize(),
          stepResult: {
            isContinued: true,
            reason: 'tool-calls',
            totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
          text: '',
          toolCalls: [],
        },
        toolResults: [
          {
            toolCallId: PROVIDER_CALL_ID,
            toolName: 'web_search',
            args: { query: 'mastra' },
            providerExecuted: true,
            result: { hits: 3 },
          },
          {
            toolCallId: CLIENT_CALL_ID,
            toolName: 'clientTool',
            args: { x: 1 },
            result: { ok: true },
          },
        ],
        runId: RUN_ID,
        agentId: AGENT_ID,
        messageId: 'msg-1',
        state: { threadId: THREAD_ID, resourceId: RESOURCE_ID, threadExists: true },
      },
      mastra: { getLogger: () => undefined },
      requestContext: new Map(),
    });

    const recalled = new MessageList({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
    recalled.deserialize(output.messageListState);
    const invocations = recalled.get.all
      .db()
      .flatMap((m: MastraDBMessage) => m.content.parts ?? [])
      .filter((p: any) => p.type === 'tool-invocation')
      .map((p: any) => p.toolInvocation);

    const providerInvocation = invocations.find((i: any) => i.toolCallId === PROVIDER_CALL_ID);
    const clientInvocation = invocations.find((i: any) => i.toolCallId === CLIENT_CALL_ID);

    // Provider-executed: untouched by llm-mapping (no double-commit, no
    // fallback append of a standalone tool message).
    expect(providerInvocation?.state).toBe('call');
    expect(invocations.filter((i: any) => i.toolCallId === PROVIDER_CALL_ID)).toHaveLength(1);

    // Client tool: committed normally.
    expect(clientInvocation?.state).toBe('result');
    expect(clientInvocation?.result).toEqual({ ok: true });
  });
});
