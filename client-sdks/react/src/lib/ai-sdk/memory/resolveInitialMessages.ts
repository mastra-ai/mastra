import { ExtendedMastraUIMessage, MastraUIMessage, MastraUIMessageMetadata } from '../types';

// Type definitions for parsing network execution data

// Tool call format from messages array (v1 format)
interface ToolCallContent {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

interface NestedMessage {
  role: string;
  id: string;
  createdAt: string;
  type: string;
  content?: string | (ToolCallContent | ToolResultContent)[];
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
  result?: any;
  text?: string;
  messages?: NestedMessage[];
}

interface NetworkExecutionData {
  isNetwork: boolean;
  selectionReason?: string;
  primitiveType?: string;
  primitiveId?: string;
  input?: string;
  finalResult?: FinalResult;
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
  const messagesLength = messages.length;
  return messages
    .map((message, index) => {
      // Check if message contains network execution data
      const networkPart = message.parts.find(
        (part): part is { type: 'text'; text: string } =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          part.type === 'text' &&
          'text' in part &&
          typeof part.text === 'string' &&
          part.text.includes('"isNetwork":true'),
      );

      if (networkPart && networkPart.type === 'text') {
        try {
          const json: NetworkExecutionData = JSON.parse(networkPart.text);

          if (json.isNetwork === true) {
            // Extract network execution data
            const selectionReason = json.selectionReason || '';
            const primitiveType = json.primitiveType || '';
            const primitiveId = json.primitiveId || '';
            const finalResult = json.finalResult;
            const messages = finalResult?.messages || [];

            // Build child messages from nested messages
            const childMessages: ChildMessage[] = [];

            // Build a map of toolCallId -> toolResult for efficient lookup
            const toolResultMap = new Map<string, ToolResultContent>();
            for (const msg of messages) {
              if (Array.isArray(msg.content)) {
                for (const part of msg.content) {
                  if (typeof part === 'object' && part.type === 'tool-result') {
                    toolResultMap.set(part.toolCallId, part as ToolResultContent);
                  }
                }
              }
            }

            // Extract tool calls from messages and match them with their results
            for (const msg of messages) {
              if (msg.type === 'tool-call' && Array.isArray(msg.content)) {
                // Process each tool call in this message
                for (const part of msg.content) {
                  if (typeof part === 'object' && part.type === 'tool-call') {
                    const toolCallContent = part as ToolCallContent;
                    const toolResult = toolResultMap.get(toolCallContent.toolCallId);
                    const isWorkflow = Boolean(toolResult?.result?.result?.steps);

                    childMessages.push({
                      type: 'tool' as const,
                      toolCallId: toolCallContent.toolCallId,
                      toolName: toolCallContent.toolName,
                      args: toolCallContent.args,
                      toolOutput: isWorkflow ? toolResult?.result?.result : toolResult?.result,
                    });
                  }
                }
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
            const result =
              primitiveType === 'tool'
                ? finalResult?.result
                : {
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
                hasMoreMessages: index < messagesLength - 1,
                from:
                  primitiveType === 'agent'
                    ? ('AGENT' as const)
                    : primitiveType === 'tool'
                      ? ('TOOL' as const)
                      : ('WORKFLOW' as const),
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

      // Convert suspendedTools from DB format to stream format
      const suspendedTools = extendedMessage.metadata?.suspendedTools as Record<string, any> | undefined;
      if (suspendedTools && typeof suspendedTools === 'object') {
        return {
          ...message,
          metadata: {
            ...message.metadata,
            mode: 'stream' as const,
            suspendedTools,
          },
        };
      }

      // Return original message if it's not a network message
      return message;
    })
    ?.filter(message => {
      const completionModes = ['generate', 'stream', 'network'];
      if (message.role === 'assistant' && completionModes.includes(message?.metadata?.mode as string)) {
        const meta = message.metadata as MastraUIMessageMetadata;
        if (meta?.isTaskCompleteResult?.suppressFeedback || meta?.completionResult?.suppressFeedback) {
          return false;
        }

        return true;
      }

      return true;
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
