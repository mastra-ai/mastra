import type { AgentControllerMessage, AgentControllerMessageContent } from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent';

const fallbackCreatedAtByMessageId = new Map<string, Date>();

export function toMastraDBMessage(message: AgentControllerMessage): MastraDBMessage {
  const harnessContent = message.content.filter(isHarnessMetadataContent);

  return {
    id: message.id,
    role: message.role,
    createdAt: createdAtForMessage(message.id),
    content: {
      format: 2,
      parts: toMastraMessageParts(message.content),
      ...(harnessContent.length > 0 ? { metadata: { harnessContent } } : {}),
    },
  };
}

function toMastraMessageParts(content: AgentControllerMessageContent[]): MastraMessagePart[] {
  const parts: MastraMessagePart[] = [];
  const toolPartIndexById = new Map<string, number>();

  for (const part of content) {
    switch (part.type) {
      case 'text':
        if (part.text) parts.push({ type: 'text', text: part.text });
        break;
      case 'thinking':
        if (part.thinking) {
          parts.push({
            type: 'reasoning',
            reasoning: part.thinking,
            details: [{ type: 'text', text: part.thinking }],
          });
        }
        break;
      case 'tool_call': {
        const toolCallId = part.id ?? '';
        toolPartIndexById.set(toolCallId, parts.length);
        parts.push({
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId,
            toolName: part.name ?? '',
            args: part.args,
          },
        });
        break;
      }
      case 'tool_result': {
        const toolCallId = part.id ?? '';
        const existingIndex = toolPartIndexById.get(toolCallId);
        const previousPart = existingIndex === undefined ? undefined : parts[existingIndex];
        const previousInvocation = previousPart?.type === 'tool-invocation' ? previousPart.toolInvocation : undefined;
        const toolName = part.name ?? previousInvocation?.toolName ?? '';
        const resultPart: MastraMessagePart = part.isError
          ? {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'output-error',
                toolCallId,
                toolName,
                args: previousInvocation?.args,
                result: part.result,
                errorText: typeof part.result === 'string' ? part.result : JSON.stringify(part.result),
              },
            }
          : {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId,
                toolName,
                args: previousInvocation?.args,
                result: part.result,
              },
            };

        if (existingIndex === undefined) {
          toolPartIndexById.set(toolCallId, parts.length);
          parts.push(resultPart);
        } else {
          parts[existingIndex] = resultPart;
        }
        break;
      }
      default: {
        const statusText = toStatusText(part);
        if (statusText) parts.push({ type: 'text', text: statusText });
        break;
      }
    }
  }

  return parts;
}

function isHarnessMetadataContent(part: AgentControllerMessageContent): boolean {
  return !['text', 'thinking', 'tool_call', 'tool_result'].includes(part.type);
}

function toStatusText(part: AgentControllerMessageContent): string | null {
  if (part.type === 'om_thread_title_updated' && part.text) {
    return `Thread title updated: ${part.text}`;
  }

  return part.text ?? null;
}

function createdAtForMessage(messageId: string): Date {
  const existing = fallbackCreatedAtByMessageId.get(messageId);
  if (existing) return existing;

  const createdAt = new Date();
  fallbackCreatedAtByMessageId.set(messageId, createdAt);
  return createdAt;
}
