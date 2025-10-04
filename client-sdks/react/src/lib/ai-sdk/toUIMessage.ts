import { ChunkType } from '@mastra/core/stream';
import { type UIMessage } from '@ai-sdk/react';
import { WorkflowStreamEvent } from '@mastra/core/workflows';
import { WorkflowWatchResult } from '@mastra/client-js';

export type MastraUIMessage = UIMessage<any, any, any>;

type StreamChunk = {
  type: string;
  payload: any;
  runId: string;
  from: 'AGENT' | 'WORKFLOW';
};

// Helper function to map workflow stream chunks to watch result format
// Based on the pattern from packages/playground-ui/src/domains/workflows/utils.ts

export const mapWorkflowStreamChunkToWatchResult = (
  prev: WorkflowWatchResult['payload']['workflowState'] | undefined,
  chunk: StreamChunk,
): WorkflowWatchResult['payload']['workflowState'] => {
  const prevState = prev || { status: 'pending' as const, steps: {} };

  if (chunk.type === 'workflow-start') {
    return {
      ...prevState,
      status: 'running',
      steps: prevState.steps || {},
    };
  }

  if (chunk.type === 'workflow-step-start') {
    return {
      ...prevState,
      steps: {
        ...prevState.steps,
        [chunk.payload.id]: {
          ...prevState.steps?.[chunk.payload.id],
          ...chunk.payload,
        },
      },
    };
  }

  if (chunk.type === 'workflow-step-suspended') {
    const current = prevState.steps?.[chunk.payload.id] || {};

    return {
      ...prevState,
      status: 'suspended',
      steps: {
        ...prevState.steps,
        [chunk.payload.id]: {
          ...current,
          ...chunk.payload,
        },
      },
    };
  }

  if (chunk.type === 'workflow-step-waiting') {
    return {
      ...prevState,
      status: 'waiting',
      steps: {
        ...prevState.steps,
        [chunk.payload.id]: {
          ...prevState.steps?.[chunk.payload.id],
          ...chunk.payload,
        },
      },
    };
  }

  if (chunk.type === 'workflow-step-result') {
    return {
      ...prevState,
      steps: {
        ...prevState.steps,
        [chunk.payload.id]: {
          ...prevState.steps?.[chunk.payload.id],
          ...chunk.payload,
        },
      },
    };
  }

  if (chunk.type === 'workflow-canceled') {
    return {
      ...prevState,
      status: 'canceled',
    };
  }

  if (chunk.type === 'workflow-finish') {
    return {
      ...prevState,

      // Additional fields that might come from workflow-finish
      ...(chunk.payload.input && { input: chunk.payload.input }),
      ...(chunk.payload.traceId && { traceId: chunk.payload.traceId }),
      status: chunk.payload.workflowStatus,
      result: chunk.payload.result,
    };
  }

  return prevState;
};

export const toUIMessage = ({
  chunk,
  conversation,
}: {
  chunk: ChunkType;
  conversation: UIMessage[];
}): MastraUIMessage[] => {
  // Always return a new array reference for React
  const result = [...conversation];

  switch (chunk.type) {
    case 'start': {
      // Create a new assistant message
      const newMessage: MastraUIMessage = {
        id: chunk.runId,
        role: 'assistant',
        parts: [],
      };

      return [...result, newMessage];
    }

    case 'text-start':
    case 'text-delta': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      // Find or create a text part
      const parts = [...lastMessage.parts];
      let textPartIndex = parts.findIndex(part => part.type === 'text');

      if (chunk.type === 'text-start') {
        // Add a new text part if it doesn't exist
        if (textPartIndex === -1) {
          parts.push({
            type: 'text',
            text: '',
            state: 'streaming',
            providerMetadata: chunk.payload.providerMetadata,
          });
        }
      } else {
        // text-delta: append to existing text part or create if missing
        if (textPartIndex === -1) {
          parts.push({
            type: 'text',
            text: chunk.payload.text,
            state: 'streaming',
            providerMetadata: chunk.payload.providerMetadata,
          });
        } else {
          const textPart = parts[textPartIndex];
          if (textPart.type === 'text') {
            parts[textPartIndex] = {
              ...textPart,
              text: textPart.text + chunk.payload.text,
              state: 'streaming',
            };
          }
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

    case 'reasoning-delta': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        // Create new message if none exists
        const newMessage: MastraUIMessage = {
          id: chunk.runId,
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: chunk.payload.text,
              state: 'streaming',
              providerMetadata: chunk.payload.providerMetadata,
            },
          ],
        };
        return [...result, newMessage];
      }

      // Find or create reasoning part
      const parts = [...lastMessage.parts];
      let reasoningPartIndex = parts.findIndex(part => part.type === 'reasoning');

      if (reasoningPartIndex === -1) {
        parts.push({
          type: 'reasoning',
          text: chunk.payload.text,
          state: 'streaming',
          providerMetadata: chunk.payload.providerMetadata,
        });
      } else {
        const reasoningPart = parts[reasoningPartIndex];
        if (reasoningPart.type === 'reasoning') {
          parts[reasoningPartIndex] = {
            ...reasoningPart,
            text: reasoningPart.text + chunk.payload.text,
            state: 'streaming',
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

    case 'tool-call': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') {
        // Create new message if none exists
        const newMessage: MastraUIMessage = {
          id: chunk.runId,
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: chunk.payload.toolName,
              toolCallId: chunk.payload.toolCallId,
              state: 'input-available',
              input: chunk.payload.args,
              callProviderMetadata: chunk.payload.providerMetadata,
            },
          ],
        };
        return [...result, newMessage];
      }

      // Add tool call to existing message
      const parts = [...lastMessage.parts];
      parts.push({
        type: 'dynamic-tool',
        toolName: chunk.payload.toolName,
        toolCallId: chunk.payload.toolCallId,
        state: 'input-available',
        input: { ...chunk.payload.args, __mastraMetadata: { isStreaming: true } },
        callProviderMetadata: chunk.payload.providerMetadata,
      });

      return [
        ...result.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    case 'tool-result': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      // Find and update the corresponding tool call
      const parts = [...lastMessage.parts];
      const toolPartIndex = parts.findIndex(
        part => part.type === 'dynamic-tool' && 'toolCallId' in part && part.toolCallId === chunk.payload.toolCallId,
      );

      if (toolPartIndex !== -1) {
        const toolPart = parts[toolPartIndex];
        if (toolPart.type === 'dynamic-tool') {
          if (chunk.payload.isError) {
            parts[toolPartIndex] = {
              type: 'dynamic-tool',
              toolName: toolPart.toolName,
              toolCallId: toolPart.toolCallId,
              state: 'output-error',
              input: toolPart.input,
              errorText: String(chunk.payload.result),
              callProviderMetadata: chunk.payload.providerMetadata,
            };
          } else {
            // For server responses, the result comes directly here
            // Check if this is a workflow tool by examining the tool name or the result structure
            const isWorkflowTool =
              toolPart.toolName?.includes('Workflow') ||
              (chunk.payload.result &&
                typeof chunk.payload.result === 'object' &&
                'result' in chunk.payload.result &&
                'runId' in chunk.payload.result);

            if (isWorkflowTool) {
              // Server response has result directly with nested structure
              parts[toolPartIndex] = {
                type: 'dynamic-tool',
                toolName: toolPart.toolName,
                toolCallId: toolPart.toolCallId,
                state: 'output-available',
                input: toolPart.input,
                output: chunk.payload.result, // Server response already has the correct structure
                callProviderMetadata: chunk.payload.providerMetadata,
              };
            } else {
              // Regular tool result
              parts[toolPartIndex] = {
                type: 'dynamic-tool',
                toolName: toolPart.toolName,
                toolCallId: toolPart.toolCallId,
                state: 'output-available',
                input: toolPart.input,
                output: chunk.payload.result,
                callProviderMetadata: chunk.payload.providerMetadata,
              };
            }
          }
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

    case 'tool-output': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      // Find and update the corresponding tool call
      const parts = [...lastMessage.parts];
      const toolPartIndex = parts.findIndex(
        part => part.type === 'dynamic-tool' && 'toolCallId' in part && part.toolCallId === chunk.payload.toolCallId,
      );

      if (toolPartIndex !== -1) {
        const toolPart = parts[toolPartIndex];
        if (toolPart.type === 'dynamic-tool') {
          // Handle workflow-related output chunks
          if (chunk.payload.output?.type?.startsWith('workflow-')) {
            // Build up a WorkflowWatchResult structure for client-side streaming
            let existingOutput = toolPart.output as WorkflowWatchResult | undefined;

            // Initialize the structure if it doesn't exist
            if (!existingOutput) {
              existingOutput = {
                runId: chunk.payload.output.runId || '',
                eventTimestamp: new Date(),
                type: 'watch' as const,
                payload: {
                  workflowState: {
                    status: 'running' as const,
                    steps: {},
                  },
                },
              };
            }

            // Update the workflowState using the helper function
            const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(
              existingOutput.payload?.workflowState,
              chunk.payload.output,
            );

            // Build the full WorkflowWatchResult structure
            const updatedOutput: WorkflowWatchResult = {
              runId: chunk.payload.output.runId || existingOutput.runId,
              eventTimestamp: new Date(),
              type: 'watch' as const,
              payload: {
                workflowState: updatedWorkflowState,
                // Add currentStep if present in the chunk
                ...(chunk.payload.output.payload?.currentStep && {
                  currentStep: chunk.payload.output.payload.currentStep,
                }),
              },
            };

            parts[toolPartIndex] = {
              ...toolPart,
              output: updatedOutput as any,
            };
          } else {
            // Handle regular tool output
            const currentOutput = (toolPart.output as any) || [];
            const existingOutput = Array.isArray(currentOutput) ? currentOutput : [];

            parts[toolPartIndex] = {
              ...toolPart,
              output: [...existingOutput, chunk.payload.output] as any,
            };
          }
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

    case 'source': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      const parts = [...lastMessage.parts];

      // Add source part based on sourceType
      if (chunk.payload.sourceType === 'url') {
        parts.push({
          type: 'source-url',
          sourceId: chunk.payload.id,
          url: chunk.payload.url || '',
          title: chunk.payload.title,
          providerMetadata: chunk.payload.providerMetadata,
        });
      } else if (chunk.payload.sourceType === 'document') {
        parts.push({
          type: 'source-document',
          sourceId: chunk.payload.id,
          mediaType: chunk.payload.mimeType || 'application/octet-stream',
          title: chunk.payload.title,
          filename: chunk.payload.filename,
          providerMetadata: chunk.payload.providerMetadata,
        });
      }

      return [
        ...result.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    case 'file': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      const parts = [...lastMessage.parts];

      // Create data URL for file content
      let url: string;
      if (typeof chunk.payload.data === 'string') {
        url = chunk.payload.base64
          ? `data:${chunk.payload.mimeType};base64,${chunk.payload.data}`
          : `data:${chunk.payload.mimeType},${encodeURIComponent(chunk.payload.data)}`;
      } else {
        // For Uint8Array, convert to base64
        const base64 = btoa(String.fromCharCode(...chunk.payload.data));
        url = `data:${chunk.payload.mimeType};base64,${base64}`;
      }

      parts.push({
        type: 'file',
        mediaType: chunk.payload.mimeType,
        url,
        providerMetadata: chunk.payload.providerMetadata,
      });

      return [
        ...result.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    case 'finish': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      // Mark streaming parts as done
      const parts = lastMessage.parts.map(part => {
        if (part.type === 'text' && part.state === 'streaming') {
          return { ...part, state: 'done' as const };
        }
        if (part.type === 'reasoning' && part.state === 'streaming') {
          return { ...part, state: 'done' as const };
        }
        return part;
      });

      return [
        ...result.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    case 'error': {
      // For error cases, we might want to add an error indicator
      // but since UIMessage doesn't have explicit error parts,
      // we'll just return the conversation as-is
      return result;
    }

    // For all other chunk types, return conversation unchanged
    default:
      return result;
  }
};
