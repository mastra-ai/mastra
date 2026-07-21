/**
 * Reproduction for issue #17218 on the DURABLE agent engine.
 *
 * The durable loop keeps its own copy of the tool-call + mapping steps. Before this fix
 * they had the same write-path gap as the non-durable loop: a declined approval was
 * persisted as a plain successful `result` string (no `output-denied`, no `approval`),
 * and an approval dropped the `approval` field — so neither round-tripped on recall.
 *
 * These tests pin the two changed steps directly (deterministic, no workflow engine):
 *   - createDurableToolCallStep: a decline returns `approval { approved: false }` and NO
 *     `result`; an approve returns the tool result tagged with `approval { approved: true }`.
 *   - createDurableLLMMappingStep: a declined tool result persists as `output-denied` with
 *     `approval`; an approved one persists as `result` carrying `approval` — and both
 *     round-trip to the expected AI SDK v6 UI parts.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PUBSUB_SYMBOL } from '../../../../workflows/constants';
import type { MastraDBMessage } from '../../../message-list';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { createDurableLLMMappingStep } from './llm-mapping';
import { createDurableToolCallStep } from './tool-call';

vi.mock('../../utils/resolve-runtime', () => ({
  resolveTool: vi.fn(),
  toolRequiresApproval: vi.fn().mockResolvedValue(true),
}));

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'run-approval-1';
const AGENT_ID = 'agent-1';
const TOOL_NAME = 'findUserTool';
const TOOL_CALL_ID = 'call-1';
const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'user-1';
const DECLINE_REASON = 'Tool call was not approved by the user';
const TOOL_ARGS = { name: 'Dero Israel' };
const TOOL_RESULT = { name: 'Dero Israel', email: 'dero@mail.com' };

function mockPubsub() {
  return { publish: vi.fn(), subscribe: vi.fn(), unsubscribe: vi.fn(), flush: vi.fn() };
}

function makeInitData() {
  return {
    runId: RUN_ID,
    agentId: AGENT_ID,
    options: { requireToolApproval: true },
    state: { threadId: THREAD_ID, resourceId: RESOURCE_ID, memoryConfig: undefined, threadExists: true },
  };
}

function setupRegistry(execute: (...args: any[]) => any) {
  globalRunRegistry.set(RUN_ID, {
    tools: { [TOOL_NAME]: { execute } },
    requireToolApproval: true,
    model: {} as any,
  } as any);
}

function runToolCallStep(resumeData: unknown) {
  const step = createDurableToolCallStep();
  return (step as any).execute({
    inputData: { toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS },
    mastra: { getLogger: () => undefined },
    suspend: vi.fn(),
    resumeData,
    requestContext: new Map(),
    getInitData: () => makeInitData(),
    [PUBSUB_SYMBOL]: mockPubsub(),
  });
}

/**
 * Seed a message list with a pending tool-call (state 'call') exactly like the durable
 * LLM execution step does, so the mapping step's updateToolInvocation can resolve it.
 */
function seedMessageListState() {
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
  return messageList.serialize();
}

async function runMappingStep(toolResults: unknown[]) {
  const step = createDurableLLMMappingStep();
  const output = await (step as any).execute({
    inputData: {
      llmOutput: {
        messageListState: seedMessageListState(),
        stepResult: {
          isContinued: true,
          reason: 'tool-calls',
          totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
        text: '',
        toolCalls: [],
      },
      toolResults,
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

  const stored = recalled.get.all
    .db()
    .flatMap((m: MastraDBMessage) => m.content.parts ?? [])
    .find((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === TOOL_CALL_ID)?.toolInvocation as
    Record<string, any> | undefined;

  const v6 = recalled.get.all.aiV6
    .ui()
    .flatMap(m => m.parts)
    .find((p: any) => 'toolCallId' in p && p.toolCallId === TOOL_CALL_ID) as Record<string, any> | undefined;

  return { stored, v6 };
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) {
    globalRunRegistry.delete(RUN_ID);
  }
  vi.clearAllMocks();
});

describe('issue #17218 (durable engine): tool-call step records the approval decision', () => {
  it('decline returns approval { approved: false } with the reason and NO result', async () => {
    const execute = vi.fn().mockResolvedValue(TOOL_RESULT);
    setupRegistry(execute);

    const result = await runToolCallStep({ approved: false });

    // The declined tool must NOT run.
    expect(execute).not.toHaveBeenCalled();
    // It must return the approval decision (not a `result` string) so the mapping step can
    // persist it as `output-denied`.
    expect(result.result).toBeUndefined();
    expect(result.approval).toEqual({ id: TOOL_CALL_ID, approved: false, reason: DECLINE_REASON });
  });

  it('approve returns the tool result tagged with approval { approved: true }', async () => {
    const execute = vi.fn().mockResolvedValue(TOOL_RESULT);
    setupRegistry(execute);

    const result = await runToolCallStep({ approved: true });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.result).toEqual(TOOL_RESULT);
    expect(result.approval).toEqual({ id: TOOL_CALL_ID, approved: true });
  });
});

describe('issue #17218 (durable engine): mapping step round-trips approvals on recall', () => {
  it('a declined tool result persists as output-denied + approval and recalls as a v6 output-denied part', async () => {
    const { stored, v6 } = await runMappingStep([
      {
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: TOOL_ARGS,
        approval: { id: TOOL_CALL_ID, approved: false, reason: DECLINE_REASON },
      },
    ]);

    // Stored MastraToolInvocation is a denial, not a plain successful result.
    expect(stored).toBeDefined();
    expect(stored?.state).toBe('output-denied');
    expect(stored?.result).toBeUndefined();
    expect(stored?.approval).toMatchObject({ approved: false, reason: DECLINE_REASON });

    // Recalled v6 UI part reflects the denial.
    expect(v6).toBeDefined();
    expect(v6?.state).toBe('output-denied');
    expect(v6?.approval).toMatchObject({ approved: false, reason: DECLINE_REASON });
  });

  it('an approved tool result persists the approval and recalls it on the v6 output-available part', async () => {
    const { stored, v6 } = await runMappingStep([
      {
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: TOOL_ARGS,
        result: TOOL_RESULT,
        approval: { id: TOOL_CALL_ID, approved: true },
      },
    ]);

    expect(stored).toBeDefined();
    expect(stored?.state).toBe('result');
    expect(stored?.result).toEqual(TOOL_RESULT);
    expect(stored?.approval).toMatchObject({ approved: true });

    expect(v6).toBeDefined();
    expect(v6?.state).toBe('output-available');
    expect(v6?.approval).toMatchObject({ approved: true });
  });
});
