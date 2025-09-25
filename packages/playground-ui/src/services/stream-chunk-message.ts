import { BadgeMessage } from '@/components/assistant-ui/tools/badges/agent-badge';
import { mapWorkflowStreamChunkToWatchResult } from '@/domains/workflows/utils';
import { StreamChunk } from '@/types';
import { ThreadMessageLike } from '@assistant-ui/react';
import { ChunkType } from '@mastra/core';
import { ReadonlyJSONObject } from '@mastra/core/stream';
import { flushSync } from 'react-dom';

export interface HandleStreamChunkOptions {
  conversation: ThreadMessageLike[];
  chunk: ChunkType;
}

export const handleStreamChunk = ({ chunk, conversation }: HandleStreamChunkOptions): ThreadMessageLike[] => {
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
        return handleWorkflowChunk({
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
      const lastMessage = conversation[conversation.length - 1];

      handleFinishReason(chunk.payload.stepResult.reason);
      // Only process if the last message is from the assistant
      if (lastMessage && lastMessage.role === 'assistant') {
        // Create a new message with the modelMetadata in metadata
        const updatedMessage: ThreadMessageLike = {
          ...lastMessage,
          metadata: {
            custom: {
              modelMetadata: chunk.payload.metadata.modelMetadata,
            },
          },
        };

        // Replace the last message with the updated one
        return [...conversation.slice(0, -1), updatedMessage];
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
  conversation: ThreadMessageLike[];
  entityName?: string;
}

export const handleWorkflowChunk = ({
  workflowChunk,
  conversation,
  entityName,
}: HandleWorkflowChunkOptions): ThreadMessageLike[] => {
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

interface HandleAgentChunkOptions {
  agentChunk: any;
  conversation: ThreadMessageLike[];
  entityName: string;
}

export const handleAgentChunk = ({
  agentChunk,
  conversation,
  entityName,
}: HandleAgentChunkOptions): ThreadMessageLike[] => {
  switch (agentChunk.type) {
    case 'tool-result': {
      const lastMessage = conversation[conversation.length - 1];
      const contentArray = Array.isArray(lastMessage.content)
        ? lastMessage.content
        : [{ type: 'text', text: lastMessage.content }];

      const newMessage = {
        ...lastMessage,
        content: contentArray.map(part => {
          if (part.type === 'tool-call') {
            const messages: BadgeMessage[] = part.args?.__mastraMetadata?.messages || [];

            const next = {
              ...part,
              toolName: part?.entityName || entityName,
              args: {
                ...part.args,
                __mastraMetadata: {
                  ...part.args?.__mastraMetadata,
                  isStreaming: true,
                  messages: [
                    ...messages.slice(0, -1),
                    {
                      ...messages[messages.length - 1],
                      type: 'tool',
                      toolName: agentChunk.payload.toolName,
                      args: agentChunk.payload.args,
                      toolOutput: agentChunk.payload.result,
                    },
                  ],
                },
              },
            };

            return next;
          }

          return part;
        }),
      };

      return [...conversation.slice(0, -1), newMessage];
    }
    case 'tool-call': {
      const lastMessage = conversation[conversation.length - 1];
      const contentArray = Array.isArray(lastMessage.content)
        ? lastMessage.content
        : [{ type: 'text', text: lastMessage.content }];

      const newMessage = {
        ...lastMessage,
        content: contentArray.map(part => {
          if (part.type === 'tool-call') {
            const messages: BadgeMessage[] = part.args?.__mastraMetadata?.messages || [];

            const next = {
              ...part,
              toolName: part?.entityName || entityName,
              args: {
                ...part.args,
                __mastraMetadata: {
                  ...part.args?.__mastraMetadata,
                  isStreaming: true,
                  messages: [
                    ...messages,
                    {
                      type: 'tool',
                      toolCallId: agentChunk.payload.toolCallId,
                      toolName: agentChunk.payload.toolName,
                      args: {
                        ...agentChunk.payload.args,
                        __mastraMetadata: {
                          ...agentChunk.payload.args?.__mastraMetadata,
                          isStreaming: true,
                        },
                      },
                    },
                  ],
                },
              },
            };

            return next;
          }

          return part;
        }),
      };

      return [...conversation.slice(0, -1), newMessage];
    }
    case 'text-delta': {
      const lastMessage = conversation[conversation.length - 1];
      const contentArray = Array.isArray(lastMessage.content)
        ? lastMessage.content
        : [{ type: 'text', text: lastMessage.content }];

      const newMessage = {
        ...lastMessage,
        content: contentArray.map(part => {
          if (part.type === 'tool-call') {
            const messages: BadgeMessage[] = part.args?.__mastraMetadata?.messages || [];
            const lastMastraMessage = messages[messages.length - 1];

            const nextMessages: BadgeMessage[] =
              lastMastraMessage?.type === 'text'
                ? [
                    ...messages.slice(0, -1),
                    { type: 'text', content: (lastMastraMessage?.content || '') + agentChunk.payload.text },
                  ]
                : [...messages, { type: 'text', content: agentChunk.payload.text }];

            return {
              ...part,
              toolName: part?.entityName || entityName,
              args: {
                ...part.args,
                __mastraMetadata: {
                  ...part.args?.__mastraMetadata,
                  isStreaming: true,
                  messages: nextMessages,
                },
              },
            };
          }

          return part;
        }),
      };

      return [...conversation.slice(0, -1), newMessage];
    }

    case 'tool-output': {
      if (!agentChunk.payload.output.type.startsWith('workflow-')) return [...conversation];

      const lastMessage = conversation[conversation.length - 1];
      const contentArray = Array.isArray(lastMessage.content)
        ? lastMessage.content
        : [{ type: 'text', text: lastMessage.content }];

      const newMessage = {
        ...lastMessage,
        content: contentArray.map(part => {
          if (part.type === 'tool-call') {
            const messages: BadgeMessage[] = part.args?.__mastraMetadata?.messages || [];
            const lastMastraMessage = messages[messages.length - 1];

            const nextMessages: BadgeMessage[] =
              lastMastraMessage?.type === 'tool'
                ? [
                    ...messages.slice(0, -1),
                    {
                      ...lastMastraMessage,
                      args: {
                        ...agentChunk.payload.args,
                        __mastraMetadata: {
                          ...agentChunk.payload.args?.__mastraMetadata,
                          workflowFullState: mapWorkflowStreamChunkToWatchResult(
                            lastMastraMessage.args?.__mastraMetadata?.workflowFullState || {},
                            agentChunk.payload.output as StreamChunk,
                          ),
                          isStreaming: true,
                        },
                      },
                    },
                  ]
                : messages;

            return {
              ...part,
              toolName: part?.entityName || entityName,
              args: {
                ...part.args,
                __mastraMetadata: {
                  ...part.args?.__mastraMetadata,
                  isStreaming: true,
                  messages: nextMessages,
                },
              },
            };
          }

          return part;
        }),
      };

      return [...conversation.slice(0, -1), newMessage];
    }

    default:
    case 'agent-execution-end':
      return [...conversation];
  }
};

interface CreateRootToolAssistantMessageOptions {
  chunk: any;
  entityName: string;
  conversation: ThreadMessageLike[];
  runId: string;
  from: 'AGENT' | 'WORKFLOW';
  networkMetadata: {
    selectionReason?: string;
    input?: string | Record<string, unknown>;
  };
}

export const createRootToolAssistantMessage = ({
  chunk,
  entityName,
  conversation,
  runId,
  from,
  networkMetadata,
}: CreateRootToolAssistantMessageOptions): ThreadMessageLike[] => {
  if (!entityName || !runId) return [...conversation];

  // If there's no assistant message yet, create one
  const newMessage: ThreadMessageLike = {
    role: 'assistant',
    content: [
      {
        type: 'tool-call',
        toolCallId: runId,
        toolName: entityName,
        args: {
          ...chunk?.payload?.args,
          __mastraMetadata: {
            from,
            networkMetadata,
            ...chunk.payload.args?.__mastraMetadata,
            isStreaming: true,
          },
        },
      },
    ],
  };

  return [...conversation, newMessage];
};
