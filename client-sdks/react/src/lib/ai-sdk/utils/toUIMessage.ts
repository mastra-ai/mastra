import { AgentChunkType, ChunkType } from '@mastra/core/stream';
import { MastraUIMessage, MastraUIMessageMetadata } from '../types';
import { WorkflowStreamResult, StepResult } from '@mastra/core/workflows';

type StreamChunk = {
  type: string;
  payload: any;
  runId: string;
  from: 'AGENT' | 'WORKFLOW';
};

// Helper function to map workflow stream chunks to watch result format
// Based on the pattern from packages/playground-ui/src/domains/workflows/utils.ts

export const mapWorkflowStreamChunkToWatchResult = (
  prev: WorkflowStreamResult<any, any, any, any>,
  chunk: StreamChunk,
): WorkflowStreamResult<any, any, any, any> => {
  if (chunk.type === 'workflow-start') {
    return {
      input: prev?.input,
      status: 'running',
      steps: prev?.steps || {},
    };
  }

  if (chunk.type === 'workflow-canceled') {
    return {
      ...prev,
      status: 'canceled',
    };
  }

  if (chunk.type === 'workflow-finish') {
    const finalStatus = chunk.payload.workflowStatus;
    const prevSteps = prev?.steps ?? {};
    const lastStep = Object.values(prevSteps).pop();
    return {
      ...prev,
      status: chunk.payload.workflowStatus,
      ...(finalStatus === 'success' && lastStep?.status === 'success'
        ? { result: lastStep?.output }
        : finalStatus === 'failed' && lastStep?.status === 'failed'
          ? { error: lastStep?.error }
          : {}),
    };
  }

  const { stepCallId, stepName, ...newPayload } = chunk.payload ?? {};

  const newSteps = {
    ...prev?.steps,
    [chunk.payload.id]: {
      ...prev?.steps?.[chunk.payload.id],
      ...newPayload,
    },
  };

  if (chunk.type === 'workflow-step-start') {
    return {
      ...prev,
      steps: newSteps,
    };
  }

  if (chunk.type === 'workflow-step-suspended') {
    const suspendedStepIds = Object.entries(newSteps as Record<string, StepResult<any, any, any, any>>).flatMap(
      ([stepId, stepResult]) => {
        if (stepResult?.status === 'suspended') {
          const nestedPath = stepResult?.suspendPayload?.__workflow_meta?.path;
          return nestedPath ? [[stepId, ...nestedPath]] : [[stepId]];
        }

        return [];
      },
    );
    return {
      ...prev,
      status: 'suspended',
      steps: newSteps,
      suspendPayload: chunk.payload.suspendPayload,
      suspended: suspendedStepIds as any,
    };
  }

  if (chunk.type === 'workflow-step-waiting') {
    return {
      ...prev,
      status: 'waiting',
      steps: newSteps,
    };
  }

  if (chunk.type === 'workflow-step-result') {
    return {
      ...prev,
      steps: newSteps,
    };
  }

  return prev;
};

export interface ToUIMessageArgs {
  chunk: ChunkType;
  conversation: MastraUIMessage[];
  metadata: MastraUIMessageMetadata;
}

export const toUIMessage = ({ chunk, conversation, metadata }: ToUIMessageArgs): MastraUIMessage[] => {
  // Always return a new array reference for React
  const result = [...conversation];

  switch (chunk.type) {
    case 'tripwire': {
      // Create a new assistant message
      const newMessage: MastraUIMessage = {
        id: `tripwire-${chunk.runId + Date.now()}`,
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: chunk.payload.tripwireReason,
          },
        ],
        metadata: {
          ...metadata,
          status: 'warning',
        },
      };

      return [...result, newMessage];
    }

    case 'start': {
      // Create a new assistant message
      const newMessage: MastraUIMessage = {
        id: `start-${chunk.runId + Date.now()}`,
        role: 'assistant',
        parts: [],
        metadata,
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
          id: `reasoning-${chunk.runId + Date.now()}`,
          role: 'assistant',
          parts: [
            {
              type: 'reasoning',
              text: chunk.payload.text,
              state: 'streaming',
              providerMetadata: chunk.payload.providerMetadata,
            },
          ],
          metadata,
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
          id: `tool-call-${chunk.runId + Date.now()}`,
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
          metadata,
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
      });

      return [
        ...result.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    case 'tool-error':
    case 'tool-result': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      // Find and update the corresponding tool call
      const parts = [...lastMessage.parts];
      const toolPartIndex = parts.findIndex(
        part =>
          (part.type === 'dynamic-tool' || (typeof part.type === 'string' && part.type.startsWith('tool-'))) &&
          'toolCallId' in part &&
          part.toolCallId === chunk.payload.toolCallId,
      );

      if (toolPartIndex !== -1) {
        const toolPart = parts[toolPartIndex];
        if (
          toolPart.type === 'dynamic-tool' ||
          (typeof toolPart.type === 'string' && toolPart.type.startsWith('tool-'))
        ) {
          const toolName =
            'toolName' in toolPart && typeof toolPart.toolName === 'string'
              ? toolPart.toolName
              : toolPart.type.startsWith('tool-')
                ? toolPart.type.substring(5)
                : '';

          const toolCallId = (toolPart as any).toolCallId;

          if ((chunk.type === 'tool-result' && chunk.payload.isError) || chunk.type === 'tool-error') {
            const error = chunk.type === 'tool-error' ? chunk.payload.error : chunk.payload.result;
            parts[toolPartIndex] = {
              type: 'dynamic-tool',
              toolName,
              toolCallId,
              state: 'output-error',
              input: (toolPart as any).input,
              errorText: String(error),
              callProviderMetadata: chunk.payload.providerMetadata,
            };
          } else {
            const isWorkflow = Boolean((chunk.payload.result as any)?.result?.steps);
            const isAgent = chunk?.from === 'AGENT';
            let output;
            if (isWorkflow) {
              output = (chunk.payload.result as any)?.result;
            } else if (isAgent) {
              output = (parts[toolPartIndex] as any).output ?? chunk.payload.result;
            } else {
              output = chunk.payload.result;
            }
            parts[toolPartIndex] = {
              type: 'dynamic-tool',
              toolName,
              toolCallId,
              state: 'output-available',
              input: (toolPart as any).input,
              output,
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
        part =>
          (part.type === 'dynamic-tool' || (typeof part.type === 'string' && part.type.startsWith('tool-'))) &&
          'toolCallId' in part &&
          part.toolCallId === chunk.payload.toolCallId,
      );

      if (toolPartIndex !== -1) {
        const toolPart = parts[toolPartIndex];
        // Handle dynamic-tool and tool-* part types
        if (
          toolPart.type === 'dynamic-tool' ||
          (typeof toolPart.type === 'string' && toolPart.type.startsWith('tool-'))
        ) {
          // Extract toolName, toolCallId, input from different part structures
          const toolName =
            'toolName' in toolPart && typeof toolPart.toolName === 'string'
              ? toolPart.toolName
              : typeof toolPart.type === 'string' && toolPart.type.startsWith('tool-')
                ? toolPart.type.substring(5)
                : '';
          const toolCallId = (toolPart as any).toolCallId;
          const input = (toolPart as any).input;

          // Handle workflow-related output chunks
          if (chunk.payload.output?.type?.startsWith('workflow-')) {
            // Get existing workflow state from the output field
            const existingWorkflowState =
              ((toolPart as any).output as WorkflowStreamResult<any, any, any, any>) ||
              ({} as WorkflowStreamResult<any, any, any, any>);

            // Use the mapWorkflowStreamChunkToWatchResult pattern for accumulation
            const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(
              existingWorkflowState,
              chunk.payload.output,
            );

            parts[toolPartIndex] = {
              type: 'dynamic-tool',
              toolName,
              toolCallId,
              state: 'input-streaming',
              input,
              output: updatedWorkflowState as any,
            };
          } else if (
            chunk.payload.output?.from === 'AGENT' ||
            (chunk.payload.output?.from === 'USER' &&
              chunk.payload.output?.payload?.output?.type?.startsWith('workflow-'))
          ) {
            return toUIMessageFromAgent(chunk.payload.output, conversation, metadata);
          } else {
            // Handle regular tool output
            const currentOutput = ((toolPart as any).output as any) || [];
            const existingOutput = Array.isArray(currentOutput) ? currentOutput : [];

            parts[toolPartIndex] = {
              type: 'dynamic-tool',
              toolName,
              toolCallId,
              state: 'input-streaming',
              input,
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

    case 'tool-call-approval': {
      const lastMessage = result[result.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return result;

      // Find and update the corresponding tool call

      const lastRequireApprovalMetadata =
        lastMessage.metadata?.mode === 'stream' ? lastMessage.metadata?.requireApprovalMetadata : {};

      return [
        ...result.slice(0, -1),
        {
          ...lastMessage,
          metadata: {
            ...lastMessage.metadata,
            mode: 'stream',
            requireApprovalMetadata: {
              ...lastRequireApprovalMetadata,
              [chunk.payload.toolCallId]: {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
              },
            },
          },
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
      const newMessage: MastraUIMessage = {
        id: `error-${chunk.runId + Date.now()}`,
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: typeof chunk.payload.error === 'string' ? chunk.payload.error : JSON.stringify(chunk.payload.error),
          },
        ],
        metadata: {
          ...metadata,
          status: 'error',
        },
      };

      return [...result, newMessage];
    }

    // For all other chunk types, return conversation unchanged
    default:
      return result;
  }
};

const toUIMessageFromAgent = (
  chunk: AgentChunkType,
  conversation: MastraUIMessage[],
  metadata: MastraUIMessageMetadata,
): MastraUIMessage[] => {
  const lastMessage = conversation[conversation.length - 1];
  if (!lastMessage || lastMessage.role !== 'assistant') return conversation;

  const parts = [...lastMessage.parts];

  if (chunk.type === 'text-delta') {
    const agentChunk = chunk.payload;
    const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

    if (toolPartIndex === -1) return conversation;
    const toolPart = parts[toolPartIndex];

    // if (toolPart.type !== 'dynamic-tool') return newConversation;
    const childMessages = (toolPart as any)?.output?.childMessages || [];
    const lastChildMessage = childMessages[childMessages.length - 1];

    const textMessage = { type: 'text', content: (lastChildMessage?.content || '') + agentChunk.text };

    const nextMessages =
      lastChildMessage?.type === 'text'
        ? [...childMessages.slice(0, -1), textMessage]
        : [...childMessages, textMessage];

    parts[toolPartIndex] = {
      ...toolPart,
      output: {
        childMessages: nextMessages,
      },
    } as any;
  } else if (chunk.type === 'tool-call') {
    const agentChunk = chunk.payload;
    const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

    if (toolPartIndex === -1) return conversation;
    const toolPart = parts[toolPartIndex];
    const childMessages = (toolPart as any)?.output?.childMessages || [];

    parts[toolPartIndex] = {
      ...toolPart,
      output: {
        ...(toolPart as any)?.output,
        childMessages: [
          ...childMessages,
          {
            type: 'tool',
            toolCallId: agentChunk.toolCallId,
            toolName: agentChunk.toolName,
            args: agentChunk.args,
          },
        ],
      },
    } as any;
  } else if (chunk.type === 'tool-output') {
    const agentChunk = chunk.payload;
    const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

    if (toolPartIndex === -1) return conversation;
    const toolPart = parts[toolPartIndex];
    if (agentChunk?.output?.type?.startsWith('workflow-')) {
      const childMessages = (toolPart as any)?.output?.childMessages || [];
      const lastToolIndex = childMessages.length - 1;

      const currentMessage = childMessages[lastToolIndex];
      const actualExistingWorkflowState = (currentMessage as any)?.toolOutput || {};
      const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(actualExistingWorkflowState, agentChunk.output);

      if (lastToolIndex >= 0 && childMessages[lastToolIndex]?.type === 'tool') {
        parts[toolPartIndex] = {
          ...toolPart,
          output: {
            ...(toolPart as any)?.output,
            childMessages: [
              ...childMessages.slice(0, -1),
              {
                ...currentMessage,
                toolOutput: { ...updatedWorkflowState, runId: agentChunk.output.runId },
              },
            ],
          },
        } as any;
      }
    }
  } else if (chunk.type === 'tool-result') {
    const agentChunk = chunk.payload;
    const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

    if (toolPartIndex === -1) return conversation;
    const toolPart = parts[toolPartIndex];
    const childMessages = (toolPart as any)?.output?.childMessages || [];

    const lastToolIndex = childMessages.length - 1;
    const isWorkflow = agentChunk?.toolName?.startsWith('workflow-');

    if (lastToolIndex >= 0 && childMessages[lastToolIndex]?.type === 'tool') {
      parts[toolPartIndex] = {
        ...toolPart,
        output: {
          ...(toolPart as any)?.output,
          childMessages: [
            ...childMessages.slice(0, -1),
            {
              ...childMessages[lastToolIndex],
              toolOutput: isWorkflow
                ? { ...(agentChunk.result as any)?.result, runId: (agentChunk.result as any)?.runId }
                : agentChunk.result,
            },
          ],
        },
      } as any;
    }
  }

  return [
    ...conversation.slice(0, -1),
    {
      ...lastMessage,
      parts,
    },
  ];
};
