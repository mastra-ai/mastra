import { BadgeMessage } from '@/components/assistant-ui/tools/badges/agent-badge';
import { ThreadMessageLike } from '@assistant-ui/react';

export const handleNetworkMessageFromMemory = (content: any): ThreadMessageLike => {
  if (content.resourceType === 'workflow') {
    return {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: content.finalResult.runId,
          toolName: content.resourceId,
          result: { runId: content.finalResult.runId },
          args: {
            __mastraMetadata: {
              from: 'WORKFLOW',
              networkMetadata: {
                selectionReason: content?.selectionReason,
                input: content?.input,
              },
            },
          },
        },
      ],
    };
  }

  if (content.resourceType === 'agent') {
    const badgeMessages: BadgeMessage[] = [];
    let toolCalls: Record<string, any> = {};

    // First message is sliced because it's the agent network prompt
    const messages = content.finalResult.messages.slice(1);

    for (const message of messages) {
      if (typeof message.content === 'string') {
        badgeMessages.push({
          type: 'text',
          content: message.content,
        });

        continue;
      }

      for (const part of message.content) {
        if (part.type === 'text') {
          badgeMessages.push({
            type: 'text',
            content: part.content,
          });
        } else if (part.type === 'tool-result') {
          badgeMessages.push({
            type: 'tool',
            toolName: part.toolName,
            toolOutput: part.result, // tool output
            toolCallId: part.toolCallId,
            args: toolCalls?.[part.toolCallId]?.args || {},
          });
        } else if (part.type === 'tool-call') {
          toolCalls[part.toolCallId] = part;
        }
      }
    }

    return {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: content.finalResult.runId,
          toolName: content.resourceId,
          result: { runId: content.finalResult.runId },
          args: {
            __mastraMetadata: {
              from: 'AGENT',
              networkMetadata: {
                selectionReason: content?.selectionReason || '',
                input: content?.input || '',
              },
              messages: badgeMessages,
            },
          },
        },
      ],
    };
  }

  if (content.resourceType === 'tool') {
    return {
      role: 'assistant',
      content: [
        {
          type: 'tool-call',
          toolCallId: content.finalResult.toolCallId,
          toolName: content.resourceId,
          result: content.finalResult.result,
          args: {
            ...content?.input,
            __mastraMetadata: {
              networkMetadata: {
                selectionReason: content?.selectionReason || '',
                input: content?.input || '',
              },
            },
          },
        },
      ],
    };
  }

  return { role: 'assistant', content: [{ type: 'text', text: 'Unknown response' }] };
};
