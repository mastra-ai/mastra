import { ReadableStream } from 'stream/web';
import type { LanguageModelV2FinishReason } from '@ai-sdk/provider-v5';
import type { StepResult, ToolSet } from 'ai-v5';
import type { OutputSchema } from '../../stream/base/schema';
import type { ChunkType, StepFinishPayload } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { createWorkflow } from '../../workflows';
import type { LoopRun } from '../types';
import { createOuterLLMWorkflow } from './outer-llm-step';
import { llmIterationOutputSchema } from './schema';
import type { LLMIterationData } from './schema';

export function workflowLoopStream<
  Tools extends ToolSet = ToolSet,
  OUTPUT extends OutputSchema | undefined = undefined,
>({
  telemetry_settings,
  model,
  toolChoice,
  modelSettings,
  _internal,
  modelStreamSpan,
  llmAISpan,
  messageId,
  ...rest
}: LoopRun<Tools, OUTPUT>) {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const writer = new WritableStream<ChunkType>({
        write: chunk => {
          controller.enqueue(chunk);
        },
      });

      modelStreamSpan.setAttributes({
        ...(telemetry_settings?.recordInputs !== false
          ? {
              'stream.prompt.toolChoice': toolChoice ? JSON.stringify(toolChoice) : 'auto',
            }
          : {}),
      });

      const outerLLMWorkflow = createOuterLLMWorkflow<Tools, OUTPUT>({
        messageId: messageId!,
        model,
        telemetry_settings,
        _internal,
        modelSettings,
        toolChoice,
        modelStreamSpan,
        controller,
        writer,
        ...rest,
      });

      // Track accumulated steps across iterations to pass to stopWhen
      const accumulatedSteps: StepResult<Tools>[] = [];

      const mainWorkflow = createWorkflow({
        id: 'agentic-loop',
        inputSchema: llmIterationOutputSchema,
        outputSchema: llmIterationOutputSchema,
      })
        .dowhile(outerLLMWorkflow, async ({ inputData }) => {
          const typedInputData = inputData as LLMIterationData<Tools>;
          let hasFinishedSteps = false;

          const currentContent: StepResult<Tools>['content'] = typedInputData.messages.nonUser.flatMap(
            message => message.content as unknown as StepResult<Tools>['content'],
          );

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
            controller.enqueue({
              type: 'step-finish',
              runId: rest.runId,
              from: ChunkFrom.AGENT,
              payload: typedInputData as StepFinishPayload,
            });
          }

          modelStreamSpan.setAttributes({
            'stream.response.id': typedInputData.metadata?.id,
            'stream.response.model': model.modelId,
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
                  'stream.prompt.messages': JSON.stringify(rest.messageList.get.input.aiV5.model()),
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

      const msToFirstChunk = _internal?.now?.()! - rest.startTimestamp!;

      modelStreamSpan.addEvent('ai.stream.firstChunk', {
        'ai.response.msToFirstChunk': msToFirstChunk,
      });

      modelStreamSpan.setAttributes({
        'stream.response.timestamp': new Date(rest.startTimestamp).toISOString(),
        'stream.response.msToFirstChunk': msToFirstChunk,
      });

      controller.enqueue({
        type: 'start',
        runId: rest.runId,
        from: ChunkFrom.AGENT,
        payload: {},
      });

      const run = await mainWorkflow.createRunAsync({
        runId: rest.runId,
      });

      const initialData = {
        messageId: messageId!,
        messages: {
          all: rest.messageList.get.all.aiV5.model(),
          user: rest.messageList.get.input.aiV5.model(),
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

      const executionResult = await run.start({
        inputData: initialData,
        tracingContext: { currentSpan: llmAISpan, isInternal: true },
      });

      if (executionResult.status !== 'success') {
        controller.close();
        return;
      }

      if (executionResult.result.stepResult?.reason === 'abort') {
        controller.close();
        return;
      }

      controller.enqueue({
        type: 'finish',
        runId: rest.runId,
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

      const msToFinish = (_internal?.now?.() ?? Date.now()) - rest.startTimestamp;
      modelStreamSpan.addEvent('ai.stream.finish');
      modelStreamSpan.setAttributes({
        'stream.response.msToFinish': msToFinish,
        'stream.response.avgOutputTokensPerSecond':
          (1000 * (executionResult?.result?.output?.usage?.outputTokens ?? 0)) / msToFinish,
      });

      controller.close();
    },
  });
}
