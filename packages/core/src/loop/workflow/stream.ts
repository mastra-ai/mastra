import { ReadableStream } from 'stream/web';
import type { ToolSet } from 'ai-v5';
import z from 'zod';
import type { OutputSchema } from '../../stream/base/schema';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import { createWorkflow } from '../../workflows';
import type { LoopRun } from '../types';
import { createOuterLLMWorkflow } from './outer-llm-step';
import { llmIterationOutputSchema } from './schema';

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
  ...rest
}: LoopRun<Tools, OUTPUT>) {
  return new ReadableStream<ChunkType>({
    start: async controller => {
      const writer = new WritableStream<ChunkType>({
        write: chunk => {
          controller.enqueue(chunk);
        },
      });

      const messageId = rest.experimental_generateMessageId?.() || _internal?.generateId?.();

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

      const mainWorkflow = createWorkflow({
        id: 'agentic-loop',
        inputSchema: llmIterationOutputSchema,
        outputSchema: z.any(),
      })
        .dowhile(outerLLMWorkflow, async ({ inputData }) => {
          let hasFinishedSteps = false;

          if (rest.stopWhen) {
            // console.log('stop_when', JSON.stringify(inputData.output.steps, null, 2));
            const conditions = await Promise.all(
              (Array.isArray(rest.stopWhen) ? rest.stopWhen : [rest.stopWhen]).map(condition => {
                return condition({
                  steps: inputData.output.steps,
                });
              }),
            );

            const hasStopped = conditions.some(condition => condition);
            hasFinishedSteps = hasStopped;
          }

          inputData.stepResult.isContinued = hasFinishedSteps ? false : inputData.stepResult.isContinued;

          if (inputData.stepResult.reason !== 'abort') {
            controller.enqueue({
              type: 'step-finish',
              runId: rest.runId,
              from: ChunkFrom.AGENT,
              payload: inputData,
            });
          }

          modelStreamSpan.setAttributes({
            'stream.response.id': inputData.metadata.id,
            'stream.response.model': model.modelId,
            ...(inputData.metadata.providerMetadata
              ? { 'stream.response.providerMetadata': JSON.stringify(inputData.metadata.providerMetadata) }
              : {}),
            'stream.response.finishReason': inputData.stepResult.reason,
            'stream.usage.inputTokens': inputData.output.usage?.inputTokens,
            'stream.usage.outputTokens': inputData.output.usage?.outputTokens,
            'stream.usage.totalTokens': inputData.output.usage?.totalTokens,
            ...(telemetry_settings?.recordOutputs !== false
              ? {
                  'stream.response.text': inputData.output.text,
                  'stream.prompt.messages': JSON.stringify(rest.messageList.get.input.aiV5.model()),
                }
              : {}),
          });

          modelStreamSpan.end();

          const reason = inputData.stepResult.reason;

          if (reason === undefined) {
            return false;
          }

          return inputData.stepResult.isContinued;
        })
        .map(({ inputData }) => {
          const toolCalls = rest.messageList.get.response.aiV5
            .model()
            .filter((message: any) => message.role === 'tool');
          inputData.output.toolCalls = toolCalls;

          return inputData;
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

      const executionResult = await run.start({
        inputData: {
          messageId: messageId!,
          messages: {
            all: rest.messageList.get.all.aiV5.model(),
            user: rest.messageList.get.input.aiV5.model(),
            nonUser: [],
          },
        },
        tracingContext: { currentSpan: llmAISpan },
      });

      if (executionResult.status !== 'success') {
        controller.close();
        return;
      }

      if (executionResult.result.stepResult.reason === 'abort') {
        console.log('aborted_result', JSON.stringify(executionResult.result, null, 2));
        controller.close();
        return;
      }

      controller.enqueue({
        type: 'finish',
        runId: rest.runId,
        from: ChunkFrom.AGENT,
        payload: executionResult.result,
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
