import { describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../../agent/message-list';
import { MessageList } from '../../../agent/message-list';
import { applyBackgroundToolResult } from './background-task-result-core';

/**
 * Unit coverage for the shared background-task result injector's
 * idempotency/conflict scan.
 *
 * The scan walks the FULL db message list — which includes memory-loaded
 * thread history on both engines — and providers reuse tool-call ids
 * (e.g. `call_0`) on every turn. The scan is therefore keyed by
 * (toolCallId, taskId), not toolCallId alone:
 *
 * - a same-toolCallId part with a DIFFERENT taskId is an earlier dispatch's
 *   record and must be skipped (treating it as a conflict hung
 *   `streamUntilIdle` on the second turn of any memory-backed run);
 * - a matching-taskId part that is already terminal short-circuits
 *   idempotently, or throws if its terminal status disagrees with ours.
 */

function makeAssistantMessage(
  parts: MastraDBMessage['content']['parts'],
  id: string,
  createdAt: Date = new Date(),
): MastraDBMessage {
  return {
    id,
    role: 'assistant',
    content: { format: 2, parts },
    createdAt,
  };
}

function makeBackgroundInvocationPart(opts: {
  toolCallId: string;
  taskId: string;
  status: 'running' | 'completed' | 'failed';
  result: unknown;
}): NonNullable<MastraDBMessage['content']['parts']>[number] {
  return {
    type: 'tool-invocation',
    toolInvocation: {
      state: 'result',
      toolCallId: opts.toolCallId,
      toolName: 'background-work',
      args: { input: 'x' },
      result: opts.result,
    },
    providerMetadata: {
      mastra: { backgroundTask: { taskId: opts.taskId, status: opts.status } },
    },
  } as any;
}

function makeDeps(
  messageList: MessageList,
  params: Partial<Parameters<typeof applyBackgroundToolResult>[0]['params']>,
) {
  const flush = vi.fn().mockResolvedValue(undefined);
  return {
    deps: {
      params: {
        status: 'completed',
        result: { done: true },
        toolCallId: 'call_0',
        toolName: 'background-work',
        runId: 'run-1',
        taskId: 'task-new',
        ...params,
      },
      currentRunId: 'run-1',
      hasResumeData: false,
      args: { input: 'x' },
      messageList,
      baseProviderMetadata: undefined,
      flush,
    },
    flush,
  };
}

describe('applyBackgroundToolResult identity scan', () => {
  it('skips a history part whose toolCallId matches but taskId differs (provider call-id reuse across turns)', async () => {
    const messageList = new MessageList();

    // Turn 1's record, loaded from memory: same provider call id, older task.
    const historyMessage = makeAssistantMessage(
      [
        makeBackgroundInvocationPart({
          toolCallId: 'call_0',
          taskId: 'task-old',
          status: 'completed',
          result: { done: true, turn: 1 },
        }),
      ],
      'history-msg',
      // An earlier turn: history messages always predate the current turn.
      new Date(Date.now() - 60_000),
    );
    messageList.add(historyMessage, 'memory');
    messageList.drainUnsavedMessages();

    // Turn 2's user prompt separates the two assistant messages (without it
    // MessageList would coalesce them into one assistant continuation).
    messageList.add(
      {
        id: 'user-msg-2',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'run it again' }] },
        createdAt: new Date(Date.now() - 1_000),
      } as MastraDBMessage,
      'user',
    );

    // Turn 2's placeholder: same call id, new task, still running.
    const currentMessage = makeAssistantMessage(
      [
        makeBackgroundInvocationPart({
          toolCallId: 'call_0',
          taskId: 'task-new',
          status: 'running',
          result: 'Background task started. Task ID: task-new.',
        }),
      ],
      'current-msg',
    );
    messageList.add(currentMessage, 'response');

    const { deps, flush } = makeDeps(messageList, { taskId: 'task-new', result: { done: true, turn: 2 } });

    // Pre-fix this threw "Background task identity conflict" on the history
    // part and the result never landed (hanging streamUntilIdle).
    await expect(applyBackgroundToolResult(deps)).resolves.toBeUndefined();

    const messages = messageList.get.all.db();
    const history = messages.find(m => m.id === 'history-msg');
    const current = messages.find(m => m.id === 'current-msg');

    // History part untouched.
    const historyPart = history?.content?.parts?.[0] as any;
    expect(historyPart.toolInvocation.result).toEqual({ done: true, turn: 1 });
    expect((historyPart.providerMetadata as any).mastra.backgroundTask).toEqual({
      taskId: 'task-old',
      status: 'completed',
    });

    // Current turn's placeholder got the real result and terminal status.
    const currentPart = current?.content?.parts?.find((p: any) => p.type === 'tool-invocation') as any;
    expect(currentPart.toolInvocation.state).toBe('result');
    expect(currentPart.toolInvocation.result).toEqual({ done: true, turn: 2 });
    expect((currentPart.providerMetadata as any).mastra.backgroundTask).toMatchObject({
      taskId: 'task-new',
      status: 'completed',
    });

    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('short-circuits idempotently when our own taskId is already terminal with the same status', async () => {
    const messageList = new MessageList();
    messageList.add(
      makeAssistantMessage(
        [
          makeBackgroundInvocationPart({
            toolCallId: 'call_0',
            taskId: 'task-1',
            status: 'completed',
            result: { done: true },
          }),
        ],
        'msg-1',
      ),
      'response',
    );

    const { deps, flush } = makeDeps(messageList, { taskId: 'task-1', status: 'completed' });

    await expect(applyBackgroundToolResult(deps)).resolves.toBeUndefined();

    // Early return: no re-write, no flush.
    expect(flush).not.toHaveBeenCalled();
    const part = messageList.get.all.db()[0]?.content?.parts?.[0] as any;
    expect(part.toolInvocation.result).toEqual({ done: true });
  });

  it('still throws on a status conflict for the part this dispatch owns (matching taskId)', async () => {
    const messageList = new MessageList();
    messageList.add(
      makeAssistantMessage(
        [
          makeBackgroundInvocationPart({
            toolCallId: 'call_0',
            taskId: 'task-1',
            status: 'completed',
            result: { done: true },
          }),
        ],
        'msg-1',
      ),
      'response',
    );

    const { deps, flush } = makeDeps(messageList, {
      taskId: 'task-1',
      status: 'failed',
      error: { message: 'boom' },
    });

    await expect(applyBackgroundToolResult(deps)).rejects.toThrow(/Background task status conflict for task "task-1"/);
    expect(flush).not.toHaveBeenCalled();
  });
});

/**
 * A background tool whose input, request context or output failed validation
 * completes with a ValidationError. The mapper is typed to receive only the
 * tool's output, so it must not run on the error, and the error must reach
 * the model as-is, tagged as an error result. Runs on every engine's background path, Inngest included,
 * without per-engine setup. (#30211)
 */
describe('applyBackgroundToolResult toModelOutput', () => {
  function placeholderList() {
    const messageList = new MessageList();
    messageList.add(
      makeAssistantMessage(
        [
          makeBackgroundInvocationPart({
            toolCallId: 'call_0',
            taskId: 'task-1',
            status: 'running',
            result: 'Background task started. Task ID: task-1.',
          }),
        ],
        'msg-1',
      ),
      'response',
    );
    return messageList;
  }

  function resultPart(messageList: MessageList) {
    return messageList.get.all.db()[0]?.content?.parts?.find(p => p.type === 'tool-invocation') as any;
  }

  it('does not map a validation error, so the model reads the error itself', async () => {
    const messageList = placeholderList();
    const validationError = {
      error: true,
      message: 'Tool input validation failed for background-work. query: Required',
      validationErrors: { errors: [], fields: { query: { errors: ['Required'], fields: {} } } },
    };
    const toModelOutput = vi.fn((output: any) => ({ type: 'json', value: { answer: output.answer } }));
    const { deps } = makeDeps(messageList, { taskId: 'task-1', result: validationError });

    await applyBackgroundToolResult({ ...deps, toModelOutput });

    expect(toModelOutput).not.toHaveBeenCalled();
    const part = resultPart(messageList);
    expect(part.toolInvocation.result).toEqual(validationError);
    expect(part.providerMetadata.mastra.modelOutput).toEqual({ type: 'error-json', value: validationError });
  });

  it('still maps a successful result', async () => {
    const messageList = placeholderList();
    const toModelOutput = vi.fn((output: any) => ({ type: 'json', value: { answer: output.answer } }));
    const { deps } = makeDeps(messageList, { taskId: 'task-1', result: { answer: '42', secret: 'internal' } });

    await applyBackgroundToolResult({ ...deps, toModelOutput });

    expect(toModelOutput).toHaveBeenCalledWith({ answer: '42', secret: 'internal' });
    expect(resultPart(messageList).providerMetadata.mastra.modelOutput).toEqual({
      type: 'json',
      value: { answer: '42' },
    });
  });
});
