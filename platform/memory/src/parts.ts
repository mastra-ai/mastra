import type { MemoryMessage, MemoryMessageInput, MemoryMessagePart } from './client';

/** Helpers for building and reading the Mastra V2 parts Platform Memory stores. */

export type ToolInvocation = { toolCallId: string; toolName: string; args: unknown; result?: unknown };

export const textPart = (text: string): MemoryMessagePart => ({ type: 'text', text });

export const reasoningPart = (text: string): MemoryMessagePart => ({
  type: 'reasoning',
  reasoning: text,
  details: [{ type: 'text', text }],
});

export const filePart = (data: string, mimeType: string): MemoryMessagePart => ({ type: 'file', data, mimeType });

export function toolPart({ toolCallId, toolName, args, result }: ToolInvocation): MemoryMessagePart {
  return {
    type: 'tool-invocation',
    toolInvocation:
      result === undefined
        ? { state: 'call', toolCallId, toolName, args }
        : { state: 'result', toolCallId, toolName, args, result },
  };
}

/** Records a tool result on the matching tool-invocation part, if any. */
export function attachToolResult(parts: MemoryMessagePart[], toolCallId: string, result: unknown) {
  for (const part of parts) {
    const invocation = part.toolInvocation as (ToolInvocation & { state: string }) | undefined;
    if (part.type === 'tool-invocation' && invocation?.toolCallId === toolCallId) {
      part.toolInvocation = { ...invocation, state: 'result', result };
    }
  }
}

export function textOfParts(parts: readonly MemoryMessagePart[]): string {
  return parts
    .filter(part => part.type === 'text' && typeof part.text === 'string')
    .map(part => part.text as string)
    .join('');
}

/** Builds a message input with `parts` and the joined text as `content`; null when empty. */
export function messageInput(role: MemoryMessageInput['role'], parts: MemoryMessagePart[]): MemoryMessageInput | null {
  if (!parts.length) return null;
  const content = textOfParts(parts);
  return content ? { role, content, parts } : { role, parts };
}

/** A recalled message's parts, falling back to its text for servers that predate parts. */
export function partsOf(message: Pick<MemoryMessage, 'content'> & { parts?: MemoryMessagePart[] }) {
  return message.parts?.length ? message.parts : message.content ? [textPart(message.content)] : [];
}

export function toolInvocationsOf(parts: readonly MemoryMessagePart[]) {
  return parts
    .filter(part => part.type === 'tool-invocation')
    .map(part => part.toolInvocation as ToolInvocation & { state: string });
}

export function reasoningOf(parts: readonly MemoryMessagePart[]): string {
  return parts
    .filter(part => part.type === 'reasoning')
    .map(part => (typeof part.reasoning === 'string' ? part.reasoning : ''))
    .join('');
}
