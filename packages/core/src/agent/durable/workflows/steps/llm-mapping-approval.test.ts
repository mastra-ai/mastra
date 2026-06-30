import { describe, expect, it } from 'vitest';
import type { MastraToolInvocationPart } from '../../../message-list';
import { MessageList } from '../../../message-list';
import type { DurableToolCallOutput } from '../../types';
import { createDurableLLMMappingStep } from './llm-mapping';

const TOOL_CALL_ID = 'tc-denied-1';
const TOOL_NAME = 'delete-file';

function makeLlmOutput(messageListState: ReturnType<MessageList['serialize']>) {
  return {
    messageListState,
    text: undefined,
    toolCalls: [
      {
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: { path: '/tmp/test.txt' },
      },
    ],
    stepResult: {
      reason: 'tool-calls',
      warnings: [],
      isContinued: true,
    },
  };
}

async function executeMapping(toolResults: DurableToolCallOutput[]) {
  const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'user-1' });
  messageList.add(
    [
      {
        role: 'assistant' as const,
        content: [
          {
            type: 'tool-call' as const,
            toolCallId: TOOL_CALL_ID,
            toolName: TOOL_NAME,
            args: { path: '/tmp/test.txt' },
          },
        ],
      },
    ],
    'response',
  );

  const step = createDurableLLMMappingStep();
  const output = await (step as any).execute({
    inputData: {
      llmOutput: makeLlmOutput(messageList.serialize()),
      toolResults,
      runId: 'run-1',
      agentId: 'agent-1',
      messageId: 'msg-1',
      state: { threadId: 'thread-1', resourceId: 'user-1' },
    },
  });

  const resultList = new MessageList({ threadId: 'thread-1', resourceId: 'user-1' });
  resultList.deserialize(output.messageListState);
  return resultList;
}

describe('durable llm-mapping — tool approval persistence', () => {
  it('persists a declined tool call as state: output-denied with approval metadata', async () => {
    const resultList = await executeMapping([
      {
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: { path: '/tmp/test.txt' },
        approval: {
          id: TOOL_CALL_ID,
          approved: false,
          reason: 'Tool call was not approved by the user',
        },
      },
    ]);

    const messages = resultList.get.all.db();
    const toolPart = messages
      .flatMap(m => m.content.parts)
      .find(
        (p): p is MastraToolInvocationPart =>
          p.type === 'tool-invocation' && (p as MastraToolInvocationPart).toolInvocation?.toolCallId === TOOL_CALL_ID,
      );

    expect(toolPart).toBeDefined();
    expect(toolPart!.toolInvocation.state).toBe('output-denied');
    const deniedInv = toolPart!.toolInvocation as MastraToolInvocationPart['toolInvocation'] & {
      approval?: { id: string; approved: boolean; reason?: string };
      result?: unknown;
    };
    expect(deniedInv.approval).toEqual({
      id: TOOL_CALL_ID,
      approved: false,
      reason: 'Tool call was not approved by the user',
    });
    // No result should be persisted for a denied approval
    expect(deniedInv.result).toBeUndefined();
  });

  it('persists an approved tool call as state: result with approval: { approved: true }', async () => {
    const resultList = await executeMapping([
      {
        toolCallId: TOOL_CALL_ID,
        toolName: TOOL_NAME,
        args: { path: '/tmp/test.txt' },
        result: { deleted: true },
        approval: {
          id: TOOL_CALL_ID,
          approved: true,
        },
      },
    ]);

    const messages = resultList.get.all.db();
    const toolPart = messages
      .flatMap(m => m.content.parts)
      .find(
        (p): p is MastraToolInvocationPart =>
          p.type === 'tool-invocation' && (p as MastraToolInvocationPart).toolInvocation?.toolCallId === TOOL_CALL_ID,
      );

    expect(toolPart).toBeDefined();
    expect(toolPart!.toolInvocation.state).toBe('result');
    const approvedInv = toolPart!.toolInvocation as MastraToolInvocationPart['toolInvocation'] & {
      approval?: { id: string; approved: boolean; reason?: string };
      result?: unknown;
    };
    expect(approvedInv.result).toEqual({ deleted: true });
    expect(approvedInv.approval).toEqual({
      id: TOOL_CALL_ID,
      approved: true,
    });
  });
});
