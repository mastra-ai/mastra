import { ExtendedMastraUIMessage, MastraUIMessage } from '../types';

// Type definitions for parsing network execution data
interface ToolCallPayload {
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
  providerMetadata?: Record<string, unknown>;
}

interface ToolCall {
  type: string;
  runId: string;
  from: string;
  payload: ToolCallPayload;
}

interface NestedMessage {
  role: string;
  id: string;
  createdAt: string;
  type: string;
  content?: string | ToolResultContent[];
}

interface ToolResultContent {
  type: string;
  toolCallId: string;
  toolName: string;
  result?: {
    result?: Record<string, unknown>;
  };
}

interface FinalResult {
  text?: string;
  toolCalls?: ToolCall[];
  messages?: NestedMessage[];
}

interface NetworkExecutionData {
  isNetwork: boolean;
  selectionReason?: string;
  primitiveType?: string;
  primitiveId?: string;
  input?: string;
  finalResult?: FinalResult;
  toolCalls?: ToolCall[];
  messages?: NestedMessage[];
}

interface ChildMessage {
  type: 'tool' | 'text';
  toolCallId?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  toolOutput?: Record<string, unknown>;
  content?: string;
}

export const resolveInitialMessages = (messages: MastraUIMessage[]): MastraUIMessage[] => {
  return messages.map(message => {
    // Check if message contains network execution data
    const networkPart = message.parts.find(part => part.type === 'text' && part.text.includes('"isNetwork":true'));

    if (networkPart && networkPart.type === 'text') {
      try {
        const json: NetworkExecutionData = JSON.parse(networkPart.text);

        if (json.isNetwork === true) {
          // Extract network execution data
          const selectionReason = json.selectionReason || '';
          const primitiveType = json.primitiveType || '';
          const primitiveId = json.primitiveId || '';
          const finalResult = json.finalResult;
          const toolCalls = finalResult?.toolCalls || [];

          // Build child messages from nested messages
          const childMessages: ChildMessage[] = [];

          // Process tool calls from the network agent
          for (const toolCall of toolCalls) {
            if (toolCall.type === 'tool-call' && toolCall.payload) {
              const toolCallId = toolCall.payload.toolCallId;

              let toolResult;

              for (const message of finalResult?.messages || []) {
                for (const part of message.content || []) {
                  if (typeof part === 'object' && part.type === 'tool-result' && part.toolCallId === toolCallId) {
                    toolResult = part;
                    break;
                  }
                }
              }

              const isWorkflow = Boolean(toolResult?.result?.result?.steps);

              childMessages.push({
                type: 'tool' as const,
                toolCallId: toolCall.payload.toolCallId,
                toolName: toolCall.payload.toolName,
                args: toolCall.payload.args,
                toolOutput: isWorkflow ? toolResult?.result?.result : toolResult?.result,
              });
            }
          }

          // Add the final text result if available
          if (finalResult && finalResult.text) {
            childMessages.push({
              type: 'text' as const,
              content: finalResult.text,
            });
          }

          // Build the result object
          const result = {
            childMessages: childMessages,
            result: finalResult?.text || '',
          };

          // Return the transformed message with dynamic-tool part
          const nextMessage = {
            role: 'assistant' as const,
            parts: [
              {
                type: 'dynamic-tool',
                toolCallId: primitiveId,
                toolName: primitiveId,
                state: 'output-available',
                input: json.input,
                output: result,
              },
            ],
            id: message.id,
            metadata: {
              ...message.metadata,
              mode: 'network' as const,
              selectionReason: selectionReason,
              agentInput: json.input,
              from: primitiveType === 'agent' ? ('AGENT' as const) : ('WORKFLOW' as const),
            },
          } as MastraUIMessage;

          return nextMessage;
        }
      } catch (error) {
        // If parsing fails, return the original message
        return message;
      }
    }

    const extendedMessage = message as ExtendedMastraUIMessage;

    // Convert pendingToolApprovals from DB format to stream format
    const pendingToolApprovals = extendedMessage.metadata?.pendingToolApprovals as Record<string, any> | undefined;
    if (pendingToolApprovals && typeof pendingToolApprovals === 'object') {
      return {
        ...message,
        metadata: {
          ...message.metadata,
          mode: 'stream' as const,
          requireApprovalMetadata: pendingToolApprovals,
        },
      };
    }

    // Return original message if it's not a network message
    return message;
  });
};

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
