import type { AgentControllerEvent, AgentControllerMessage, AgentControllerMessageContent } from '@mastra/client-js';
import type { MastraDBMessage, MastraMessagePart } from '@mastra/core/agent';

const fallbackCreatedAtByMessageId = new Map<string, Date>();

export function accumulateMessages(messages: MastraDBMessage[], event: AgentControllerEvent): MastraDBMessage[] {
  if (isMessageEvent(event)) {
    const nextMessage = toMastraDBMessage(event.message);
    const existingIndex = messages.findIndex(message => message.id === nextMessage.id);

    if (existingIndex === -1) {
      return [...messages, nextMessage];
    }

    return messages.map((message, index) => (index === existingIndex ? nextMessage : message));
  }

  if (isErrorEvent(event)) {
    return [...messages, toHarnessErrorMessage(event)];
  }

  return messages;
}

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
        const resultPart: MastraMessagePart = {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId,
            toolName: part.name ?? previousInvocation?.toolName ?? '',
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
  return !['text', 'thinking', 'tool_call'].includes(part.type);
}

function toStatusText(part: AgentControllerMessageContent): string | null {
  if (part.type === 'om_thread_title_updated' && part.text) {
    return `Thread title updated: ${part.text}`;
  }

  return part.text ?? null;
}

function isMessageEvent(
  event: AgentControllerEvent,
): event is Extract<AgentControllerEvent, { type: 'message_start' | 'message_update' | 'message_end' }> {
  return event.type === 'message_start' || event.type === 'message_update' || event.type === 'message_end';
}

function isErrorEvent(event: AgentControllerEvent): event is Extract<AgentControllerEvent, { type: 'error' }> {
  return event.type === 'error' && 'error' in event;
}

function toHarnessErrorMessage(event: Extract<AgentControllerEvent, { type: 'error' }>): MastraDBMessage {
  const message = typeof event.error === 'string' ? event.error : (event.error.message ?? 'Controller error');
  const id = `error-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const harnessContent: AgentControllerMessageContent[] = [
    { type: 'harness-error', text: message, ...(event.errorType ? { errorType: event.errorType } : {}) },
  ];

  return {
    id,
    role: 'system',
    createdAt: createdAtForMessage(id),
    content: {
      format: 2,
      parts: [{ type: 'text', text: message }],
      metadata: { harnessContent },
    },
  };
}

function createdAtForMessage(messageId: string): Date {
  const existing = fallbackCreatedAtByMessageId.get(messageId);
  if (existing) return existing;

  const createdAt = new Date();
  fallbackCreatedAtByMessageId.set(messageId, createdAt);
  return createdAt;
}
