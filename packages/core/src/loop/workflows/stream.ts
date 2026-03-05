import { ReadableStream } from 'node:stream/web';
import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../agent/message-list';
import { getErrorFromUnknown } from '../../error';
import { createObservabilityContext } from '../../observability';
import { RequestContext } from '../../request-context';
import { safeClose, safeEnqueue } from '../../stream/base';
import type { ChunkType } from '../../stream/types';
import { ChunkFrom } from '../../stream/types';
import type { LoopRun } from '../types';
import { createAgenticLoopWorkflow } from './agentic-loop';

export function workflowLoopStream<Tools extends ToolSet = ToolSet, OUTPUT = undefined>({
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
  toolCallConcurrency,
  ...rest
}: LoopRun<Tools, OUTPUT>) {
  return new ReadableStream<ChunkType<OUTPUT>>({
    start: async controller => {
      const outputWriter = async (chunk: ChunkType<OUTPUT>) => {
        // Handle data-* chunks (custom data chunks from writer.custom())
        // These need to be persisted to storage, not just streamed
        if (chunk.type.startsWith('data-') && messageId) {
          const dataPart = {
            type: chunk.type as `data-${string}`,
            data: 'data' in chunk ? chunk.data : undefined,
          };
          const message: MastraDBMessage = {
            id: messageId,
            role: 'assistant',
            content: {
              format: 2,
              parts: [dataPart],
            },
            createdAt: new Date(),
            threadId: _internal?.threadId,
            resourceId: _internal?.resourceId,
          };
          messageList.add(message, 'response');
        }
        safeEnqueue(controller, chunk);
      };

      const agenticLoopWorkflow = createAgenticLoopWorkflow<Tools, OUTPUT>({
        resumeContext,
        messageId: messageId!,
        models,
        _internal,
        modelSettings,
        toolChoice,
        controller,
        outputWriter,
        runId,
        messageList,
        startTimestamp,
        streamState,
        agentId,
        requireToolApproval,
        toolCallConcurrency,
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
        safeEnqueue(controller, {
          type: 'start',
          runId,
          from: ChunkFrom.AGENT,
          payload: {
            id: agentId,
            messageId,
          },
        });
      }

      const run = await agenticLoopWorkflow.createRun({
        runId,
      });

      const requestContext = rest.requestContext ?? new RequestContext();

      if (requireToolApproval) {
        requestContext.set('__mastra_requireToolApproval', true);
      }

      const executionResult = resumeContext
        ? await run.resume({
            resumeData: resumeContext.resumeData,
            ...createObservabilityContext(rest.modelSpanTracker?.getTracingContext()),
            requestContext,
            label: toolCallId,
          })
        : await run.start({
            inputData: initialData,
            ...createObservabilityContext(rest.modelSpanTracker?.getTracingContext()),
            requestContext,
          });

      if (executionResult.status !== 'success') {
        if (executionResult.status === 'failed') {
          const error = getErrorFromUnknown(executionResult.error, {
            fallbackMessage: 'Unknown error in agent workflow stream',
          });

          safeEnqueue(controller, {
            type: 'error',
            runId,
            from: ChunkFrom.AGENT,
            payload: { error },
          });

          if (rest.options?.onError) {
            await rest.options?.onError?.({ error });
          }
        }

        if (executionResult.status !== 'suspended') {
          await agenticLoopWorkflow.deleteWorkflowRunById(runId);
        }

        safeClose(controller);
        return;
      }

      await agenticLoopWorkflow.deleteWorkflowRunById(runId);

      // Always emit finish chunk, even for abort (tripwire) cases
      // This ensures the stream properly completes and all promises are resolved
      // The tripwire/abort status is communicated through the stepResult.reason
      safeEnqueue(controller, {
        type: 'finish',
        runId,
        from: ChunkFrom.AGENT,
        payload: {
          ...executionResult.result,
          stepResult: {
            ...executionResult.result.stepResult,
            // @ts-expect-error - runtime reason can be 'tripwire' | 'retry' from processors, but zod schema infers as string
            reason: executionResult.result.stepResult.reason,
          },
        },
      });

      safeClose(controller);
    },
  });
}
