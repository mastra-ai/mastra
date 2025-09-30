import { ThreadMessageLike } from '@assistant-ui/react';
import { NetworkChunkType, ReadonlyJSONObject } from '@mastra/core/stream';

import { mapWorkflowStreamChunkToWatchResult } from '@/domains/workflows/utils';
import { StreamChunk } from '@/types';
import { BadgeMessage } from '@/components/assistant-ui/tools/badges/agent-badge';
import { handleStreamChunk, handleWorkflowChunk } from './stream-chunk-message';

export interface ToNetworkAssistantUIMessageOptions {
  conversation: ThreadMessageLike[];
  chunk: NetworkChunkType;
}
export const toNetworkAssistantUIMessage = ({
  conversation,
  chunk,
}: ToNetworkAssistantUIMessageOptions): ThreadMessageLike[] => {
  if (chunk.type.startsWith('agent-execution-event-')) {
    const agentChunk = chunk.payload;

    const lastMessage = conversation[conversation.length - 1];
    const contentArray = Array.isArray(lastMessage.content)
      ? lastMessage.content
      : [{ type: 'text', text: lastMessage.content }];

    const currentEntityId = contentArray.find(part => part.type === 'tool-call')?.args?.primitiveId;

    if (!currentEntityId) return conversation;

    return toNetworkAgentAssistantUIMessage({ agentChunk, conversation, entityName: currentEntityId });
  } else if (chunk.type === 'tool-execution-start') {
    const { args: argsData } = chunk.payload;

    const nestedArgs = argsData.args || {};
    const mastraMetadata = argsData.__mastraMetadata || {};
    const selectionReason = argsData.selectionReason || '';

    return handleStreamChunk({
      chunk: {
        ...chunk,
        type: 'tool-call',
        payload: {
          ...chunk.payload,
          toolCallId: argsData.toolCallId || 'unknown',
          toolName: argsData.toolName || 'unknown',
          args: {
            ...nestedArgs,
            __mastraMetadata: {
              ...mastraMetadata,
              networkMetadata: {
                selectionReason,
                input: nestedArgs as ReadonlyJSONObject,
              },
            },
          },
        },
      },
      conversation,
    });
  } else if (chunk.type === 'tool-execution-end') {
    const next = handleStreamChunk({
      chunk: { ...chunk, type: 'tool-result' },
      conversation,
    });

    return next;
  } else if (chunk.type.startsWith('workflow-execution-event-')) {
    const workflowChunk = chunk.payload as object;

    //if (!currentEntityId) return conversation;
    const currentEntityId = '';

    return handleWorkflowChunk({ workflowChunk, conversation, entityName: currentEntityId });
  } else if (chunk.type === 'workflow-execution-start' || chunk.type === 'agent-execution-start') {
    const currentEntityId = chunk.payload?.args?.primitiveId;

    const runId = chunk.payload.runId;

    if (!currentEntityId || !runId) return conversation;

    return createRootToolAssistantMessage({
      entityName: currentEntityId,
      conversation,
      runId,
      chunk,
      from: chunk.type === 'agent-execution-start' ? 'AGENT' : 'WORKFLOW',
      networkMetadata: {
        selectionReason: chunk?.payload?.args?.selectionReason || '',
        input: chunk?.payload?.args?.prompt,
      },
    });
  } else if (chunk.type === 'network-execution-event-step-finish') {
    return [...conversation, { role: 'assistant', content: [{ type: 'text', text: chunk?.payload?.result || '' }] }];
  } else {
    return handleStreamChunk({ chunk, conversation });
  }
};

interface ToNetworkAgentAssistantUIMessageOptions {
  agentChunk: any;
  conversation: ThreadMessageLike[];
  entityName: string;
}

export const toNetworkAgentAssistantUIMessage = ({
  agentChunk,
  conversation,
  entityName,
}: ToNetworkAgentAssistantUIMessageOptions): ThreadMessageLike[] => {
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
