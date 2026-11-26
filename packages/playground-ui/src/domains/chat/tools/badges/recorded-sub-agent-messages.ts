import type { AgentMessage } from './agent-badge';

interface SubAgentToolResult {
  toolName: string;
  toolCallId: string;
  result: unknown;
  args: unknown;
}

/** What a sub-agent call returns: its streamed messages, or its tool results and final text. */
export interface SubAgentResult {
  childMessages?: AgentMessage[];
  subAgentResourceId?: string;
  subAgentThreadId?: string;
  subAgentToolResults?: SubAgentToolResult[];
  text?: string;
}

/**
 * The sub-agent's messages as its call recorded them, or `undefined` when the call kept none and they
 * live only in the sub-agent's memory thread (`subAgentThreadId`).
 */
export function getRecordedSubAgentMessages(result: SubAgentResult | undefined): AgentMessage[] | undefined {
  if (result?.childMessages?.length) return result.childMessages;
  if (result?.subAgentToolResults?.length) {
    const messages: AgentMessage[] = result.subAgentToolResults.map(toolResult => ({
      type: 'tool' as const,
      toolName: toolResult.toolName,
      toolCallId: toolResult.toolCallId,
      args: toolResult.args,
      toolOutput: toolResult.result,
    }));
    if (result.text) messages.push({ type: 'text' as const, content: result.text });
    return messages;
  }
  if (result?.text) return [{ type: 'text' as const, content: result.text }];
  return undefined;
}
