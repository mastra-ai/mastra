import type { StepResult, ToolSet } from '@internal/ai-sdk-v5';
import { InternalSpans } from '../../../observability';
import { analyzeStep, emitStepAnalysis, emitBacktrack } from '../../../observability/instrumentation';
import type { OutputSchema } from '../../../stream/base/schema';
import type { ChunkType } from '../../../stream/types';
import { ChunkFrom } from '../../../stream/types';
import { createWorkflow } from '../../../workflows';
import type { OutputWriter } from '../../../workflows';
import type { LoopRun } from '../../types';
import { createAgenticExecutionWorkflow } from '../agentic-execution';
import { llmIterationOutputSchema } from '../schema';
import type { LLMIterationData } from '../schema';
import { isControllerOpen } from '../stream';

interface AgenticLoopParams<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>
  extends LoopRun<Tools, OUTPUT> {
  controller: ReadableStreamDefaultController<ChunkType<OUTPUT>>;
  outputWriter: OutputWriter;
}

export function createAgenticLoopWorkflow<Tools extends ToolSet = ToolSet, OUTPUT extends OutputSchema = undefined>(
  params: AgenticLoopParams<Tools, OUTPUT>,
) {
  const {
    models,
    _internal,
    messageId,
    runId,
    toolChoice,
    messageList,
    modelSettings,
    controller,
    outputWriter,
    runStateTracker,
    logger,
    agentId,
    ...rest
  } = params;

  // Track accumulated steps across iterations to pass to stopWhen
  const accumulatedSteps: StepResult<Tools>[] = [];
  // Track previous content to determine what's new in each step
  let previousContentLength = 0;

  const agenticExecutionWorkflow = createAgenticExecutionWorkflow<Tools, OUTPUT>({
    messageId: messageId!,
    models,
    _internal,
    modelSettings,
    toolChoice,
    controller,
    outputWriter,
    messageList,
    runId,
    runStateTracker,
    logger,
    agentId,
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
      validateInputs: false,
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
        // we need to cast this because we add 'tripwire' and 'retry' for processor scenarios
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

      // Record step metrics via the run state tracker
      const stepNumber = accumulatedSteps.length;
      const toolCallCount = currentStep.toolCalls?.length || 0;
      const toolNames = (currentStep.toolCalls || []).map(tc => tc.toolName);
      const hasToolCalls = toolCallCount > 0;
      const hasReasoning = !!currentStep.reasoningText;
      const hasText = !!currentStep.text;

      // Determine step type
      const stepType = analyzeStep({
        hasToolCalls,
        toolCallCount,
        toolNames,
        hasReasoning,
        hasText,
      });

      // Build full step analysis
      const stepAnalysis = {
        stepNumber,
        stepType,
        hasToolCalls,
        toolCallCount,
        toolNames,
        durationMs: 0, // Duration not tracked per-step at this level
        tokenUsage: currentStep.usage
          ? {
              inputTokens: currentStep.usage.inputTokens || 0,
              outputTokens: currentStep.usage.outputTokens || 0,
            }
          : undefined,
      };

      // Record to tracker for aggregation
      runStateTracker?.recordStep(stepAnalysis);

      // Emit step analysis event for real-time observability
      if (runStateTracker) {
        emitStepAnalysis({
          context: runStateTracker.getContext(),
          analysis: stepAnalysis,
          logger,
        });
      }

      // Only call stopWhen if we're continuing (not on the final step)
      if (rest.stopWhen && typedInputData.stepResult?.isContinued && accumulatedSteps.length > 0) {
        // Cast steps to any for v5/v6 StopCondition compatibility
        // v5 and v6 StepResult types have minor differences (e.g., rawFinishReason, finishReason format)
        // but are compatible at runtime for stop condition evaluation
        const steps = accumulatedSteps as any;
        const conditions = await Promise.all(
          (Array.isArray(rest.stopWhen) ? rest.stopWhen : [rest.stopWhen]).map(condition => {
            return condition({ steps });
          }),
        );

        const hasStopped = conditions.some(condition => condition);
        hasFinishedSteps = hasStopped;
      }

      if (typedInputData.stepResult) {
        typedInputData.stepResult.isContinued = hasFinishedSteps ? false : typedInputData.stepResult.isContinued;
      }

      // Emit step-finish for all cases except tripwire without any steps
      // When tripwire happens but we have steps (e.g., max retries exceeded), we still
      // need to emit step-finish so the stream properly finishes with all step data
      const hasSteps = (typedInputData.output?.steps?.length ?? 0) > 0;
      const shouldEmitStepFinish = typedInputData.stepResult?.reason !== 'tripwire' || hasSteps;

      if (shouldEmitStepFinish) {
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

      const reason = typedInputData.stepResult?.reason;

      // Detect backtrack/retry scenario
      if (reason === 'retry' && runStateTracker) {
        runStateTracker.recordBacktrack();
        // Access retry metadata from stepResult (set by llm-execution-step)
        const stepResult = typedInputData.stepResult as {
          retryReason?: string;
          retryProcessorId?: string;
        };
        emitBacktrack({
          context: runStateTracker.getContext(),
          fromStep: stepNumber,
          toStep: stepNumber, // Retrying the same step
          reason: stepResult?.retryReason || 'Processor requested retry',
          processorId: stepResult?.retryProcessorId,
          logger,
        });
      }

      if (reason === undefined) {
        return false;
      }

      return typedInputData.stepResult?.isContinued ?? false;
    })
    .commit();
}
