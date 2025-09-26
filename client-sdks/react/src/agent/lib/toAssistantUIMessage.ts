import { ChunkType } from '@mastra/core';
import { ThreadMessageLike } from '@assistant-ui/react';
import { mapWorkflowStreamChunkToWatchResult, StreamChunk } from './mapWorkflowStreamChunkToWatchResult';

export interface ToAssistantUIMessageOptions {
  conversation: ThreadMessageLike[];
  chunk: ChunkType;
}

export const toAssistantUIMessage = ({ chunk, conversation }: ToAssistantUIMessageOptions): ThreadMessageLike[] => {
  switch (chunk.type) {
    default:
      return [...conversation];

    case 'text-start': {
      const newMessage: ThreadMessageLike = {
        role: 'assistant',
        content: [{ type: 'text', text: '' }],
      };

      return [...conversation, newMessage];
    }

    case 'text-delta': {
      const lastMessage = conversation[conversation.length - 1];
      if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
        const updatedContent = lastMessage.content.map(part => {
          if (typeof part === 'object' && part.type === 'text') {
            return {
              ...part,
              text: part.text + chunk.payload.text,
            };
          }
          return part;
        });

        const updatedMessage: ThreadMessageLike = {
          ...lastMessage,
          content: updatedContent,
        };

        return [...conversation.slice(0, -1), updatedMessage];
      }

      return [...conversation];
    }

    case 'tool-output': {
      if (chunk.payload.output?.type.startsWith('workflow-')) {
        return toWorkflowAssistantUIMessage({
          workflowChunk: chunk.payload.output,
          conversation,
          entityName: chunk.payload.toolName,
        });
      }
      // Get the last message (should be the assistant's message)
      const lastMessage = conversation[conversation.length - 1];

      // Only process if the last message is from the assistant and has content array
      if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
        // Find the tool call content part that this result belongs to
        const updatedContent = lastMessage.content.map(part => {
          if (typeof part === 'object' && part.type === 'tool-call' && part.toolCallId === chunk.payload.toolCallId) {
            const existingToolOutput = part.args?.__mastraMetadata?.toolOutput || [];

            return {
              ...part,
              args: {
                ...part.args,
                __mastraMetadata: {
                  ...part.args?.__mastraMetadata,
                  toolOutput: [...existingToolOutput, chunk?.payload?.output],
                },
              },
            };
          }
          return part;
        });

        // Create a new message with the updated content
        const updatedMessage: ThreadMessageLike = {
          ...lastMessage,
          content: updatedContent,
        };
        // Replace the last message with the updated one
        return [...conversation.slice(0, -1), updatedMessage];
      }

      return [...conversation];
    }

    case 'tool-call': {
      // Update the messages state

      // Get the last message (should be the assistant's message)
      const lastMessage = conversation[conversation.length - 1];

      // Only process if the last message is from the assistant
      if (lastMessage && lastMessage.role === 'assistant') {
        // Create a new message with the tool call part
        const updatedMessage: ThreadMessageLike = {
          ...lastMessage,
          content: Array.isArray(lastMessage.content)
            ? [
                ...lastMessage.content,
                {
                  type: 'tool-call',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: {
                    ...chunk.payload.args,
                    __mastraMetadata: {
                      ...chunk.payload.args?.__mastraMetadata,
                      isStreaming: true,
                    },
                  },
                },
              ]
            : [
                ...(typeof lastMessage.content === 'string' ? [{ type: 'text', text: lastMessage.content }] : []),
                {
                  type: 'tool-call',
                  toolCallId: chunk.payload.toolCallId,
                  toolName: chunk.payload.toolName,
                  args: {
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
      const newMessage: ThreadMessageLike = {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: chunk.payload.toolCallId,
            toolName: chunk.payload.toolName,
            args: {
              ...chunk.payload.args,
              __mastraMetadata: { ...chunk.payload.args?.__mastraMetadata, isStreaming: true },
            },
          },
        ],
      };

      return [...conversation, newMessage];
    }

    case 'tool-result': {
      // Update the messages state

      // Get the last message (should be the assistant's message)
      const lastMessage = conversation[conversation.length - 1];

      // Only process if the last message is from the assistant and has content array
      if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
        // Find the tool call content part that this result belongs to
        const updatedContent = lastMessage.content.map(part => {
          if (typeof part === 'object' && part.type === 'tool-call' && part.toolCallId === chunk.payload.toolCallId) {
            return {
              ...part,
              result: chunk.payload.result,
            };
          }
          return part;
        });

        // Create a new message with the updated content
        const updatedMessage: ThreadMessageLike = {
          ...lastMessage,
          content: updatedContent,
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
      if (chunk.payload.finishReason === 'tool-calls') {
        throw new Error('Stream finished with reason tool-calls, try increasing maxSteps');
      }

      return [...conversation];
    }

    case 'reasoning-delta': {
      // Get the last message (should be the assistant's message)
      const lastMessage = conversation[conversation.length - 1];

      // Only process if the last message is from the assistant
      if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
        // Find and update the reasoning content type
        const updatedContent = lastMessage.content.map(part => {
          if (typeof part === 'object' && part.type === 'reasoning') {
            return {
              ...part,
              text: part.text + chunk.payload.text,
            };
          }
          return part;
        });
        // Create a new message with the updated reasoning content
        const updatedMessage: ThreadMessageLike = {
          ...lastMessage,
          content: updatedContent,
        };

        // Replace the last message with the updated one
        return [...conversation.slice(0, -1), updatedMessage];
      }

      // If there's no assistant message yet, create one
      const newMessage: ThreadMessageLike = {
        role: 'assistant',
        content: [
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

interface ToWorkflowAssistantUIMessageOptions {
  workflowChunk: object;
  conversation: ThreadMessageLike[];
  entityName: string;
}

const toWorkflowAssistantUIMessage = ({
  workflowChunk,
  conversation,
  entityName,
}: ToWorkflowAssistantUIMessageOptions): ThreadMessageLike[] => {
  const lastMessage = conversation[conversation.length - 1];
  const contentArray = Array.isArray(lastMessage.content)
    ? lastMessage.content
    : [{ type: 'text', text: lastMessage.content }];

  const newMessage = {
    ...lastMessage,
    content: contentArray.map(part => {
      if (part.type === 'tool-call') {
        return {
          ...part,
          toolName: part?.entityName || entityName,
          args: {
            ...part.args,
            __mastraMetadata: {
              ...part.args?.__mastraMetadata,
              workflowFullState: mapWorkflowStreamChunkToWatchResult(
                part.args?.__mastraMetadata?.workflowFullState || {},
                workflowChunk as StreamChunk,
              ),
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
