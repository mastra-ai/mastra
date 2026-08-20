import type { toAISdkV5Messages } from '@mastra/ai-sdk/ui';
import type { AgentMessage } from './agent-badge';

type AISdkUIMessage = ReturnType<typeof toAISdkV5Messages>[number];

/**
 * Extract child messages (tool calls and text) from every assistant message in
 * a list. Used by the agent badge to render a nested sub-agent conversation.
 */
export const resolveToChildMessages = (messages: AISdkUIMessage[]): AgentMessage[] => {
  const childMessages: AgentMessage[] = [];

  for (const assistantMessage of messages) {
    if (assistantMessage.role !== 'assistant') continue;

    for (const part of assistantMessage.parts ?? []) {
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
  }

  return childMessages;
};
