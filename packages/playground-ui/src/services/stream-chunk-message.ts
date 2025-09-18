import { BadgeMessage } from '@/components/assistant-ui/tools/badges/agent-badge';
import { mapWorkflowStreamChunkToWatchResult } from '@/domains/workflows/utils';
import { StreamChunk } from '@/types';
import { ThreadMessageLike } from '@assistant-ui/react';
import { ChunkType } from '@mastra/core';
import { flushSync } from 'react-dom';

export interface HandleStreamChunkOptions {
  setMessages: React.Dispatch<React.SetStateAction<ThreadMessageLike[]>>;
  chunk: ChunkType;
  refreshWorkingMemory: () => Promise<void>;

  _sideEffects: {
    assistantMessageAdded: boolean;
    assistantToolCallAddedForUpdater: boolean;
    assistantToolCallAddedForContent: boolean;
    content: string;
    toolCallIdToName: React.RefObject<Record<string, string>>;
  };
}

export const handleStreamChunk = async ({
  chunk,
  setMessages,
  refreshWorkingMemory,
  _sideEffects,
}: HandleStreamChunkOptions) => {
  function updater() {
    setMessages(currentConversation => {
      const message: ThreadMessageLike = {
        role: 'assistant',
        content: [{ type: 'text', text: _sideEffects.content }],
      };

      if (!_sideEffects.assistantMessageAdded) {
        _sideEffects.assistantMessageAdded = true;
        if (_sideEffects.assistantToolCallAddedForUpdater) {
          _sideEffects.assistantToolCallAddedForUpdater = false;
        }
        return [...currentConversation, message];
      }

      if (_sideEffects.assistantToolCallAddedForUpdater) {
        // add as new message item in messages array if tool call was added
        _sideEffects.assistantToolCallAddedForUpdater = false;
        return [...currentConversation, message];
      }
      return [...currentConversation.slice(0, -1), message];
    });
  }

  switch (chunk.type) {
    case 'text-delta': {
      if (_sideEffects.assistantToolCallAddedForContent) {
        // start new content value to add as next message item in messages array
        _sideEffects.assistantToolCallAddedForContent = false;
        _sideEffects.content = chunk.payload.text;
      } else {
        _sideEffects.content += chunk.payload.text;
      }

      updater();
      break;
    }

    case 'tool-output': {
      if (chunk.payload.output?.type.startsWith('workflow-')) {
        handleWorkflowChunk({ workflowChunk: chunk.payload.output, setMessages, entityName: chunk.payload.toolName });
      } else {
        setMessages(currentConversation => {
          // Get the last message (should be the assistant's message)
          const lastMessage = currentConversation[currentConversation.length - 1];

          // Only process if the last message is from the assistant and has content array
          if (lastMessage && lastMessage.role === 'assistant' && Array.isArray(lastMessage.content)) {
            // Find the tool call content part that this result belongs to
            const updatedContent = lastMessage.content.map(part => {
              if (
                typeof part === 'object' &&
                part.type === 'tool-call' &&
                part.toolCallId === chunk.payload.toolCallId
              ) {
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
            return [...currentConversation.slice(0, -1), updatedMessage];
          }
          return currentConversation;
        });
      }

      break;
    }

    case 'tool-call': {
      // Update the messages state
      setMessages(currentConversation => {
        // Get the last message (should be the assistant's message)
        const lastMessage = currentConversation[currentConversation.length - 1];

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

          _sideEffects.assistantToolCallAddedForUpdater = true;
          _sideEffects.assistantToolCallAddedForContent = true;

          // Replace the last message with the updated one
          return [...currentConversation.slice(0, -1), updatedMessage];
        }

        // If there's no assistant message yet, create one
        const newMessage: ThreadMessageLike = {
          role: 'assistant',
          content: [
            { type: 'text', text: _sideEffects.content },
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
        _sideEffects.assistantToolCallAddedForUpdater = true;
        _sideEffects.assistantToolCallAddedForContent = true;
        return [...currentConversation, newMessage];
      });
      _sideEffects.toolCallIdToName.current[chunk.payload.toolCallId] = chunk.payload.toolName;
      break;
    }

    case 'tool-result': {
      // Update the messages state
      setMessages(currentConversation => {
        // Get the last message (should be the assistant's message)
        const lastMessage = currentConversation[currentConversation.length - 1];

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
          return [...currentConversation.slice(0, -1), updatedMessage];
        }
        return currentConversation;
      });
      try {
        const toolName = _sideEffects.toolCallIdToName.current[chunk.payload.toolCallId];
        if (toolName === 'updateWorkingMemory' && chunk.payload.result?.success) {
          await refreshWorkingMemory?.();
        }
      } finally {
        // Clean up
        delete _sideEffects.toolCallIdToName.current[chunk.payload.toolCallId];
      }
      break;
    }

    case 'error': {
      if (typeof chunk.payload.error === 'string') {
        throw new Error(chunk.payload.error);
      }
      break;
    }

    case 'finish': {
      handleFinishReason(chunk.payload.finishReason);
      break;
    }

    case 'reasoning-delta': {
      setMessages(currentConversation => {
        // Get the last message (should be the assistant's message)
        const lastMessage = currentConversation[currentConversation.length - 1];

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
          return [...currentConversation.slice(0, -1), updatedMessage];
        }

        // If there's no assistant message yet, create one
        const newMessage: ThreadMessageLike = {
          role: 'assistant',
          content: [
            {
              type: 'reasoning',
              text: chunk.payload.text,
            },
            { type: 'text', text: _sideEffects.content },
          ],
        };
        return [...currentConversation, newMessage];
      });
      break;
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
  setMessages: React.Dispatch<React.SetStateAction<ThreadMessageLike[]>>;
  entityName: string;
}

export const handleWorkflowChunk = ({ workflowChunk, setMessages, entityName }: HandleWorkflowChunkOptions) => {
  flushSync(() => {
    setMessages(currentConversation => {
      const lastMessage = currentConversation[currentConversation.length - 1];
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

      return [...currentConversation.slice(0, -1), newMessage];
    });
  });
};

interface HandleAgentChunkOptions {
  agentChunk: any;
  setMessages: React.Dispatch<React.SetStateAction<ThreadMessageLike[]>>;
  entityName: string;
}

export const handleAgentChunk = ({ agentChunk, setMessages, entityName }: HandleAgentChunkOptions) => {
  switch (agentChunk.type) {
    case 'tool-result': {
      setMessages(currentConversation => {
        const lastMessage = currentConversation[currentConversation.length - 1];
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

        return [...currentConversation.slice(0, -1), newMessage];
      });
      break;
    }
    case 'tool-call': {
      setMessages(currentConversation => {
        const lastMessage = currentConversation[currentConversation.length - 1];
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

        return [...currentConversation.slice(0, -1), newMessage];
      });
      break;
    }
    case 'text-delta': {
      setMessages(currentConversation => {
        const lastMessage = currentConversation[currentConversation.length - 1];
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

        return [...currentConversation.slice(0, -1), newMessage];
      });
      break;
    }

    case 'tool-output': {
      flushSync(() => {
        setMessages(currentConversation => {
          if (!agentChunk.payload.output.type.startsWith('workflow-')) return currentConversation;

          const lastMessage = currentConversation[currentConversation.length - 1];
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

          return [...currentConversation.slice(0, -1), newMessage];
        });
      });
      break;
    }

    case 'agent-execution-end':
      break;
  }
};

interface CreateRootToolAssistantMessageOptions {
  chunk: any;
  entityName: string;
  setMessages: React.Dispatch<React.SetStateAction<ThreadMessageLike[]>>;
  runId: string;
  _sideEffects: HandleStreamChunkOptions['_sideEffects'];
  from: 'AGENT' | 'WORKFLOW';
  networkMetadata: {
    selectionReason?: string;
    input?: string | Record<string, unknown>;
  };
}

export const createRootToolAssistantMessage = ({
  chunk,
  entityName,
  setMessages,
  runId,
  _sideEffects,
  from,
  networkMetadata,
}: CreateRootToolAssistantMessageOptions) => {
  setMessages(currentConversation => {
    if (!entityName || !runId) return currentConversation;

    // If there's no assistant message yet, create one
    const newMessage: ThreadMessageLike = {
      role: 'assistant',
      content: [
        { type: 'text', text: _sideEffects.content },
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
    _sideEffects.assistantToolCallAddedForUpdater = true;
    _sideEffects.assistantToolCallAddedForContent = true;
    return [...currentConversation, newMessage];
  });
};
