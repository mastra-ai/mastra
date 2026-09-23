/**
 * Reproduction for issue #23295 on the DURABLE agent engine.
 *
 * A tool declared without `execute` is answered by the client on a follow-up request, so
 * the durable loop must end the turn at that call — exactly as the non-durable loop does
 * via its `hasPendingHITL` check. Before this fix the mapping step did the opposite:
 *   - it persisted the pending call as `state: 'result'` with `result: undefined`
 *     (MessageList.mergeToolResultIntoPart replaces the part wholesale, so the transcript
 *     recorded a client tool as resolved-with-nothing), and
 *   - it took `isContinued` from the LLM step, which is `true` for any `tool-calls` finish
 *     reason, so the loop re-invoked the model on that fabricated result.
 *
 * These tests pin createDurableLLMMappingStep directly (deterministic, no workflow engine),
 * following tool-approval-recall.test.ts. They also guard the exclusions in the pending
 * predicate: a declined approval and a tool error both arrive with `result === undefined`
 * but are resolved outcomes, not pending calls, and must keep their existing behaviour.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../../message-list';
import { MessageList } from '../../../message-list';
import { globalRunRegistry } from '../../run-registry';
import { createDurableLLMMappingStep } from './llm-mapping';

vi.mock('../../stream-adapter', () => ({
  emitChunkEvent: vi.fn().mockResolvedValue(undefined),
  emitSuspendedEvent: vi.fn().mockResolvedValue(undefined),
}));

const RUN_ID = 'run-pending-client-tool-1';
const AGENT_ID = 'agent-1';
const TOOL_NAME = 'clientTool';
const TOOL_CALL_ID = 'call-1';
const TOOL_ARGS = { label: 'Done' };
const SERVER_TOOL = 'serverTool';
const SERVER_CALL_ID = 'call-server';
const SERVER_ARGS = { q: 'weather' };
const SERVER_RESULT = { temperature: 21 };
const THREAD_ID = 'thread-1';
const RESOURCE_ID = 'user-1';
const DECLINE_REASON = 'Tool call was not approved by the user';

type SeededCall = { toolCallId: string; toolName: string; args: unknown };

/**
 * Seed a message list with pending tool-calls (state 'call') exactly like the durable LLM
 * execution step does, so the mapping step's updateToolInvocation can resolve them.
 */
function seedMessageListState(calls: SeededCall[]) {
  const messageList = new MessageList({ threadId: THREAD_ID, resourceId: RESOURCE_ID });
  const assistantMessage: MastraDBMessage = {
    id: 'msg-1',
    role: 'assistant',
    content: {
      format: 2,
      parts: calls.map(call => ({
        type: 'tool-invocation' as const,
        toolInvocation: {
          state: 'call' as const,
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          args: call.args,
        },
      })),
    },
    createdAt: new Date(),
  };
  messageList.add(assistantMessage, 'response');
  return messageList.serialize();
}

/**
 * Run the mapping step over `toolResults` for a turn that requested `calls`.
 *
 * `stepResult.isContinued: true` mirrors what the durable LLM execution step produces for
 * a `tool-calls` finish reason — the mapping step is what must override it here.
 */
async function runMappingStep(
  toolResults: unknown[],
  calls: SeededCall[] = [{ toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS }],
) {
  const step = createDurableLLMMappingStep();
  const output = await (step as any).execute({
    inputData: {
      llmOutput: {
        messageListState: seedMessageListState(calls),
        stepResult: {
          isContinued: true,
          reason: 'tool-calls',
          totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
        text: '',
        toolCalls: calls,
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

  const stored = (toolCallId: string) =>
    recalled.get.all
      .db()
      .flatMap((m: MastraDBMessage) => m.content.parts ?? [])
      .find((p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolCallId === toolCallId)?.toolInvocation as
      | Record<string, any>
      | undefined;

  const v6 = (toolCallId: string) =>
    recalled.get.all.aiV6
      .ui()
      .flatMap(m => m.parts)
      .find((p: any) => 'toolCallId' in p && p.toolCallId === toolCallId) as Record<string, any> | undefined;

  return { output, stored, v6 };
}

afterEach(() => {
  if (globalRunRegistry.has(RUN_ID)) {
    globalRunRegistry.delete(RUN_ID);
  }
  vi.clearAllMocks();
});

describe('issue #23295 (durable engine): mapping step stops at a client-executed tool call', () => {
  it('leaves the pending call unanswered and ends the turn', async () => {
    const { output, stored, v6 } = await runMappingStep([
      { toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS, result: undefined },
    ]);

    // The turn ends so the client can answer on a follow-up request, instead of the loop
    // re-invoking the model on a result nobody produced.
    expect(output.stepResult.isContinued).toBe(false);

    // The invocation stays pending rather than being overwritten with an empty result.
    expect(stored(TOOL_CALL_ID)?.state).toBe('call');
    expect(stored(TOOL_CALL_ID)?.result).toBeUndefined();

    // The client sees a call awaiting output, not a completed one.
    expect(v6(TOOL_CALL_ID)?.state).toBe('input-available');
  });

  it('records a resolved call while leaving the pending one unanswered in the same turn', async () => {
    const calls: SeededCall[] = [
      { toolCallId: SERVER_CALL_ID, toolName: SERVER_TOOL, args: SERVER_ARGS },
      { toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS },
    ];

    const { output, stored } = await runMappingStep(
      [
        { toolCallId: SERVER_CALL_ID, toolName: SERVER_TOOL, args: SERVER_ARGS, result: SERVER_RESULT },
        { toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS, result: undefined },
      ],
      calls,
    );

    // The completed server-side call is still committed (issue #21637 parity)...
    expect(stored(SERVER_CALL_ID)?.state).toBe('result');
    expect(stored(SERVER_CALL_ID)?.result).toEqual(SERVER_RESULT);

    // ...while the client-side call stays pending, and the turn ends.
    expect(stored(TOOL_CALL_ID)?.state).toBe('call');
    expect(output.stepResult.isContinued).toBe(false);
  });

  it('treats a falsy-but-present result as resolved', async () => {
    const { output, stored } = await runMappingStep([
      { toolCallId: TOOL_CALL_ID, toolName: TOOL_NAME, args: TOOL_ARGS, result: null },
    ]);

    // Only `undefined` is pending: a tool that legitimately returns null/0/'' resolved.
    expect(stored(TOOL_CALL_ID)?.state).toBe('result');
    expect(stored(TOOL_CALL_ID)?.result).toBeNull();
    expect(output.stepResult.isContinued).toBe(true);
  });

  it('does not treat a provider-executed call as pending', async () => {
    const { output, stored } = await runMappingStep([
      {
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: TOOL_ARGS,
        result: undefined,
        providerExecuted: true,
      },
    ]);

    // Provider-executed calls are not answered by the client, so they must not stop the turn.
    expect(stored(TOOL_CALL_ID)?.state).toBe('result');
    expect(output.stepResult.isContinued).toBe(true);
  });

  it('still records a declined approval as output-denied and keeps looping', async () => {
    const { output, stored } = await runMappingStep([
      {
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: TOOL_ARGS,
        approval: { id: TOOL_CALL_ID, approved: false, reason: DECLINE_REASON },
      },
    ]);

    // A denial has no `result` either, but it is resolved rather than pending.
    expect(stored(TOOL_CALL_ID)?.state).toBe('output-denied');
    expect(stored(TOOL_CALL_ID)?.approval).toMatchObject({ approved: false, reason: DECLINE_REASON });
    expect(output.stepResult.isContinued).toBe(true);
  });

  it('still records a tool error as output-error and keeps looping for self-correction', async () => {
    const { output, stored } = await runMappingStep([
      {
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: TOOL_ARGS,
        error: { name: 'ToolNotFoundError', message: 'Tool "nope" not found' },
      },
    ]);

    // An error has no `result` either, but the model must still see it and retry.
    expect(stored(TOOL_CALL_ID)?.state).toBe('output-error');
    expect(stored(TOOL_CALL_ID)?.errorText).toBe('Tool "nope" not found');
    expect(output.stepResult.isContinued).toBe(true);
  });
});
