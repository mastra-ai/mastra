import { ChunkType } from '@mastra/core';
import { ThreadMessageLike } from '@assistant-ui/react';
import { mapWorkflowStreamChunkToWatchResult, StreamChunk } from './utils/mapWorkflowStreamChunkToWatchResult';
import { ReadonlyJSONObject } from '@mastra/core/stream';

export interface ToAssistantUIMessageOptions {
  conversation: ThreadMessageLike[];
  chunk: ChunkType;
}

export const toStreamAssistantUIMessage = ({
  chunk,
  conversation,
}: ToAssistantUIMessageOptions): ThreadMessageLike[] => {
  switch (chunk.type) {
    case 'start': {
      const newMessage: ThreadMessageLike = {
        role: 'assistant',
        content: [],
      };

      return [...conversation, newMessage];
    }

    case 'text-start':
    case 'text-delta': {
      // Always add a new last text chunk if one doesn't exist yet to maintain content ordering
      const lastMessage = conversation[conversation.length - 1];
      if (!lastMessage) return conversation;

      if (
        lastMessage.role === 'assistant' &&
        typeof lastMessage.content !== `string` &&
        (!lastMessage.content ||
          lastMessage.content.length === 0 ||
          lastMessage.content[lastMessage.content.length - 1]?.type !== `text`)
      ) {
        return [
          ...conversation.slice(0, -1),
          {
            ...lastMessage,
            content: [...(lastMessage.content || []), { type: 'text', text: '' }],
          },
        ];
      }

      // if we're text start then all we need is the empty text part above
      if (chunk.type === `text-start`) return conversation;

      // otherwise continue to append the text deltas
      if (typeof lastMessage.content === `string`) {
        return [
          ...conversation.slice(0, -1),
          {
            ...lastMessage,
            content: lastMessage.content + chunk.payload.text,
          },
        ];
      }

      const lastPart = lastMessage.content?.[lastMessage.content.length - 1];
      if (!lastPart || lastPart.type !== `text`) return conversation;

      return [
        ...conversation.slice(0, -1),
        {
          ...lastMessage,
          content: [...lastMessage.content.slice(0, -1), { ...lastPart, text: lastPart.text + chunk.payload.text }],
        },
      ];
    }

    case 'tool-output': {
      if (chunk.payload.output?.type.startsWith('workflow-')) {
        return toWorkflowAssistantUIMessage({
          workflowChunk: chunk.payload.output,
          conversation,
          entityName: chunk.payload.toolName || '',
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
              __mastraMetadata: {
                ...(chunk.payload.args?.__mastraMetadata as ReadonlyJSONObject),
                isStreaming: true,
              },
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
      if (chunk.payload.stepResult.reason === 'tool-calls') {
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

    default:
      return [...conversation];
  }
};

interface ToWorkflowAssistantUIMessageOptions {
  workflowChunk: object;
  conversation: ThreadMessageLike[];
  entityName: string;
}

export const toWorkflowAssistantUIMessage = ({
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
