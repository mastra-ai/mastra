import { BadgeMessage } from '@/components/assistant-ui/tools/badges/agent-badge';
import { mapWorkflowStreamChunkToWatchResult } from '@/domains/workflows/utils';
import { StreamChunk } from '@/types';
import { ThreadMessageLike } from '@assistant-ui/react';

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
