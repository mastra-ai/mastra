import { ChunkType } from '@mastra/core';
import { UIMessage } from 'ai';

export type MastraUIMessage = UIMessage<any, any, any>;

export const toUIMessage = (chunk: ChunkType, conversation: UIMessage[]): MastraUIMessage[] => {
  switch (chunk.type) {
    default:
      return [...conversation];

    case 'text-start': {
      const newMessage: MastraUIMessage = {
        id: chunk.runId,
        role: 'assistant',
        parts: [{ type: 'text', text: '' }],
      };

      return [...conversation, newMessage];
    }

    case 'text-delta': {
      const lastMessage = conversation[conversation.length - 1];
      if (lastMessage && lastMessage.role === 'assistant') {
        const updatedParts = lastMessage.parts.map(part => {
          if (typeof part === 'object' && part.type === 'text') {
            return {
              ...part,
              text: part.text + chunk.payload.text,
            };
          }
          return part;
        });

        const updatedMessage: MastraUIMessage = {
          ...lastMessage,
          parts: updatedParts,
        };

        return [...conversation.slice(0, -1), updatedMessage];
      }

      return [...conversation];
    }

    case 'tool-output': {
      if (chunk.payload.output?.type.startsWith('workflow-')) {
        return handleWorkflowChunk({
          workflowChunk: chunk.payload.output,
          conversation,
          entityName: chunk.payload.toolName,
        });
      }
      // Get the last message (should be the assistant's message)
      const lastMessage = conversation[conversation.length - 1];

      // Only process if the last message is from the assistant and has parts
      if (lastMessage && lastMessage.role === 'assistant') {
        // Find the tool part that this result belongs to
        const updatedParts = lastMessage.parts.map(part => {
          if (
            typeof part === 'object' &&
            part.type === 'dynamic-tool' &&
            part.toolCallId === chunk.payload.toolCallId
          ) {
            const existingToolOutput = (part.input as any)?.__mastraMetadata?.toolOutput || [];

            return {
              ...part,
              input: {
                ...(part.input as any),
                __mastraMetadata: {
                  ...(part.input as any)?.__mastraMetadata,
                  toolOutput: [...existingToolOutput, chunk?.payload?.output],
                },
              },
            };
          }
          return part;
        });

        // Create a new message with the updated parts
        const updatedMessage: MastraUIMessage = {
          ...lastMessage,
          parts: updatedParts,
        };
        // Replace the last message with the updated one
        return [...conversation.slice(0, -1), updatedMessage];
      }

      return [...conversation];
    }

    case 'tool-call': {
      // Get the last message (should be the assistant's message)
      const lastMessage = conversation[conversation.length - 1];

      // Only process if the last message is from the assistant
      if (lastMessage && lastMessage.role === 'assistant') {
        // Create a new message with the tool call part
        const updatedMessage: MastraUIMessage = {
          ...lastMessage,
          parts: [
            ...(lastMessage.parts || []),
            {
              type: 'dynamic-tool',
              toolName: chunk.payload.toolName,
              toolCallId: chunk.payload.toolCallId,
              state: 'input-streaming',
              input: {
                ...chunk.payload.args,
                __mastraMetadata: {
                  ...chunk.payload.args?.__mastraMetadata,
                  isStreaming: true,
                },
              },
            },
          ],
        };

        // Replace the last message with the updated one
        return [...conversation.slice(0, -1), updatedMessage];
      }

      // If there's no assistant message yet, create one
      const newMessage: MastraUIMessage = {
        id: chunk.runId,
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: chunk.payload.toolName,
            toolCallId: chunk.payload.toolCallId,
            state: 'input-streaming',
            input: {
              ...chunk.payload.args,
              __mastraMetadata: {
                ...chunk.payload.args?.__mastraMetadata,
                isStreaming: true,
              },
            },
          },
        ],
      };

      return [...conversation, newMessage];
    }

    case 'tool-result': {
      // Get the last message (should be the assistant's message)
      const lastMessage = conversation[conversation.length - 1];

      // Only process if the last message is from the assistant and has parts
      if (lastMessage && lastMessage.role === 'assistant') {
        // Find the tool part that this result belongs to
        const updatedParts = lastMessage.parts.map(part => {
          if (
            typeof part === 'object' &&
            part.type === 'dynamic-tool' &&
            part.toolCallId === chunk.payload.toolCallId
          ) {
            return {
              type: 'dynamic-tool' as const,
              toolName: part.toolName,
              toolCallId: part.toolCallId,
              state: 'output-available' as const,
              input: part.input,
              output: chunk.payload.result,
            };
          }
          return part;
        });

        // Create a new message with the updated parts
        const updatedMessage: MastraUIMessage = {
          ...lastMessage,
          parts: updatedParts,
        };
        // Replace the last message with the updated one
        return [...conversation.slice(0, -1), updatedMessage];
      }

      return [...conversation];
    }

    case 'error': {
      if (typeof chunk.payload.error === 'string') {
        throw new Error(chunk.payload.error);
      }
      return [...conversation];
    }

    case 'finish': {
      handleFinishReason(chunk.payload.finishReason);
      return [...conversation];
    }

    case 'reasoning-delta': {
      // Get the last message (should be the assistant's message)
      const lastMessage = conversation[conversation.length - 1];

      // Only process if the last message is from the assistant
      if (lastMessage && lastMessage.role === 'assistant') {
        // Find and update the reasoning content type
        const updatedParts = lastMessage.parts.map(part => {
          if (typeof part === 'object' && part.type === 'reasoning') {
            return {
              ...part,
              text: part.text + chunk.payload.text,
            };
          }
          return part;
        });
        // Create a new message with the updated reasoning content
        const updatedMessage: MastraUIMessage = {
          ...lastMessage,
          parts: updatedParts,
        };

        // Replace the last message with the updated one
        return [...conversation.slice(0, -1), updatedMessage];
      }

      // If there's no assistant message yet, create one
      const newMessage: MastraUIMessage = {
        id: chunk.runId,
        role: 'assistant',
        parts: [
          {
            type: 'reasoning',
            text: chunk.payload.text,
          },
        ],
      };

      return [...conversation, newMessage];
    }
  }
};

const handleFinishReason = (finishReason: string) => {
  switch (finishReason) {
    case 'tool-calls':
      throw new Error('Stream finished with reason tool-calls, try increasing maxSteps');
    default:
      break;
  }
};

interface HandleWorkflowChunkOptions {
  workflowChunk: object;
  conversation: UIMessage[];
  entityName: string;
}

const handleWorkflowChunk = ({ workflowChunk, conversation, entityName }: HandleWorkflowChunkOptions): UIMessage[] => {
  const lastMessage = conversation[conversation.length - 1];
  const parts = lastMessage.parts || [];

  const newMessage: MastraUIMessage = {
    ...lastMessage,
    parts: parts.map(part => {
      if (typeof part === 'object' && part.type === 'dynamic-tool') {
        return {
          ...part,
          toolName: entityName,
          input: {
            ...(part.input as any),
            __mastraMetadata: {
              ...(part.input as any)?.__mastraMetadata,
              workflowFullState: workflowChunk,
              isStreaming: true,
            },
          },
        };
      }

      return part;
    }),
  };

  return [...conversation.slice(0, -1), newMessage];
};
