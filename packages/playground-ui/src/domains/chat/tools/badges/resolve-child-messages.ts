import type { toAISdkV5Messages } from '@mastra/ai-sdk/ui';

type AISdkUIMessage = ReturnType<typeof toAISdkV5Messages>[number];

export interface ChildMessage {
  type: 'tool' | 'text';
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  content?: string;
}

/**
 * Extract child messages (tool calls and text) from all assistant
 * messages in order. Used by the agent badge to render a nested sub-agent
 * conversation.
 */
export const resolveToChildMessages = (messages: AISdkUIMessage[]): ChildMessage[] => {
  const assistantParts = messages.flatMap(message => (message.role === 'assistant' ? (message.parts ?? []) : []));
  const childMessages: ChildMessage[] = [];

  for (const part of assistantParts) {
    const toolPart = part as any;
    if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
      const toolName = part.type.substring('tool-'.length);
      const isWorkflow = toolName.startsWith('workflow-');
      childMessages.push({
        type: 'tool',
        toolCallId: toolPart.toolCallId,
        toolName,
        args: toolPart.input,
        toolOutput: isWorkflow ? { ...toolPart.output?.result, runId: toolPart.output?.runId } : toolPart.output,
      });
    }

    if (part.type === 'text') {
      childMessages.push({
        type: 'text',
        content: toolPart.text,
      });
    }
  }

  return childMessages;
};
