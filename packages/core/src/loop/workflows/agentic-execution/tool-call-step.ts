import type { ToolSet } from '@internal/ai-sdk-v5';
import z from 'zod/v4';
import type { MastraDBMessage } from '../../../memory';
import { toStandardSchema, standardSchemaToJSONSchema } from '../../../schema';
import { ChunkFrom } from '../../../stream/types';
import type { MastraToolInvocationOptions } from '../../../tools/types';
import type { SuspendOptions } from '../../../workflows';
import { createStep } from '../../../workflows';
import type { OuterLLMRun } from '../../types';
import { ToolNotFoundError } from '../errors';
import { toolCallInputSchema, toolCallOutputSchema } from '../schema';

type AddToolMetadataOptions = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  resumeSchema: string;
  suspendedToolRunId?: string;
} & (
  | {
      type: 'approval';
      suspendPayload?: never;
    }
  | {
      type: 'suspension';
      suspendPayload: unknown;
    }
);

export function createToolCallStep<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
  tools,
  messageList,
  options,
  outputWriter,
  controller,
  runId,
  streamState,
  modelSpanTracker,
  _internal,
  logger,
}: OuterLLMRun<Tools, OUTPUT>) {
  return createStep({
    id: 'toolCallStep',
    inputSchema: toolCallInputSchema,
    outputSchema: toolCallOutputSchema,
    execute: async ({ inputData, suspend, resumeData: workflowResumeData, requestContext }) => {
      // Use tools from _internal.stepTools if available (set by llmExecutionStep via prepareStep/processInputStep)
      // This avoids serialization issues - _internal is a mutable object that preserves execute functions
      // Fall back to the original tools from the closure if not set
      const stepTools = (_internal?.stepTools as Tools) || tools;

      const tool =
        stepTools?.[inputData.toolName] ||
        Object.values(stepTools || {})?.find((t: any) => `id` in t && t.id === inputData.toolName);

      const addToolMetadata = ({
        toolCallId,
        toolName,
        args,
        suspendPayload,
        resumeSchema,
        type,
        suspendedToolRunId,
      }: AddToolMetadataOptions) => {
        const metadataKey = type === 'suspension' ? 'suspendedTools' : 'pendingToolApprovals';
        // Find the last assistant message in the response (which should contain this tool call)
        const responseMessages = messageList.get.response.db();
        const lastAssistantMessage = [...responseMessages].reverse().find(msg => msg.role === 'assistant');

        if (lastAssistantMessage) {
          const content = lastAssistantMessage.content;
          if (!content) return;
          // Add metadata to indicate this tool call is pending approval
          const metadata =
            typeof lastAssistantMessage.content.metadata === 'object' && lastAssistantMessage.content.metadata !== null
              ? (lastAssistantMessage.content.metadata as Record<string, any>)
              : {};
          metadata[metadataKey] = metadata[metadataKey] || {};
          // Note: We key by toolName rather than toolCallId to track one suspension state per unique tool.
          metadata[metadataKey][toolName] = {
            toolCallId,
            toolName,
            args,
            type,
            runId: suspendedToolRunId ?? runId, // Store the runId so we can resume after page refresh
            ...(type === 'suspension' ? { suspendPayload } : {}),
            resumeSchema,
          };
          lastAssistantMessage.content.metadata = metadata;
        }
      };

      const removeToolMetadata = async (toolName: string, type: 'suspension' | 'approval') => {
        const { saveQueueManager, memoryConfig, threadId } = _internal || {};

        if (!saveQueueManager || !threadId) {
          return;
        }

        const getMetadata = (message: MastraDBMessage) => {
          const content = message.content;
          if (!content) return undefined;
          const metadata =
            typeof content.metadata === 'object' && content.metadata !== null
              ? (content.metadata as Record<string, any>)
              : undefined;
          return metadata;
        };

        const metadataKey = type === 'suspension' ? 'suspendedTools' : 'pendingToolApprovals';

        // Find and update the assistant message to remove approval metadata
        // At this point, messages have been persisted, so we look in all messages
        const allMessages = messageList.get.all.db();
        const lastAssistantMessage = [...allMessages].reverse().find(msg => {
          const metadata = getMetadata(msg);
          const suspendedTools = metadata?.[metadataKey] as Record<string, any> | undefined;
          const foundTool = !!suspendedTools?.[toolName];
          if (foundTool) {
            return true;
          }
          const dataToolSuspendedParts = msg.content.parts?.filter(
            part => part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval',
          );
          if (dataToolSuspendedParts && dataToolSuspendedParts.length > 0) {
            const foundTool = dataToolSuspendedParts.find((part: any) => part.data.toolName === toolName);
            if (foundTool) {
              return true;
            }
          }
          return false;
        });

        if (lastAssistantMessage) {
          const metadata = getMetadata(lastAssistantMessage);
          let suspendedTools = metadata?.[metadataKey] as Record<string, any> | undefined;
          if (!suspendedTools) {
            suspendedTools = lastAssistantMessage.content.parts
              ?.filter(part => part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval')
              ?.reduce(
                (acc, part) => {
                  if (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') {
                    acc[(part.data as any).toolName] = part.data;
                  }
                  return acc;
                },
                {} as Record<string, any>,
              );
          }

          if (suspendedTools && typeof suspendedTools === 'object') {
            if (metadata) {
              delete suspendedTools[toolName];
            } else {
              lastAssistantMessage.content.parts = lastAssistantMessage.content.parts?.map(part => {
                if (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') {
                  if ((part.data as any).toolName === toolName) {
                    return {
                      ...part,
                      data: {
                        ...(part.data as any),
                        resumed: true,
                      },
                    };
                  }
                }
                return part;
              });
            }

            // If no more pending suspensions, remove the whole object
            if (metadata && Object.keys(suspendedTools).length === 0) {
              delete metadata[metadataKey];
            }

            // Flush to persist the metadata removal
            try {
              await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
            } catch (error) {
              logger?.error('Error removing tool suspension metadata:', error);
            }
          }
        }
      };

      // Helper function to flush messages before suspension
      const flushMessagesBeforeSuspension = async () => {
        const { saveQueueManager, memoryConfig, threadId, resourceId, memory } = _internal || {};

        if (!saveQueueManager || !threadId) {
          return;
        }

        try {
          // Ensure thread exists before flushing messages
          if (memory && !_internal.threadExists && resourceId) {
            const thread = await memory.getThreadById?.({ threadId });
            if (!thread) {
              // Thread doesn't exist yet, create it now
              await memory.createThread?.({
                threadId,
                resourceId,
                memoryConfig,
              });
            }
            _internal.threadExists = true;
          }

          // Flush all pending messages immediately
          await saveQueueManager.flushMessages(messageList, threadId, memoryConfig);
        } catch (error) {
          logger?.error('Error flushing messages before suspension:', error);
        }
      };

      // If the tool was already executed by the provider, skip execution
      if (inputData.providerExecuted) {
        return {
          ...inputData,
          result: inputData.output ?? { providerExecuted: true, toolName: inputData.toolName },
        };
      }

      if (!tool) {
        const availableToolNames = Object.keys(stepTools || {});
        const availableToolsStr =
          availableToolNames.length > 0 ? ` Available tools: ${availableToolNames.join(', ')}` : '';
        return {
          error: new ToolNotFoundError(
            `Tool "${inputData.toolName}" not found.${availableToolsStr}. Call tools by their exact name only — never add prefixes, namespaces, or colons.`,
          ),
          ...inputData,
        };
      }

      if (tool && 'onInputAvailable' in tool) {
        try {
          await tool?.onInputAvailable?.({
            toolCallId: inputData.toolCallId,
            input: inputData.args,
            messages: messageList.get.input.aiV5.model(),
            abortSignal: options?.abortSignal,
          });
        } catch (error) {
          logger?.error('Error calling onInputAvailable', error);
        }
      }

      if (!tool.execute) {
        return inputData;
      }

      try {
        const requireToolApproval = requestContext.get('__mastra_requireToolApproval');

        let resumeDataFromArgs: any = undefined;
        let args: any = inputData.args;

        if (typeof inputData.args === 'object' && inputData.args !== null) {
          const { resumeData: resumeDataFromInput, ...argsFromInput } = inputData.args;
          args = argsFromInput;
          resumeDataFromArgs = resumeDataFromInput;
        }

        const resumeData = resumeDataFromArgs ?? workflowResumeData;

        const isResumeToolCall = !!resumeDataFromArgs;

        // Check if approval is required
        // requireApproval can be:
        // - boolean (from Mastra createTool or mapped from AI SDK needsApproval: true)
        // - undefined (no approval needed)
        // If needsApprovalFn exists, evaluate it with the tool args
        let toolRequiresApproval = requireToolApproval || (tool as any).requireApproval;
        if ((tool as any).needsApprovalFn) {
          // Evaluate the function with the parsed args
          try {
            const needsApprovalResult = await (tool as any).needsApprovalFn(args);
            toolRequiresApproval = needsApprovalResult;
          } catch (error) {
            // Log error to help developers debug faulty needsApprovalFn implementations
            logger?.error(`Error evaluating needsApprovalFn for tool ${inputData.toolName}:`, error);
            // On error, default to requiring approval to be safe
            toolRequiresApproval = true;
          }
        }

        // Schema for tool call approval - used for both streaming and metadata
        const approvalSchema = toStandardSchema(
          z.object({
            approved: z
              .boolean()
              .describe(
                'Controls if the tool call is approved or not, should be true when approved and false when declined',
              ),
          }),
        );

        if (toolRequiresApproval) {
          if (!resumeData) {
            controller.enqueue({
              type: 'tool-call-approval',
              runId,
              from: ChunkFrom.AGENT,
              payload: {
                toolCallId: inputData.toolCallId,
                toolName: inputData.toolName,
                args: inputData.args,
                resumeSchema: JSON.stringify(standardSchemaToJSONSchema(approvalSchema)),
              },
            });

            // Add approval metadata to message before persisting
            addToolMetadata({
              toolCallId: inputData.toolCallId,
              toolName: inputData.toolName,
              args: inputData.args,
              type: 'approval',
              resumeSchema: JSON.stringify(standardSchemaToJSONSchema(approvalSchema)),
            });

            // Flush messages before suspension to ensure they are persisted
            await flushMessagesBeforeSuspension();

            return suspend(
              {
                requireToolApproval: {
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  args: inputData.args,
                },
                __streamState: streamState.serialize(),
              },
              {
                resumeLabel: inputData.toolCallId,
              },
            );
          } else {
            // Remove approval metadata since we're resuming (either approved or declined)
            await removeToolMetadata(inputData.toolName, 'approval');

            if (!resumeData.approved) {
              return {
                result: 'Tool call was not approved by the user',
                ...inputData,
              };
            }
          }
        } else if (isResumeToolCall) {
          await removeToolMetadata(inputData.toolName, 'suspension');
        }

        //this is to avoid passing resume data to the tool if it's not needed
        // For agent tools, always pass resume data so the agent tool wrapper knows to call
        // resumeStream instead of stream (otherwise the sub-agent restarts from scratch)
        const isAgentTool = inputData.toolName?.startsWith('agent-');
        const isWorkflowTool = inputData.toolName?.startsWith('workflow-');
        const resumeDataToPassToToolOptions =
          !isAgentTool && toolRequiresApproval && Object.keys(resumeData).length === 1 && 'approved' in resumeData
            ? undefined
            : resumeData;

        const toolOptions: MastraToolInvocationOptions = {
          abortSignal: options?.abortSignal,
          toolCallId: inputData.toolCallId,
          // Pass all messages (input + response + memory) so sub-agents (agent-* tools) receive
          // the full conversation context and can make better decisions. Each sub-agent invocation
          // uses a fresh unique thread, so storing this context in that thread is scoped and safe.
          messages: isAgentTool ? messageList.get.all.aiV5.model() : messageList.get.input.aiV5.model(),
          outputWriter,
          // Pass current step span as parent for tool call spans
          tracingContext: modelSpanTracker?.getTracingContext(),
          // Pass workspace from _internal (set by llmExecutionStep via prepareStep/processInputStep)
          workspace: _internal?.stepWorkspace,
          // Forward requestContext so tools receive values set by the workflow step
          requestContext,
          suspend: async (suspendPayload: any, options?: SuspendOptions) => {
            if (options?.requireToolApproval) {
              controller.enqueue({
                type: 'tool-call-approval',
                runId,
                from: ChunkFrom.AGENT,
                payload: {
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  args: inputData.args,
                  resumeSchema: JSON.stringify(
                    standardSchemaToJSONSchema(
                      toStandardSchema(
                        z.object({
                          approved: z
                            .boolean()
                            .describe(
                              'Controls if the tool call is approved or not, should be true when approved and false when declined',
                            ),
                        }),
                      ),
                    ),
                  ),
                },
              });

              // Add approval metadata to message before persisting
              addToolMetadata({
                toolCallId: inputData.toolCallId,
                toolName: inputData.toolName,
                args: inputData.args,
                type: 'approval',
                suspendedToolRunId: options.runId,
                resumeSchema: JSON.stringify(
                  standardSchemaToJSONSchema(
                    toStandardSchema(
                      z.object({
                        approved: z
                          .boolean()
                          .describe(
                            'Controls if the tool call is approved or not, should be true when approved and false when declined',
                          ),
                      }),
                    ),
                  ),
                ),
              });

              // Flush messages before suspension to ensure they are persisted
              await flushMessagesBeforeSuspension();

              return suspend(
                {
                  requireToolApproval: {
                    toolCallId: inputData.toolCallId,
                    toolName: inputData.toolName,
                    args: inputData.args,
                  },
                  __streamState: streamState.serialize(),
                },
                {
                  resumeLabel: inputData.toolCallId,
                },
              );
            } else {
              controller.enqueue({
                type: 'tool-call-suspended',
                runId,
                from: ChunkFrom.AGENT,
                payload: {
                  toolCallId: inputData.toolCallId,
                  toolName: inputData.toolName,
                  suspendPayload,
                  args: inputData.args,
                  resumeSchema: options?.resumeSchema,
                },
              });

              // Add suspension metadata to message before persisting
              addToolMetadata({
                toolCallId: inputData.toolCallId,
                toolName: inputData.toolName,
                args,
                suspendPayload,
                suspendedToolRunId: options?.runId,
                type: 'suspension',
                resumeSchema: options?.resumeSchema,
              });

              // Flush messages before suspension to ensure they are persisted
              await flushMessagesBeforeSuspension();

              return await suspend(
                {
                  toolCallSuspended: suspendPayload,
                  __streamState: streamState.serialize(),
                  toolName: inputData.toolName,
                  resumeLabel: options?.resumeLabel,
                },
                {
                  resumeLabel: inputData.toolCallId,
                },
              );
            }
          },
          resumeData: resumeDataToPassToToolOptions,
        };

        //if resuming a subAgent or workflow tool, we want to find the runId from when it got suspended.
        if (resumeDataToPassToToolOptions && (isAgentTool || isWorkflowTool) && !isResumeToolCall) {
          let suspendedToolRunId = '';
          const messages = messageList.get.all.db();
          const assistantMessages = [...messages].reverse().filter(message => message.role === 'assistant');

          for (const message of assistantMessages) {
            const pendingOrSuspendedTools = (message.content.metadata?.suspendedTools ||
              message.content.metadata?.pendingToolApprovals) as Record<string, any>;
            if (pendingOrSuspendedTools && pendingOrSuspendedTools[inputData.toolName]) {
              suspendedToolRunId = pendingOrSuspendedTools[inputData.toolName].runId;
              break;
            }

            const dataToolSuspendedParts = message.content.parts?.filter(
              part =>
                (part.type === 'data-tool-call-suspended' || part.type === 'data-tool-call-approval') &&
                !(part.data as any).resumed,
            );
            if (dataToolSuspendedParts && dataToolSuspendedParts.length > 0) {
              const foundTool = dataToolSuspendedParts.find((part: any) => part.data.toolName === inputData.toolName);
              if (foundTool) {
                suspendedToolRunId = (foundTool as any).data.runId;
                break;
              }
            }
          }

          if (suspendedToolRunId) {
            args.suspendedToolRunId = suspendedToolRunId;
          }
        }

        if (args === null || args === undefined) {
          return {
            error: new Error(
              `Tool "${inputData.toolName}" received invalid arguments — the provided JSON could not be parsed. Please provide valid JSON arguments.`,
            ),
            ...inputData,
          };
        }

        if (isAgentTool) {
          if (typeof args === 'object' && args !== null && 'prompt' in args) {
            args.threadId = args.threadId || _internal?.threadId;
            args.resourceId = args.resourceId || _internal?.resourceId;
          }
        }

        const result = await tool.execute(args, toolOptions);

        // Call onOutput hook after successful execution
        if (tool && 'onOutput' in tool && typeof (tool as any).onOutput === 'function') {
          try {
            await (tool as any).onOutput({
              toolCallId: inputData.toolCallId,
              toolName: inputData.toolName,
              output: result,
              abortSignal: options?.abortSignal,
            });
          } catch (error) {
            logger?.error('Error calling onOutput', error);
          }
        }

        return { result, ...inputData };
      } catch (error) {
        return {
          error: error as Error,
          ...inputData,
        };
      }
    },
  });
}
