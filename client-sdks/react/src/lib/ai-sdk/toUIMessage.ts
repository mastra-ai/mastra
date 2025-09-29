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
  prev: WorkflowWatchResult,
  chunk: StreamChunk,
): WorkflowWatchResult => {
  if (chunk.type === 'workflow-start') {
    return {
      ...prev,
      runId: chunk.runId,
      eventTimestamp: new Date(),
      payload: {
        ...(prev?.payload || {}),
        workflowState: {
          ...prev?.payload?.workflowState,
          status: 'running',
          steps: {},
        },
      },
    };
  }

  if (chunk.type === 'workflow-step-start') {
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};

    return {
      ...prev,
      payload: {
        ...prev.payload,
        currentStep: {
          id: chunk.payload.id,
          ...chunk.payload,
        },
        workflowState: {
          ...prev?.payload?.workflowState,
          steps: {
            ...prev?.payload?.workflowState?.steps,
            [chunk.payload.id]: {
              ...(current || {}),
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-step-suspended') {
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};

    return {
      ...prev,
      payload: {
        ...prev?.payload,
        currentStep: {
          id: chunk.payload.id,
          ...prev?.payload?.currentStep,
          ...chunk.payload,
        },
        workflowState: {
          ...prev?.payload?.workflowState,
          status: 'suspended',
          steps: {
            ...prev?.payload?.workflowState?.steps,
            [chunk.payload.id]: {
              ...(current || {}),
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-step-waiting') {
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};
    return {
      ...prev,
      payload: {
        ...prev?.payload,
        currentStep: {
          id: chunk.payload.id,
          ...(prev?.payload?.currentStep || {}),
          ...chunk.payload,
        },
        workflowState: {
          ...prev?.payload?.workflowState,
          status: 'waiting',
          steps: {
            ...prev?.payload?.workflowState?.steps,
            [chunk.payload.id]: {
              ...current,
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-step-result') {
    const status = chunk.payload.status;
    const current = prev?.payload?.workflowState?.steps?.[chunk.payload.id] || {};

    const next = {
      ...prev,
      payload: {
        ...prev?.payload,
        currentStep: {
          id: chunk.payload.id,
          ...(prev?.payload?.currentStep || {}),
          ...chunk.payload,
        },
        workflowState: {
          ...prev?.payload?.workflowState,
          status,
          steps: {
            ...prev?.payload?.workflowState?.steps,
            [chunk.payload.id]: {
              ...current,
              ...chunk.payload,
            },
          },
        },
      },
      eventTimestamp: new Date(),
    };

    return next;
  }

  if (chunk.type === 'workflow-canceled') {
    return {
      ...prev,
      payload: {
        ...prev?.payload,
        workflowState: {
          ...prev?.payload?.workflowState,
          status: 'canceled',
        },
      },
      eventTimestamp: new Date(),
    };
  }

  if (chunk.type === 'workflow-finish') {
    return {
      ...prev,
      payload: {
        ...prev?.payload,
        currentStep: undefined,
        workflowState: {
          ...prev?.payload?.workflowState,
          status: chunk.payload.workflowStatus,
        },
      },
      eventTimestamp: new Date(),
    };
  }

  return prev;
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
              output: {
                networkMetadata: undefined,
                result: undefined,
              } as any,
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
        input: chunk.payload.args,
        callProviderMetadata: chunk.payload.providerMetadata,
        output: {
          networkMetadata: undefined,
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
          const currentOutput = toolPart.output as any;
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
            parts[toolPartIndex] = {
              type: 'dynamic-tool',
              toolName: toolPart.toolName,
              toolCallId: toolPart.toolCallId,
              state: 'output-available',
              input: toolPart.input,
              output: currentOutput,
              callProviderMetadata: chunk.payload.providerMetadata,
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
          const currentOutput = (toolPart.output as any) || {};

          // Handle workflow-related output chunks
          if (chunk.payload.output?.type?.startsWith('workflow-')) {
            // Get existing workflow state from the result field
            const existingWorkflowState = currentOutput.result || {};

            // Use the mapWorkflowStreamChunkToWatchResult pattern for accumulation
            const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(
              existingWorkflowState,
              chunk.payload.output,
            );

            parts[toolPartIndex] = {
              ...toolPart,
              output: {
                networkMetadata: currentOutput.networkMetadata,
                result: updatedWorkflowState,
              } as any,
            };
          } else {
            // Handle regular tool output
            const existingResult = Array.isArray(currentOutput.result) ? currentOutput.result : [];

            parts[toolPartIndex] = {
              ...toolPart,
              output: {
                networkMetadata: currentOutput.networkMetadata,
                result: [...existingResult, chunk.payload.output],
              } as any,
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
