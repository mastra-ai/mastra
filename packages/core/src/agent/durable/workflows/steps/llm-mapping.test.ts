import { describe, expect, it } from 'vitest';
import { MessageList } from '../../../message-list';
import { createDurableLLMMappingStep } from './llm-mapping';

describe('createDurableLLMMappingStep', () => {
  it('preserves denied metadata when mapping durable tool results into MessageList', async () => {
    const initialMessageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    const step = createDurableLLMMappingStep();

    const output = await (step as any).execute({
      inputData: {
        llmOutput: {
          messageListState: initialMessageList.serialize(),
          toolCalls: [],
          stepResult: {
            isContinued: true,
            totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
          },
        },
        toolResults: [
          {
            toolCallId: 'call-1',
            toolName: 'write_file',
            args: { path: 'src/file.ts' },
            result: 'Tool call was not approved by the user',
            denied: true,
            deniedReason: 'Tool call was not approved by the user',
          },
        ],
        runId: 'run-1',
        agentId: 'agent-1',
        messageId: 'message-1',
        state: { threadId: 'thread-1', resourceId: 'resource-1' },
      },
    });

    const mappedMessageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    mappedMessageList.deserialize(output.messageListState);
    const toolPart = (mappedMessageList as any).all
      .db()
      .flatMap((message: any) => message.content.parts)
      .find((part: any) => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-1');

    expect(toolPart.toolInvocation).toMatchObject({
      state: 'result',
      toolCallId: 'call-1',
      toolName: 'write_file',
      result: 'Tool call was not approved by the user',
      denied: true,
      deniedReason: 'Tool call was not approved by the user',
    });
  });
});
