import { NetworkChunkType } from '@mastra/core/stream';
import { MastraUIMessage, mapWorkflowStreamChunkToWatchResult } from './toUIMessage';

export const toNetworkUIMessage = ({
  chunk,
  conversation,
}: {
  chunk: NetworkChunkType;
  conversation: MastraUIMessage[];
}): MastraUIMessage[] => {
  // Always return a new array reference for React
  const result = [...conversation];

  // Handle agent/workflow execution start - creates ONE message that will accumulate state
  if (chunk.type === 'agent-execution-start' || chunk.type === 'workflow-execution-start') {
    const primitiveId = chunk.payload?.args?.primitiveId;
    const runId = chunk.payload.runId;

    if (!primitiveId || !runId) return result;

    // Create new assistant message with a dynamic-tool part
    // Store networkMetadata temporarily in input since output is not available yet
    const newMessage: MastraUIMessage = {
      id: runId,
      role: 'assistant',
      parts: [
        {
          type: 'dynamic-tool',
          toolName: primitiveId,
          toolCallId: runId,
          state: 'input-available',
          input: chunk.payload.args,
          output: {
            networkMetadata: {
              selectionReason: chunk.payload?.args?.selectionReason || '',
              from: chunk.type === 'agent-execution-start' ? 'AGENT' : 'WORKFLOW',
            },
            result: undefined,
          } as any,
        },
      ],
    };

    return [...result, newMessage];
  }

  // Handle agent execution events (text, tool calls, etc.)
  if (chunk.type.startsWith('agent-execution-event-')) {
    const agentChunk = chunk.payload as any;
    const lastMessage = result[result.length - 1];

    if (!lastMessage || lastMessage.role !== 'assistant') return result;

    const parts = [...lastMessage.parts];
    const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

    if (toolPartIndex === -1) return result;

    const toolPart = parts[toolPartIndex];
    if (toolPart.type !== 'dynamic-tool') return result;

    // Handle different agent event types
    if (agentChunk.type === 'text-delta') {
      // Accumulate text in the input field
      const currentInput = toolPart.input as any;
      const messages = currentInput?.messages || [];
      const lastMessage = messages[messages.length - 1];

      const nextMessages =
        lastMessage?.type === 'text'
          ? [
              ...messages.slice(0, -1),
              { type: 'text', content: (lastMessage?.content || '') + agentChunk.payload.text },
            ]
          : [...messages, { type: 'text', content: agentChunk.payload.text }];

      parts[toolPartIndex] = {
        ...toolPart,
        input: {
          ...currentInput,
          messages: nextMessages,
        },
      };
    } else if (agentChunk.type === 'tool-call') {
      // Add tool call to messages
      const currentInput = toolPart.input as any;
      const messages = currentInput?.messages || [];

      parts[toolPartIndex] = {
        ...toolPart,
        input: {
          ...currentInput,
          messages: [
            ...messages,
            {
              type: 'tool',
              toolCallId: agentChunk.payload.toolCallId,
              toolName: agentChunk.payload.toolName,
              toolInput: agentChunk.payload.args,
            },
          ],
        },
      };
    } else if (agentChunk.type === 'tool-result') {
      // Update the last tool message with result
      const currentInput = toolPart.input as any;
      const messages = currentInput?.messages || [];
      const lastToolIndex = messages.length - 1;

      if (lastToolIndex >= 0 && messages[lastToolIndex]?.type === 'tool') {
        parts[toolPartIndex] = {
          ...toolPart,
          input: {
            ...currentInput,
            messages: [
              ...messages.slice(0, -1),
              {
                ...messages[lastToolIndex],
                toolOutput: agentChunk.payload.result,
              },
            ],
          },
        };
      }
    } else if (agentChunk.type === 'tool-output') {
      // Handle workflow output in tool-output events
      if (agentChunk.payload?.output?.type?.startsWith('workflow-')) {
        const currentOutput = (toolPart.output as any) || {};
        const existingWorkflowState = currentOutput.result || {};

        const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(
          existingWorkflowState,
          agentChunk.payload.output,
        );

        parts[toolPartIndex] = {
          ...toolPart,
          output: {
            networkMetadata: currentOutput.networkMetadata,
            result: updatedWorkflowState,
          } as any,
        };
      }
    }

    return [
      ...result.slice(0, -1),
      {
        ...lastMessage,
        parts,
      },
    ];
  }

  // Handle workflow execution events
  if (chunk.type.startsWith('workflow-execution-event-')) {
    const workflowChunk = chunk.payload as any;
    const lastMessage = result[result.length - 1];

    if (!lastMessage || lastMessage.role !== 'assistant') return result;

    const parts = [...lastMessage.parts];
    const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

    if (toolPartIndex === -1) return result;

    const toolPart = parts[toolPartIndex];
    if (toolPart.type !== 'dynamic-tool') return result;

    // Accumulate workflow state in output field
    const currentOutput = (toolPart.output as any) || {};
    const existingWorkflowState = currentOutput.result || {};

    const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(existingWorkflowState, workflowChunk);

    parts[toolPartIndex] = {
      ...toolPart,
      output: {
        networkMetadata: currentOutput.networkMetadata,
        result: updatedWorkflowState,
      } as any,
    };

    return [
      ...result.slice(0, -1),
      {
        ...lastMessage,
        parts,
      },
    ];
  }

  // Handle tool execution start
  if (chunk.type === 'tool-execution-start') {
    const { args: argsData } = chunk.payload;
    const lastMessage = result[result.length - 1];

    const nestedArgs = argsData.args || {};

    if (!lastMessage || lastMessage.role !== 'assistant') {
      // Create new message if none exists
      const newMessage: MastraUIMessage = {
        id: chunk.runId,
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: argsData.toolName || 'unknown',
            toolCallId: argsData.toolCallId || 'unknown',
            state: 'input-available',
            input: nestedArgs,
            output: {
              networkMetadata: {
                selectionReason: argsData.selectionReason || '',
              },
              result: undefined,
            } as any,
          },
        ],
      };
      return [...result, newMessage];
    }

    // Add tool call to the current message
    const parts = [...lastMessage.parts];
    parts.push({
      type: 'dynamic-tool',
      toolName: argsData.toolName || 'unknown',
      toolCallId: argsData.toolCallId || 'unknown',
      state: 'input-available',
      input: nestedArgs,
      output: {
        networkMetadata: {
          selectionReason: argsData.selectionReason || '',
        },
        result: undefined,
      } as any,
    });

    return [
      ...result.slice(0, -1),
      {
        ...lastMessage,
        parts,
      },
    ];
  }

  // Handle tool execution end
  if (chunk.type === 'tool-execution-end') {
    const lastMessage = result[result.length - 1];

    if (!lastMessage || lastMessage.role !== 'assistant') return result;

    const parts = [...lastMessage.parts];
    const toolPartIndex = parts.findIndex(
      part => part.type === 'dynamic-tool' && 'toolCallId' in part && part.toolCallId === chunk.payload.toolCallId,
    );

    if (toolPartIndex !== -1) {
      const toolPart = parts[toolPartIndex];
      if (toolPart.type === 'dynamic-tool') {
        const currentOutput = toolPart.output as any;
        parts[toolPartIndex] = {
          type: 'dynamic-tool',
          toolName: toolPart.toolName,
          toolCallId: toolPart.toolCallId,
          state: 'output-available',
          input: toolPart.input,
          output: {
            networkMetadata: currentOutput?.networkMetadata,
            result: chunk.payload.result,
          },
        };
      }
    }

    return [
      ...result.slice(0, -1),
      {
        ...lastMessage,
        parts,
      },
    ];
  }

  // Handle agent/workflow execution end - mark the tool as done
  if (chunk.type === 'agent-execution-end' || chunk.type === 'workflow-execution-end') {
    const lastMessage = result[result.length - 1];

    if (!lastMessage || lastMessage.role !== 'assistant') return result;

    const parts = [...lastMessage.parts];
    const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

    if (toolPartIndex !== -1) {
      const toolPart = parts[toolPartIndex];
      if (toolPart.type === 'dynamic-tool') {
        const currentOutput = toolPart.output as any;
        parts[toolPartIndex] = {
          type: 'dynamic-tool',
          toolName: toolPart.toolName,
          toolCallId: toolPart.toolCallId,
          state: 'output-available',
          input: toolPart.input,
          output: {
            networkMetadata: currentOutput?.networkMetadata,
            result: currentOutput?.result || chunk.payload?.result || '',
          },
        };
      }
    }

    return [
      ...result.slice(0, -1),
      {
        ...lastMessage,
        parts,
      },
    ];
  }

  // Handle network execution step finish - this might create a new text message
  if (chunk.type === 'network-execution-event-step-finish') {
    const newMessage: MastraUIMessage = {
      id: chunk.runId,
      role: 'assistant',
      parts: [
        {
          type: 'text',
          text: chunk.payload?.result || '',
          state: 'done',
        },
      ],
    };

    return [...result, newMessage];
  }

  // For all other chunk types (like routing-agent-start/end, network-finish), return unchanged
  return result;
};
