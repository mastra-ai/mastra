import { type NetworkChunkType } from '@mastra/core/stream';
import { mapWorkflowStreamChunkToWatchResult } from '../utils/toUIMessage';
import { type Transformer, type TransformerArgs } from './types';
import { type MastraUIMessage, type MastraUIMessageMetadata } from '../types';
import { type WorkflowStreamResult } from '@mastra/core/workflows';
import { formatCompletionFeedback } from '@mastra/core/loop';

export class AISdkNetworkTransformer implements Transformer<NetworkChunkType> {
  transform({ chunk, conversation, metadata }: TransformerArgs<NetworkChunkType>): MastraUIMessage[] {
    const newConversation = [...conversation];

    if (chunk.type === 'routing-agent-text-delta') {
      return this.handleRoutingAgentConversation(chunk, newConversation);
    }

    if (chunk.type.startsWith('agent-execution-')) {
      return this.handleAgentConversation(chunk, newConversation, metadata);
    }

    if (chunk.type.startsWith('workflow-execution-')) {
      return this.handleWorkflowConversation(chunk, newConversation, metadata);
    }

    if (chunk.type.startsWith('tool-execution-')) {
      return this.handleToolConversation(chunk, newConversation, metadata);
    }

    if (chunk.type === 'network-validation-end') {
      if (chunk.payload.suppressFeedback) return newConversation;

      const feedback = formatCompletionFeedback(
        {
          complete: chunk.payload.passed,
          scorers: chunk.payload.results,
          totalDuration: chunk.payload.duration,
          timedOut: chunk.payload.timedOut,
          completionReason: chunk.payload.reason,
        },
        chunk.payload.maxIterationReached,
      );
      const newMessage: MastraUIMessage = {
        id: `network-validation-end-${chunk.payload.runId}-${Date.now()}`,
        role: 'assistant',
        parts: [
          {
            type: 'text',
            text: feedback,
          },
        ],
        metadata: {
          ...metadata,
          mode: 'network',
          completionResult: {
            passed: chunk.payload.passed,
          },
        },
      };

      return [...newConversation, newMessage];
    }

    // Fallback: extract text from result if core didn't send routing-agent-text-* events
    if (chunk.type === 'network-execution-event-step-finish') {
      const lastMessage = newConversation[newConversation.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

      const agentChunk = chunk.payload as any;
      const parts = [...lastMessage.parts];
      const textPartIndex = parts.findIndex(part => part.type === 'text');

      if (textPartIndex === -1) {
        parts.push({
          type: 'text',
          text: agentChunk.result,
          state: 'done',
        });

        return [
          ...newConversation.slice(0, -1),
          {
            ...lastMessage,
            parts,
          },
        ];
      }

      const textPart = parts[textPartIndex];
      if (textPart.type === 'text') {
        parts[textPartIndex] = {
          ...textPart,
          state: 'done',
        };
        return [
          ...newConversation.slice(0, -1),
          {
            ...lastMessage,
            parts,
          },
        ];
      }

      return newConversation;
    }

    return newConversation;
  }

  private handleRoutingAgentConversation = (
    chunk: NetworkChunkType,
    newConversation: MastraUIMessage[],
  ): MastraUIMessage[] => {
    const lastMessage = newConversation[newConversation.length - 1];
    if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

    const agentChunk = chunk.payload as any;
    const parts = [...lastMessage.parts];
    const textPartIndex = parts.findIndex(part => part.type === 'text');

    if (textPartIndex === -1) {
      parts.push({
        type: 'text',
        text: agentChunk.text,
        state: 'streaming',
      });

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    const textPart = parts[textPartIndex];
    if (textPart.type === 'text') {
      parts[textPartIndex] = {
        ...textPart,
        text: textPart.text + agentChunk.text,
        state: 'streaming',
      };
      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    return newConversation;
  };

  private handleAgentConversation = (
    chunk: NetworkChunkType,
    newConversation: MastraUIMessage[],
    metadata: MastraUIMessageMetadata,
  ): MastraUIMessage[] => {
    if (chunk.type === 'agent-execution-start') {
      const primitiveId = chunk.payload?.args?.primitiveId;
      const runId = chunk.payload.runId;

      if (!primitiveId || !runId) return newConversation;

      const newMessage: MastraUIMessage = {
        id: `agent-execution-start-${runId}-${Date.now()}`,
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: primitiveId,
            toolCallId: runId,
            state: 'input-available',
            input: chunk.payload.args,
          },
        ],
        metadata: {
          ...metadata,
          selectionReason: chunk.payload?.args?.selectionReason || '',
          agentInput: chunk.payload?.args?.task,
          mode: 'network',
          from: 'AGENT',
        },
      };

      return [...newConversation, newMessage];
    }

    if (chunk.type === 'agent-execution-approval') {
      const lastMessage = newConversation[newConversation.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

      const lastRequireApprovalMetadata =
        lastMessage.metadata?.mode === 'network' ? lastMessage.metadata?.requireApprovalMetadata : {};

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          metadata: {
            ...lastMessage.metadata,
            mode: 'network',
            requireApprovalMetadata: {
              ...lastRequireApprovalMetadata,
              [chunk.payload.toolName]: {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                runId: chunk.payload.runId,
              },
            },
          },
        },
      ];
    }

    if (chunk.type === 'agent-execution-suspended') {
      const lastMessage = newConversation[newConversation.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

      const lastSuspendedTools = lastMessage.metadata?.mode === 'network' ? lastMessage.metadata?.suspendedTools : {};

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          metadata: {
            ...lastMessage.metadata,
            mode: 'network',
            suspendedTools: {
              ...lastSuspendedTools,
              [chunk.payload.toolName]: {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                suspendPayload: chunk.payload.suspendPayload,
              },
            },
          },
        },
      ];
    }

    if (chunk.type === 'agent-execution-end') {
      const lastMessage = newConversation[newConversation.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

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
              ...currentOutput,
              result: currentOutput?.result || chunk.payload?.result || '',
            },
          };
        }
      }

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    // Handle agent execution events (text, tool calls, etc.)
    if (chunk.type.startsWith('agent-execution-event-')) {
      const lastMessage = newConversation[newConversation.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

      const agentChunk = chunk.payload as any;
      const parts = [...lastMessage.parts];
      const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

      if (toolPartIndex === -1) return newConversation;
      const toolPart = parts[toolPartIndex];

      // if (toolPart.type !== 'dynamic-tool') return newConversation;

      if (agentChunk.type === 'text-delta') {
        const childMessages = (toolPart as any)?.output?.childMessages || [];
        const lastChildMessage = childMessages[childMessages.length - 1];

        const textMessage = { type: 'text', content: (lastChildMessage?.content || '') + agentChunk.payload.text };

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
      } else if (agentChunk.type === 'tool-call') {
        const childMessages = (toolPart as any)?.output?.childMessages || [];

        parts[toolPartIndex] = {
          ...toolPart,
          output: {
            ...(toolPart as any)?.output,
            childMessages: [
              ...childMessages,
              {
                type: 'tool',
                toolCallId: agentChunk.payload.toolCallId,
                toolName: agentChunk.payload.toolName,
                args: agentChunk.payload.args,
              },
            ],
          },
        } as any;
      } else if (agentChunk.type === 'tool-output') {
        if (agentChunk.payload?.output?.type?.startsWith('workflow-')) {
          const childMessages = (toolPart as any)?.output?.childMessages || [];
          const lastToolIndex = childMessages.length - 1;

          const currentMessage = childMessages[lastToolIndex];
          const actualExistingWorkflowState = (currentMessage as any)?.toolOutput || {};
          const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(
            actualExistingWorkflowState,
            agentChunk.payload.output,
          );

          if (lastToolIndex >= 0 && childMessages[lastToolIndex]?.type === 'tool') {
            parts[toolPartIndex] = {
              ...toolPart,
              output: {
                ...(toolPart as any)?.output,
                childMessages: [
                  ...childMessages.slice(0, -1),
                  {
                    ...currentMessage,
                    toolOutput: updatedWorkflowState,
                  },
                ],
              },
            } as any;
          }
        }
      } else if (agentChunk.type === 'tool-result') {
        const childMessages = (toolPart as any)?.output?.childMessages || [];

        const lastToolIndex = childMessages.length - 1;
        const isWorkflow = Boolean(agentChunk.payload?.result?.result?.steps);

        if (lastToolIndex >= 0 && childMessages[lastToolIndex]?.type === 'tool') {
          parts[toolPartIndex] = {
            ...toolPart,
            output: {
              ...(toolPart as any)?.output,
              childMessages: [
                ...childMessages.slice(0, -1),
                {
                  ...childMessages[lastToolIndex],
                  toolOutput: isWorkflow ? agentChunk.payload.result.result : agentChunk.payload.result,
                },
              ],
            },
          } as any;
        }
      }

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    return newConversation;
  };

  private handleWorkflowConversation = (
    chunk: NetworkChunkType,
    newConversation: MastraUIMessage[],
    metadata: MastraUIMessageMetadata,
  ): MastraUIMessage[] => {
    if (chunk.type === 'workflow-execution-start') {
      const primitiveId = chunk.payload?.args?.primitiveId;
      const runId = chunk.payload.runId;

      if (!primitiveId || !runId) return newConversation;

      let agentInput;

      try {
        agentInput = JSON.parse(chunk?.payload?.args?.prompt);
      } catch (e) {
        agentInput = chunk?.payload?.args?.prompt;
      }

      const newMessage: MastraUIMessage = {
        id: `workflow-start-${runId}-${Date.now()}`,
        role: 'assistant',
        parts: [
          {
            type: 'dynamic-tool',
            toolName: primitiveId,
            toolCallId: runId,
            state: 'input-available',
            input: chunk.payload.args,
          },
        ],
        metadata: {
          ...metadata,
          selectionReason: chunk.payload?.args?.selectionReason || '',
          from: 'WORKFLOW',
          mode: 'network',
          agentInput,
        },
      };

      return [...newConversation, newMessage];
    }

    if (chunk.type === 'workflow-execution-suspended') {
      const lastMessage = newConversation[newConversation.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

      const lastSuspendedTools = lastMessage.metadata?.mode === 'network' ? lastMessage.metadata?.suspendedTools : {};

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          metadata: {
            ...lastMessage.metadata,
            mode: 'network',
            suspendedTools: {
              ...lastSuspendedTools,
              [chunk.payload.toolName]: {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                suspendPayload: chunk.payload.suspendPayload,
              },
            },
          },
        },
      ];
    }

    if (chunk.type.startsWith('workflow-execution-event-')) {
      const lastMessage = newConversation[newConversation.length - 1];

      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

      const parts = [...lastMessage.parts];
      const toolPartIndex = parts.findIndex(part => part.type === 'dynamic-tool');

      if (toolPartIndex === -1) return newConversation;

      const toolPart = parts[toolPartIndex];
      if (toolPart.type !== 'dynamic-tool') return newConversation;

      // Accumulate workflow state in output field
      const existingWorkflowState =
        (toolPart.output as WorkflowStreamResult<any, any, any, any>) ||
        ({} as WorkflowStreamResult<any, any, any, any>);

      const updatedWorkflowState = mapWorkflowStreamChunkToWatchResult(existingWorkflowState, chunk.payload as any);

      parts[toolPartIndex] = {
        ...toolPart,
        output: updatedWorkflowState as any,
      };

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    return newConversation;
  };

  private handleToolConversation = (
    chunk: NetworkChunkType,
    newConversation: MastraUIMessage[],
    metadata: MastraUIMessageMetadata,
  ): MastraUIMessage[] => {
    if (chunk.type === 'tool-execution-start') {
      const { args: argsData } = chunk.payload;
      const lastMessage = newConversation[newConversation.length - 1];

      const nestedArgs = argsData.args || {};

      if (!lastMessage || lastMessage.role !== 'assistant') {
        // Create new message if none exists
        const newMessage: MastraUIMessage = {
          id: `tool-start-${chunk.runId}-${Date.now()}`,
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: argsData.toolName || 'unknown',
              toolCallId: argsData.toolCallId || 'unknown',
              state: 'input-available',
              input: nestedArgs,
            },
          ],
          metadata: {
            ...metadata,
            selectionReason: metadata?.mode === 'network' ? metadata.selectionReason || argsData.selectionReason : '',
            mode: 'network',
            agentInput: nestedArgs,
          },
        };
        return [...newConversation, newMessage];
      }

      // Add tool call to the current message
      const parts = [...lastMessage.parts];

      parts.push({
        type: 'dynamic-tool',
        toolName: argsData.toolName || 'unknown',
        toolCallId: argsData.toolCallId || 'unknown',
        state: 'input-available',
        input: nestedArgs,
      });

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    if (chunk.type === 'tool-execution-approval') {
      const lastMessage = newConversation[newConversation.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

      const lastRequireApprovalMetadata =
        lastMessage.metadata?.mode === 'network' ? lastMessage.metadata?.requireApprovalMetadata : {};

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          metadata: {
            ...lastMessage.metadata,
            mode: 'network',
            requireApprovalMetadata: {
              ...lastRequireApprovalMetadata,
              [chunk.payload.toolName]: {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                runId: chunk.payload.runId,
              },
            },
          },
        },
      ];
    }

    if (chunk.type === 'tool-execution-suspended') {
      const lastMessage = newConversation[newConversation.length - 1];
      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

      const lastSuspendedTools = lastMessage.metadata?.mode === 'network' ? lastMessage.metadata?.suspendedTools : {};

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          metadata: {
            ...lastMessage.metadata,
            mode: 'network',
            suspendedTools: {
              ...lastSuspendedTools,
              [chunk.payload.toolName]: {
                toolCallId: chunk.payload.toolCallId,
                toolName: chunk.payload.toolName,
                args: chunk.payload.args,
                suspendPayload: chunk.payload.suspendPayload,
              },
            },
          },
        },
      ];
    }

    // Handle tool execution end
    if (chunk.type === 'tool-execution-end') {
      const lastMessage = newConversation[newConversation.length - 1];

      if (!lastMessage || lastMessage.role !== 'assistant') return newConversation;

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
            output: currentOutput?.result || chunk.payload?.result || '',
          };
        }
      }

      return [
        ...newConversation.slice(0, -1),
        {
          ...lastMessage,
          parts,
        },
      ];
    }

    return newConversation;
  };
}
