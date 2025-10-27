import type { StepResult, ToolSet } from 'ai-v5';
import { InternalSpans } from '../../../ai-tracing';
import type { OutputSchema } from '../../../stream/base/schema';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createWorkflow } from '../../../workflows';
import type { LoopRun } from '../../types';
import { createAgenticExecutionWorkflow } from '../agentic-execution';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { isControllerOpen } from '../stream';

interface CreateAgenticLoopWorkflowOptions {
  logger?: any;
  mastra?: any;
}

export function createAgenticLoopWorkflow<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>({
  logger,
  mastra,
}: CreateAgenticLoopWorkflowOptions) {
  const agenticExecutionWorkflow = createAgenticExecutionWorkflow<Tools, OUTPUT>({
    logger,
    mastra,
  });

  return createWorkflow({
    id: 'agentic-loop',
    inputSchema: llmIterationOutputSchema,
    outputSchema: llmIterationOutputSchema,
    options: {
      tracingPolicy: {
        // mark all workflow spans related to the
        // VNext execution as internal
        internal: InternalSpans.WORKFLOW,
      },
      shouldPersistSnapshot: params => {
        return params.workflowStatus === 'suspended';
      },
    },
  })
    .dowhile(agenticExecutionWorkflow, async ({ inputData, state, setState, runtimeContext }) => {
      const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
      // Access dynamic data from workflow state (shared across nested workflows)
      const {
        stopWhen,
        runId,
        messageList,
        maxSteps,
        controller,
        modelStreamSpan,
        telemetry_settings,
        accumulatedSteps = [],
        previousContentLength = 0,
      } = state;

      let hasFinishedSteps = false;

      const allContent: StepResult<Tools>['content'] = typedInputData.messages.nonUser.flatMap(
        message => message.content as unknown as StepResult<Tools>['content'],
      );

      // Only include new content in this step (content added since the previous iteration)
      const currentContent = allContent.slice(previousContentLength);
      const newPreviousContentLength = allContent.length;

      const currentStep: StepResult<Tools> = {
        content: currentContent,
        usage: typedInputData.output.usage || { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        // we need to cast this because we add 'abort' for tripwires
        finishReason: (typedInputData.stepResult?.reason || 'unknown') as StepResult<Tools>['finishReason'],
        warnings: typedInputData.stepResult?.warnings || [],
        request: typedInputData.metadata?.request || {},
        response: {
          ...typedInputData.metadata,
          modelId: typedInputData.metadata?.modelId || typedInputData.metadata?.model || '',
          messages: [],
        } as StepResult<Tools>['response'],
        text: typedInputData.output.text || '',
        reasoning: typedInputData.output.reasoning || [],
        reasoningText: typedInputData.output.reasoningText || '',
        files: typedInputData.output.files || [],
        toolCalls: typedInputData.output.toolCalls || [],
        toolResults: typedInputData.output.toolResults || [],
        sources: typedInputData.output.sources || [],
        staticToolCalls: typedInputData.output.staticToolCalls || [],
        dynamicToolCalls: typedInputData.output.dynamicToolCalls || [],
        staticToolResults: typedInputData.output.staticToolResults || [],
        dynamicToolResults: typedInputData.output.dynamicToolResults || [],
        providerMetadata: typedInputData.metadata?.providerMetadata,
      };

      const newAccumulatedSteps = [...accumulatedSteps, currentStep];

      // Update state with new accumulated steps and previous content length
      setState({
        ...state,
        accumulatedSteps: newAccumulatedSteps,
        previousContentLength: newPreviousContentLength,
      });

      // Only call stopWhen if we're continuing (not on the final step)
      if (stopWhen && typedInputData.stepResult?.isContinued && newAccumulatedSteps.length > 0) {
        const conditions = await Promise.all(
          (Array.isArray(stopWhen) ? stopWhen : [stopWhen]).map(condition => {
            return condition({
              steps: newAccumulatedSteps,
            });
          }),
        );

        const hasStopped = conditions.some(condition => condition);
        hasFinishedSteps = hasStopped;
      }

      if (typedInputData.stepResult) {
        typedInputData.stepResult.isContinued = hasFinishedSteps ? false : typedInputData.stepResult.isContinued;
      }

      if (typedInputData.stepResult?.reason !== 'abort') {
        // Only enqueue if controller is still open
        if (isControllerOpen(controller)) {
          controller.enqueue({
            type: 'step-finish',
            runId,
            from: ChunkFrom.AGENT,
            // @ts-ignore TODO: Look into the proper types for this
            payload: typedInputData,
          });
        }
      }

      modelStreamSpan.setAttributes({
        'stream.response.id': typedInputData.metadata?.id,
        'stream.response.model': typedInputData.metadata?.modelId,
        ...(typedInputData.metadata?.providerMetadata
          ? { 'stream.response.providerMetadata': JSON.stringify(typedInputData.metadata.providerMetadata) }
          : {}),
        'stream.response.finishReason': typedInputData.stepResult?.reason,
        'stream.usage.inputTokens': typedInputData.output.usage?.inputTokens,
        'stream.usage.outputTokens': typedInputData.output.usage?.outputTokens,
        'stream.usage.totalTokens': typedInputData.output.usage?.totalTokens,
        ...(telemetry_settings?.recordOutputs !== false
          ? {
              'stream.response.text': typedInputData.output.text,
              'stream.prompt.messages': JSON.stringify(messageList.get.input.aiV5.model()),
            }
          : {}),
      });

      modelStreamSpan.end();

      const reason = typedInputData.stepResult?.reason;

      if (reason === undefined) {
        return false;
      }

      return typedInputData.stepResult?.isContinued ?? false;
    })
    .commit();
}
