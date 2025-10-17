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

interface AgenticLoopParams<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>
  extends LoopRun<Tools, OUTPUT> {
  controller: ReadableStreamDefaultController<ChunkType<OUTPUT>>;
  writer: WritableStream<ChunkType<OUTPUT>>;
}

export function createAgenticLoopWorkflow<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>(
  params: AgenticLoopParams<Tools, OUTPUT>,
) {
  const {
    models,
    _internal,
    messageId,
    runId,
    modelStreamSpan,
    telemetry_settings,
    toolChoice,
    messageList,
    modelSettings,
    controller,
    writer,
    ...rest
  } = params;

  // Track accumulated steps across iterations to pass to stopWhen
  const accumulatedSteps: StepResult<Tools>[] = [];
  // Track previous content to determine what's new in each step
  let previousContentLength = 0;

  const agenticExecutionWorkflow = createAgenticExecutionWorkflow<Tools, OUTPUT>({
    messageId: messageId!,
    models,
    telemetry_settings,
    _internal,
    modelSettings,
    toolChoice,
    modelStreamSpan,
    controller,
    writer,
    messageList,
    runId,
    ...rest,
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
    .dowhile(agenticExecutionWorkflow, async ({ inputData }) => {
      const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
      let hasFinishedSteps = false;

      const allContent: StepResult<Tools>['content'] = typedInputData.messages.nonUser.flatMap(
        message => message.content as unknown as StepResult<Tools>['content'],
      );

      // Only include new content in this step (content added since the previous iteration)
      const currentContent = allContent.slice(previousContentLength);
      previousContentLength = allContent.length;

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

      accumulatedSteps.push(currentStep);

      // Only call stopWhen if we're continuing (not on the final step)
      if (rest.stopWhen && typedInputData.stepResult?.isContinued && accumulatedSteps.length > 0) {
        const conditions = await Promise.all(
          (Array.isArray(rest.stopWhen) ? rest.stopWhen : [rest.stopWhen]).map(condition => {
            return condition({
              steps: accumulatedSteps,
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

      // Check if we should continue - either due to isContinued or llmIterationRetry
      const hasContinuation = typedInputData.stepResult?.isContinued ?? false;
      const hasLLMIterationRetry = !!typedInputData.output?.llmIterationRetry;

      return hasContinuation || hasLLMIterationRetry;
    })
    .commit();
}
