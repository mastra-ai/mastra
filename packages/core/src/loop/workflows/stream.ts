import { ReadableStream } from 'stream/web';
import type { ToolSet } from 'ai-v5';
import type { OutputSchema } from '../../stream/base/schema';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import type { LoopRun } from '../types';
import { createAgenticLoopWorkflow } from './agentic-loop';

/**
 * Check if a ReadableStreamDefaultController is open and can accept data.
 * Controllers are closed when desiredSize is 0 or null (errored).
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
  telemetry_settings,
  models,
  toolChoice,
  modelSettings,
  _internal,
  modelStreamSpan,
  llmAISpan,
  messageId,
  runId,
  messageList,
  startTimestamp,
  streamState,
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

      const agenticLoopWorkflow = createAgenticLoopWorkflow<Tools, OUTPUT>({
        resumeContext,
        requireToolApproval,
        messageId: messageId!,
        models,
        telemetry_settings,
        _internal,
        modelSettings,
        toolChoice,
        modelStreamSpan,
        controller,
        writer,
        runId,
        messageList,
        startTimestamp,
        streamState,
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

      const msToFirstChunk = _internal?.now?.()! - startTimestamp!;

      modelStreamSpan.addEvent('ai.stream.firstChunk', {
        'ai.response.msToFirstChunk': msToFirstChunk,
      });

      modelStreamSpan.setAttributes({
        'stream.response.timestamp': new Date(startTimestamp).toISOString(),
        'stream.response.msToFirstChunk': msToFirstChunk,
      });

      if (!resumeContext) {
        controller.enqueue({
          type: 'start',
          runId,
          from: ChunkFrom.AGENT,
          payload: {},
        });
      }

      const existingSnapshot = await rest.mastra?.getStorage()?.loadWorkflowSnapshot({
        workflowName: 'agentic-loop',
        runId,
      });
      if (existingSnapshot) {
        for (const key in existingSnapshot?.context) {
          const step = existingSnapshot?.context[key];
          if (step && step.status === 'suspended' && step.suspendPayload?.__streamState) {
            streamState.deserialize(step.suspendPayload?.__streamState);
            break;
          }
        }
      }

      const run = await agenticLoopWorkflow.createRunAsync({
        runId,
      });

      const executionResult = resumeContext
        ? await run.resume({
            resumeData: resumeContext,
            tracingContext: { currentSpan: llmAISpan },
          })
        : await run.start({
            inputData: initialData,
            tracingContext: { currentSpan: llmAISpan },
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

      const msToFinish = (_internal?.now?.() ?? Date.now()) - startTimestamp;
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
