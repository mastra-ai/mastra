import { ReadableStream, WritableStream } from 'node:stream/web';
import type { ToolSet } from 'ai-v5';
import type z from 'zod';
import { getErrorFromUnknown } from '../../error';
import type { MastraLLMVNext } from '../../llm/model/model.loop';
import { RequestContext } from '../../request-context';
import type { OutputSchema } from '../../stream/base/schema';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import type { WorkflowResult } from '../../workflows';
import type { LoopRun } from '../types';
import { createAgenticLoopWorkflow } from './agentic-loop';

/**
 * Check if a ReadableStreamDefaultController is open and can accept data.
 *
 * Note: While the ReadableStream spec indicates desiredSize can be:
 * - positive (ready), 0 (full but open), or null (closed/errored),
 * our empirical testing shows that after controller.close(), desiredSize becomes 0.
 * Therefore, we treat both 0 and null as closed states to prevent
 * "Invalid state: Controller is already closed" errors.
 *
 * @param controller - The ReadableStreamDefaultController to check
 * @returns true if the controller is open and can accept data
 */
export function isControllerOpen(controller: ReadableStreamDefaultController<any>): boolean {
  return controller.desiredSize !== 0 && controller.desiredSize !== null;
}

export function workflowLoopStream<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>({
  resumeContext,
  requireToolApproval,
  models,
  toolChoice,
  modelSettings,
  _internal,
  messageId,
  runId,
  messageList,
  startTimestamp,
  streamState,
  agentId,
  toolCallId,
  ...rest
}: LoopRun<Tools, OUTPUT>) {
  return new ReadableStream<ChunkType<OUTPUT>>({
    start: async controller => {
      const writer = new WritableStream<ChunkType<OUTPUT>>({
        write: chunk => {
          controller.enqueue(chunk);
        },
      });

      const agenticLoopWorkflow = createAgenticLoopWorkflow<Tools, OUTPUT>({
        resumeContext,
        messageId: messageId!,
        models,
        _internal,
        modelSettings,
        toolChoice,
        controller,
        writer,
        runId,
        messageList,
        startTimestamp,
        streamState,
        agentId,
        ...rest,
      });

      if (rest.mastra) {
        agenticLoopWorkflow.__registerMastra(rest.mastra);
      }

      const initialData = {
        messageId: messageId!,
        messages: {
          all: messageList.get.all.aiV5.model(),
          user: messageList.get.input.aiV5.model(),
          nonUser: [],
        },
        output: {
          steps: [],
          usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
        metadata: {},
        stepResult: {
          reason: 'undefined',
          warnings: [],
          isContinued: true,
          totalUsage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        },
      };

      if (!resumeContext) {
        controller.enqueue({
          type: 'start',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: agentId,
          },
        });
      }

      const run = await agenticLoopWorkflow.createRun({
        runId,
      });

      const requestContext = new RequestContext();

      if (requireToolApproval) {
        requestContext.set('__mastra_requireToolApproval', true);
      }

      let executionResult: WorkflowResult<any, any, any, any>;

      executionResult = resumeContext
        ? await run.resume({
            resumeData: resumeContext.resumeData,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
            label: toolCallId,
          })
        : await run.start({
            inputData: initialData,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
            requestContext,
          });

      if (rest.autoResumeSuspendedTools && executionResult.status === 'suspended') {
        const MAX_AUTO_RESUME_ATTEMPTS = 10;
        let autoResumeAttempts = 0;
        while (executionResult.status === 'suspended') {
          // using while loop because there could because the workflow might get suspended multiple times
          if (++autoResumeAttempts > MAX_AUTO_RESUME_ATTEMPTS) {
            rest.logger?.error(
              `[Agent:${agentId}] - Maximum auto-resume attempts (${MAX_AUTO_RESUME_ATTEMPTS}) exceeded, please resume the agent manually`,
            );
            break;
          }
          const agent = rest.mastra?.getAgentById(agentId)!;
          let resumeSchema: z.ZodType<any> | undefined = undefined;
          const executionWorkflowSuspendPayload = executionResult.suspendPayload?.['executionWorkflow'] as Record<
            string,
            any
          >;
          if (!executionWorkflowSuspendPayload) {
            rest.logger?.error(
              `[Agent:${agentId}] - Invalid suspend payload structure, please resume the agent manually`,
            );
            break;
          }
          const requireToolApproval: Record<string, any> | undefined =
            executionWorkflowSuspendPayload.requireToolApproval;
          const toolName: string = executionWorkflowSuspendPayload.toolName || '';
          const resumeLabel: string[] = executionWorkflowSuspendPayload.resumeLabel ?? [];
          let suspendedStepId: string | undefined = undefined;
          let suspendWorkflowId: string | undefined = undefined;
          if (toolName.startsWith('workflow-') && !requireToolApproval) {
            const stepPath = resumeLabel?.[0] ?? '';
            const stepId = stepPath?.split('.')?.[0];
            const workflowId = toolName.substring('workflow-'.length);
            suspendWorkflowId = workflowId;
            const agentWorkflows = await agent.listWorkflows();
            const workflow = agentWorkflows[workflowId];
            suspendedStepId = stepId;
            if (workflow && stepId) {
              const step = workflow.steps?.[stepId];
              if (step) {
                resumeSchema = step.resumeSchema;
              } else {
                rest.logger?.warn(
                  `[Agent:${agentId}] - Suspended step ${stepId} not found in workflow ${workflowId}, auto resume will not be possible, please resume the agent manually`,
                );
                break;
              }
            } else {
              rest.logger?.warn(
                `[Agent:${agentId}] - Suspended workflow ${workflowId} step not found, auto resume will not be possible, please resume the agent manually`,
              );
              break;
            }
          } else if (toolName && !requireToolApproval) {
            const agentTools = await agent.listTools();
            const tool = agentTools[toolName];
            if (tool && 'resumeSchema' in tool) {
              resumeSchema = tool.resumeSchema;
            }
          }

          let resumeDataForAutoResume = {
            approved: true,
          };

          if (!requireToolApproval) {
            if (!resumeSchema) {
              rest.logger?.warn(
                `[Agent:${agentId}] - No resumeSchema found for suspended ${suspendWorkflowId ? `step ${suspendedStepId} in workflow tool ${suspendWorkflowId}` : `tool ${toolName}`}, auto resume will not be possible, please resume the agent manually`,
              );
              break;
            }

            try {
              const llm = (await agent.getLLM({ requestContext })) as MastraLLMVNext;

              const systemInstructions = `
            You are an assistant used to resume a suspended tool call.
            Your job is to create the resume data for the tool call using the schema passed as the structure for the data.
            You will generate an object that matches the schema.
          `;

              const messageListToUse = messageList.addSystem(systemInstructions);

              const result = llm.stream({
                methodType: 'generate',
                requestContext,
                messageList: messageListToUse,
                agentId,
                tracingContext: rest.modelSpanTracker?.getTracingContext()!,
                structuredOutput: {
                  schema: resumeSchema,
                },
              });

              resumeDataForAutoResume = await result.object;
            } catch (error) {
              rest.logger?.error(
                `[Agent:${agentId}] - Error generating resumeData for suspended ${suspendWorkflowId ? `step ${suspendedStepId} in workflow ${suspendWorkflowId}` : `tool ${toolName}`}:`,
                error,
              );
              break;
            }
          }

          executionResult = await run.resume({
            resumeData: resumeDataForAutoResume,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
            ...(requireToolApproval ? { label: requireToolApproval.toolCallId } : {}),
          });
        }
      }

      if (executionResult.status !== 'success') {
        if (executionResult.status === 'failed') {
          // Temporary fix for cleaning of workflow result error message.
          // executionResult.error is typed as Error but is actually a string and has "Error: Error: " prepended to the message.
          // TODO: This string handling can be removed when the workflow execution result error type is fixed (issue #9348) -- https://github.com/mastra-ai/mastra/issues/9348
          let executionResultError: string | Error = executionResult.error;
          if (typeof executionResult.error === 'string') {
            const prependedErrorString = 'Error: ';
            if ((executionResult.error as string).startsWith(`${prependedErrorString}${prependedErrorString}`)) {
              executionResultError = (executionResult.error as string).substring(
                `${prependedErrorString}${prependedErrorString}`.length,
              );
            } else if ((executionResult.error as string).startsWith(prependedErrorString)) {
              executionResultError = (executionResult.error as string).substring(prependedErrorString.length);
            }
          }

          const error = getErrorFromUnknown(executionResultError, {
            fallbackMessage: 'Unknown error in agent workflow stream',
          });

          controller.enqueue({
            type: 'error',
            runId,
            from: ChunkFrom.AGENT,
            payload: { error },
          });

          if (rest.options?.onError) {
            await rest.options?.onError?.({ error });
          }
        }

        controller.close();
        return;
      }

      if (executionResult.result.stepResult?.reason === 'abort') {
        controller.close();
        return;
      }

      controller.enqueue({
        type: 'finish',
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          ...executionResult.result,
          stepResult: {
            ...executionResult.result.stepResult,
            // @ts-ignore we add 'abort' for tripwires so the type is not compatible
            reason: executionResult.result.stepResult.reason,
          },
        },
      });

      controller.close();
    },
  });
}
