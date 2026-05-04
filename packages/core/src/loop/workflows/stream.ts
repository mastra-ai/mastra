import { ReadableStream } from 'node:stream/web';
import type { ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../../agent/message-list';
import { getErrorFromUnknown } from '../../error';
import { ConsoleLogger } from '../../logger';
import { createObservabilityContext } from '../../observability';
import { ProcessorRunner } from '../../processors/runner';
import type { ProcessorState } from '../../processors/runner';
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
      // Normalize requestContext so data-chunk processors and the agentic loop share the same instance
      const requestContext = rest.requestContext ?? new RequestContext();

      // Create a ProcessorRunner for data-* chunks so they go through output processors
      const hasOutputProcessors = rest.outputProcessors && rest.outputProcessors.length > 0;
      const dataChunkProcessorRunner = hasOutputProcessors
        ? new ProcessorRunner({
            outputProcessors: rest.outputProcessors,
            logger: rest.logger || new ConsoleLogger({ level: 'error' }),
            agentName: agentId || 'unknown',
          })
        : undefined;
      const dataChunkProcessorStates = hasOutputProcessors ? new Map<string, ProcessorState>() : undefined;

      // Create a ProcessorStreamWriter so output processors can emit custom chunks back to the stream
      const dataChunkStreamWriter = {
        custom: async (data: { type: string }) => {
          safeEnqueue(controller, data as ChunkType<OUTPUT>);
        },
      };

      const outputWriter = async (chunk: ChunkType<OUTPUT>, options?: { messageId?: string }) => {
        // Handle data-* chunks (custom data chunks from writer.custom())
        // These need to be persisted to storage, not just streamed
        // Transient chunks are streamed to the client but not saved to the DB
        if (chunk.type.startsWith('data-')) {
          // Run data-* chunks through output processors before persisting
          let processedChunk = chunk;
          if (dataChunkProcessorRunner) {
            const {
              part: processed,
              blocked,
              reason,
              tripwireOptions,
              processorId,
            } = await dataChunkProcessorRunner.processPart(
              chunk,
              (rest.processorStates ?? dataChunkProcessorStates!) as Map<string, ProcessorState<OUTPUT>>,
              undefined, // observabilityContext
              requestContext,
              messageList,
              0,
              dataChunkStreamWriter,
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
              processedChunk = processed as ChunkType<OUTPUT>;
            } else {
              return;
            }
          }

          // If a processor rewrote the chunk to a non-data type, skip persistence
          const responseMessageId = options?.messageId ?? messageId;
          if (
            typeof processedChunk.type === 'string' &&
            processedChunk.type.startsWith('data-') &&
            responseMessageId &&
            !('transient' in processedChunk && processedChunk.transient)
          ) {
            const dataPart = {
              type: processedChunk.type as `data-${string}`,
              data: 'data' in processedChunk ? processedChunk.data : undefined,
            };
            const message: MastraDBMessage = {
              id: responseMessageId,
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
          return;
        }

        // Non data-* chunks injected via this writer (e.g. `tool-output` from
        // sub-agents delegated through the `agents:` option, or
        // `workflow-step-output` from workflow tools) bypass the LLM's own
        // processor pipeline. Route them through configured output processors
        // here so users can filter/redact nested chunks via processOutputStream.
        if (dataChunkProcessorRunner) {
          const {
            part: processed,
            blocked,
            reason,
            tripwireOptions,
            processorId,
          } = await dataChunkProcessorRunner.processPart(
            chunk,
            (rest.processorStates ?? dataChunkProcessorStates!) as Map<string, ProcessorState<OUTPUT>>,
            undefined,
            requestContext,
            messageList,
            0,
            dataChunkStreamWriter,
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

          if (!processed) return;
          safeEnqueue(controller, processed as ChunkType<OUTPUT>);
          return;
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
        resourceId: _internal?.resourceId,
      });

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
