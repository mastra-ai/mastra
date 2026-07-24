import { ReadableStream } from 'node:stream/web';
import type { ToolSet } from '@internal/ai-sdk-v5';
import { beginGoalActivity, stopGoalActivity } from '../../agent/goal';
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
import { hydrateRunScopeFromInternal } from '../hydrate-run-scope';
import { readScoped } from '../run-scope-access';
import { AGENT_KEY } from '../run-scope-keys';
import type { LoopRun } from '../types';
import { AGENTIC_EXECUTION_WORKFLOW_ID } from './agentic-execution';
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
  const scopeCtx = { mastra: rest.mastra, runId, _internal };
  return new ReadableStream<ChunkType<OUTPUT>>({
    start: async controller => {
      // Normalize requestContext so data-chunk processors and the agentic loop share the same instance
      const requestContext = rest.requestContext ?? new RequestContext();

      // Create a ProcessorRunner for chunks routed through outputWriter (data-* custom
      // chunks plus lifecycle chunks like step-finish) so they go through output processors.
      // Share the loop's processorStates map so these chunks see the same per-processor state
      // that the main model-output stream path populates; otherwise the runner would build an
      // isolated empty state map and break state continuity across the step lifecycle.
      const hasOutputProcessors = rest.outputProcessors && rest.outputProcessors.length > 0;
      const dataChunkProcessorStates = hasOutputProcessors
        ? (rest.processorStates ?? new Map<string, ProcessorState>())
        : undefined;
      const dataChunkProcessorRunner = hasOutputProcessors
        ? new ProcessorRunner({
            outputProcessors: rest.outputProcessors,
            logger: rest.logger || new ConsoleLogger({ level: 'error' }),
            agent: readScoped(scopeCtx, AGENT_KEY, 'agent'),
            agentName: agentId || 'unknown',
            processorStates: dataChunkProcessorStates,
          })
        : undefined;

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
              dataChunkProcessorStates! as Map<string, ProcessorState<OUTPUT>>,
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
            dataChunkProcessorStates! as Map<string, ProcessorState<OUTPUT>>,
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
        // Register as internal so the evented engine's event processor can
        // resolve `agentic-loop` by id via __hasInternalWorkflow/getWorkflowById.
        // Scope by runId so concurrent/nested agent invocations (parent + sub-agent
        // each owning their own agentic-loop instance with distinct controller and
        // agentId closures) don't clobber each other in the global id-keyed registry.
        // __registerInternalWorkflow also calls __registerMastra under the hood.
        rest.mastra.__registerInternalWorkflow(agenticLoopWorkflow, runId);
        // Hydrate the RunScope from the bootstrap `_internal` bag. Done right
        // after registration so the scope is the single source of truth for
        // non-serializable state by the time any step runs. The scope's
        // refcount is owned by the internal-workflow registration above —
        // no separate release needed here.
        hydrateRunScopeFromInternal(rest.mastra, runId, _internal);
      }

      // Once the run reaches a terminal state its snapshot rows are no longer
      // needed for resume. Delete both the agentic-loop row and the nested
      // execution workflow's row (persisted under the same runId) — otherwise
      // the nested row leaks as a stale "pending"/"suspended" record in
      // workflow snapshot storage for every completed agent run.
      // Best-effort: a cleanup failure must never turn a finished run into a
      // stream error (a stale row is preferable to a broken stream).
      const deleteRunSnapshots = async () => {
        try {
          await agenticLoopWorkflow.deleteWorkflowRunById(runId);
          const workflowsStore = await rest.mastra?.getStorage()?.getStore('workflows');
          await workflowsStore?.deleteWorkflowRunById({ runId, workflowName: AGENTIC_EXECUTION_WORKFLOW_ID });
        } catch (error) {
          rest.logger?.warn('Failed to delete agentic-loop snapshot rows after terminal state', { runId, error });
        }
      };

      // Keep the run-scoped registration alive only when the run suspends — a
      // later resume on the same runId must still resolve this instance. Every
      // other exit (success, failure, or a throw before completion) must drop
      // it via the `finally` below, otherwise a stale workflow holding the old
      // stream/controller closures leaks under this runId.
      let keepRegisteredForResume = false;
      try {
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

        if (typeof requireToolApproval === 'function') {
          // Store the function so the tool-call-step can evaluate it per call. RequestContext.toJSON()
          // strips non-serializable values, so this never reaches the persisted suspend snapshot — that
          // is fine because approval is only decided at call time, before any suspend/resume.
          requestContext.set('__mastra_requireToolApproval', requireToolApproval);
        } else if (requireToolApproval) {
          requestContext.set('__mastra_requireToolApproval', true);
        } else {
          // Clear any value left over from a prior call so a reused RequestContext can't leak a
          // stale function/`true` into a call where approval is no longer required.
          requestContext.delete('__mastra_requireToolApproval');
        }

        if (rest.goal) {
          await beginGoalActivity({
            mastra: rest.mastra,
            agentId,
            threadId: _internal?.threadId,
            runId,
            requestContext,
            now: _internal?.now,
          });
        }

        const executionResult = resumeContext
          ? await run.resume({
              resumeData: resumeContext.resumeData,
              ...createObservabilityContext(rest.modelSpanTracker?.getTracingContext()),
              requestContext,
              actor: rest.actor,
              label: toolCallId,
            })
          : await run.start({
              inputData: initialData,
              ...createObservabilityContext(rest.modelSpanTracker?.getTracingContext()),
              requestContext,
              actor: rest.actor,
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
            await deleteRunSnapshots();
          } else {
            keepRegisteredForResume = true;
          }

          safeClose(controller);
          return;
        }

        await deleteRunSnapshots();

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
      } finally {
        await stopGoalActivity({ agentId, runId, now: _internal?.now });
        if (!keepRegisteredForResume) {
          rest.mastra?.__unregisterInternalWorkflow(agenticLoopWorkflow.id, runId);
        }
      }
    },
  });
}
