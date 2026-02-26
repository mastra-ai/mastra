import { ReadableStream } from 'node:stream/web';
import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../agent/message-list';
import { getErrorFromUnknown } from '../../error';
import type { ProcessorState } from '../../processors';
import { ProcessorRunner } from '../../processors/runner';
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
  // Create a ProcessorRunner for data-* chunks from tool execution so they pass through
  // output processors, just like tool-result chunks do in llm-mapping-step.ts.
  const processorRunner =
    rest.outputProcessors?.length && rest.logger
      ? new ProcessorRunner({
          inputProcessors: [],
          outputProcessors: rest.outputProcessors,
          logger: rest.logger,
          agentName: agentId,
          processorStates: rest.processorStates,
        })
      : undefined;

  return new ReadableStream<ChunkType<OUTPUT>>({
    start: async controller => {
      const requestContext = rest.requestContext ?? new RequestContext();

      const outputWriter = async (chunk: ChunkType<OUTPUT>) => {
        // Process data-* chunks through output processors before enqueueing.
        // Without this, custom chunks written via writer.custom() in tool execute functions
        // bypass the output processor pipeline entirely.
        let processedChunk = chunk;
        if (chunk.type.startsWith('data-') && processorRunner && rest.processorStates) {
          const {
            part: processed,
            blocked,
            reason,
            tripwireOptions,
            processorId,
          } = await processorRunner.processPart(
            chunk,
            rest.processorStates as Map<string, ProcessorState<OUTPUT>>,
            rest.modelSpanTracker?.getTracingContext(),
            requestContext,
            messageList,
            0,
          );

          if (blocked) {
            safeEnqueue(controller, {
              type: 'tripwire',
              runId,
              from: ChunkFrom.AGENT,
              payload: {
                reason: reason || 'Output processor blocked content',
                retry: tripwireOptions?.retry,
                metadata: tripwireOptions?.metadata,
                processorId,
              },
            } as ChunkType<OUTPUT>);
            return;
          }

          if (processed) {
            processedChunk = processed;
          } else {
            // Processor returned null/undefined — skip this chunk
            return;
          }
        }

        // Handle data-* chunks (custom data chunks from writer.custom())
        // These need to be persisted to storage, not just streamed
        if (processedChunk.type.startsWith('data-') && messageId) {
          const dataPart = {
            type: processedChunk.type as `data-${string}`,
            data: 'data' in processedChunk ? processedChunk.data : undefined,
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
        safeEnqueue(controller, processedChunk);
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

      if (requireToolApproval) {
        requestContext.set('__mastra_requireToolApproval', true);
      }

      const executionResult = resumeContext
        ? await run.resume({
            resumeData: resumeContext.resumeData,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
            requestContext,
            label: toolCallId,
          })
        : await run.start({
            inputData: initialData,
            tracingContext: rest.modelSpanTracker?.getTracingContext(),
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
