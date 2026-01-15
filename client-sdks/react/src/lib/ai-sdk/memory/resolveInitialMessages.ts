import { resolveNetworkMessages } from '@mastra/core/agent/message-list';
import { MastraUIMessage } from '../types';

// Re-export resolveNetworkMessages as resolveInitialMessages for backward compatibility
// The core implementation lives in @mastra/core/agent/message-list
export const resolveInitialMessages = (messages: MastraUIMessage[]): MastraUIMessage[] => {
  return resolveNetworkMessages(messages);
};

interface ChildMessage {
  type: 'tool' | 'text';
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  content?: string;
}

export const resolveToChildMessages = (messages: MastraUIMessage[]): ChildMessage[] => {
  const assistantMessage = messages.find(message => message.role === 'assistant');

  if (!assistantMessage) return [];

  const parts = assistantMessage.parts;

  let childMessages: ChildMessage[] = [];

  for (const part of parts) {
    const toolPart = part as any;
    if (part.type.startsWith('tool-')) {
      const toolName = part.type.substring('tool-'.length);
      const isWorkflow = toolName.startsWith('workflow-');
      childMessages.push({
        type: 'tool',
        toolCallId: toolPart.toolCallId,
        toolName: toolName,
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
