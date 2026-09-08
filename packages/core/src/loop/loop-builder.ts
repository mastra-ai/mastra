import { randomUUID } from 'node:crypto';
import type { StepResult, ToolSet } from '@internal/ai-sdk-v5';
import type { MastraDBMessage } from '../memory';
import { InternalSpans } from '../observability';
import { safeEnqueue } from '../stream/base';
import type { ChunkType } from '../stream/types';
import { ChunkFrom } from '../stream/types';
import { createEventedWorkflow, createWorkflow } from '../workflows/create';
import type { Step } from '../workflows/step';
import type { OutputWriter } from '../workflows/types';
import type { Workflow } from '../workflows/workflow';
import type { LoopRuntime, MainLoopIterationState } from './loop-runtime';
import type { RunScopeContext } from './run-scope-access';
import { readScoped, writeScoped } from './run-scope-access';
import { DELEGATION_BAILED_KEY, DRAIN_PENDING_SIGNALS_KEY, RESOURCE_ID_KEY, THREAD_ID_KEY } from './run-scope-keys';
import type { LoopRun } from './types';
import { createBackgroundTaskCheckStep } from './workflows/agentic-execution/background-task-check-step';
import { createGoalStep } from './workflows/agentic-execution/goal-step';
import { createIsTaskCompleteStep } from './workflows/agentic-execution/is-task-complete-step';
import { createLLMExecutionStep } from './workflows/agentic-execution/llm-execution-step';
import { createLLMMappingStep } from './workflows/agentic-execution/llm-mapping-step';
import { createSignalDrainStep } from './workflows/agentic-execution/signal-drain-step';
import {
  normalizeToolCallConcurrency,
  resolveToolCallConcurrency,
} from './workflows/agentic-execution/tool-call-concurrency';
import type { ToolCallForeachOptions } from './workflows/agentic-execution/tool-call-concurrency';
import { createToolCallStep } from './workflows/agentic-execution/tool-call-step';
import { pruneAgentLoopSnapshot } from './workflows/prune-snapshot';
import { llmIterationOutputSchema } from './workflows/schema';
import type { LLMIterationData } from './workflows/schema';

export const AGENTIC_EXECUTION_WORKFLOW_ID = 'executionWorkflow';
export const AGENTIC_LOOP_WORKFLOW_ID = 'agentic-loop';

/**
 * Per-run params the main loop is built from. Mirrors the shape historically
 * accepted by `createAgenticLoopWorkflow` (a `LoopRun` plus the live stream
 * controller and output writer).
 */
export interface AgenticLoopBuilderParams<Tools extends ToolSet = ToolSet, OUTPUT = undefined> extends LoopRun<
  Tools,
  OUTPUT
> {
  controller: ReadableStreamDefaultController<ChunkType<OUTPUT>>;
  outputWriter: OutputWriter;
}

/**
 * Predicate evaluated by the outer dowhile after every iteration. Receives the
 * engine's dowhile callback params; typed loosely because the two engines
 * consume different subsets of it (the main loop only reads `inputData`, the
 * durable loop also reads `getInitData`/`mastra`/the pubsub symbol).
 */
export type LoopContinuationPredicate = (params: any) => Promise<boolean>;

/**
 * Engine-agnostic handle for a loop step. The two engines build steps with
 * different ids and schemas (state flows through workflow context on the main
 * loop vs. serialized iteration state on the durable loop), so the overridable
 * factory surface is typed loosely; each engine's composition works with its
 * own concrete step types internally.
 */
export type LoopStep = Step<string, any, any, any, any, any, any, any>;

/** Engine-agnostic handle for a composed loop workflow (see {@link LoopStep}). */
export type LoopWorkflow = Workflow<any, any, any, any, any, any, any, any>;

/**
 * Builds the agentic loop: an outer `dowhile` workflow wrapping a
 * single-iteration workflow of ten steps (LLM execution → tool calls →
 * mapping → background check → signal drain → isTaskComplete → goal).
 *
 * This concrete base class IS the main (in-process) agent loop. Every step is
 * constructed through an overridable method so engine variants (the durable
 * loop) can subclass it and override behavior surgically instead of
 * maintaining a parallel copy of the topology. During the incremental
 * migration (PHASE3) the durable subclass still overrides whole methods that
 * delegate to its own step files; the end state is that only runtime hooks
 * (state resolution, chunk transport, workflow engine) remain overridden.
 */
export class AgenticLoopBuilder<Tools extends ToolSet = ToolSet, OUTPUT = undefined> {
  readonly #params?: AgenticLoopBuilderParams<Tools, OUTPUT>;

  /**
   * The main loop resolves everything from per-run params captured at
   * construction time. Engine subclasses that resolve their runtime elsewhere
   * (e.g. the durable loop's run registry + serialized state) construct
   * without params — any base method that then touches `this.params` throws,
   * so an incompletely-overridden subclass fails loudly instead of silently
   * running main-loop plumbing.
   */
  constructor(params?: AgenticLoopBuilderParams<Tools, OUTPUT>) {
    this.#params = params;
  }

  protected get params(): AgenticLoopBuilderParams<Tools, OUTPUT> {
    if (!this.#params) {
      throw new Error(
        'AgenticLoopBuilder: main-loop params accessed on a builder constructed without them. ' +
          'Engine subclasses that resolve their runtime elsewhere must override every method that reads `this.params`.',
      );
    }
    return this.#params;
  }

  /**
   * Which workflow engine the loop is composed on. The durable subclass
   * returns `createEventedWorkflow` when the evented engine is selected.
   */
  protected workflowFactory(): typeof createWorkflow | typeof createEventedWorkflow {
    return createWorkflow;
  }

  // ── Runtime hooks ──────────────────────────────────────────────────────
  // The plumbing seams engine subclasses override once, for every consumer,
  // instead of once per step (PHASE3 Step 2 contracts).

  /**
   * Resolve the live, non-serializable view of the run that predicate (and,
   * as they hoist, step) bodies operate through — see {@link LoopRuntime}.
   * The main loop resolves everything from per-run params and RunScope; the
   * durable subclass resolves from serialized iteration state + the run
   * registry.
   *
   * `drainPendingSignals` is normalized here (ledger L13): each engine
   * pre-binds `runId`, so consumers call `rt.drainPendingSignals?.()` and the
   * underlying runtime defaults the scope to `'pending'`.
   */
  protected resolveRuntime(_predicateParams: unknown): LoopRuntime {
    const { _internal, runId, ...rest } = this.params;
    const scopeCtx: RunScopeContext = { mastra: rest.mastra, runId, _internal };
    const drainPendingSignals = readScoped(scopeCtx, DRAIN_PENDING_SIGNALS_KEY, 'drainPendingSignals');
    return {
      runId,
      agentId: rest.agentId,
      agentName: rest.agentName,
      threadId: readScoped(scopeCtx, THREAD_ID_KEY, 'threadId'),
      resourceId: readScoped(scopeCtx, RESOURCE_ID_KEY, 'resourceId'),
      maxSteps: rest.maxSteps,
      mastra: rest.mastra,
      logger: rest.logger,
      stopWhen: rest.stopWhen,
      onIterationComplete: rest.onIterationComplete,
      drainPendingSignals: drainPendingSignals ? scope => drainPendingSignals(runId, scope) : undefined,
    };
  }

  /**
   * Transport hook: deliver a chunk to the run's client-facing stream. The
   * main loop enqueues onto the live stream controller (closed-controller
   * safe); the durable subclass publishes through pubsub.
   */
  protected emitChunk(_runtime: LoopRuntime, chunk: unknown): void | Promise<void> {
    safeEnqueue(this.params.controller, chunk as ChunkType<OUTPUT>);
  }

  // ── Step factories ─────────────────────────────────────────────────────
  // Each delegates to today's step files unchanged. These are the hoisting
  // targets for the shared-core migration (PHASE3 steps 3–5).

  protected llmExecutionStep(toolCallForeachOptions: ToolCallForeachOptions): LoopStep {
    return createLLMExecutionStep<Tools, OUTPUT>({ ...this.params, toolCallForeachOptions });
  }

  protected toolCallStep(): LoopStep {
    return createToolCallStep<Tools, OUTPUT>({ ...this.params });
  }

  protected llmMappingStep(llmExecutionStep: LoopStep): LoopStep {
    return createLLMMappingStep<Tools, OUTPUT>({ ...this.params }, llmExecutionStep as any);
  }

  protected backgroundTaskCheckStep(): LoopStep {
    return createBackgroundTaskCheckStep<Tools, OUTPUT>({ ...this.params });
  }

  protected signalDrainStep(): LoopStep {
    return createSignalDrainStep<Tools, OUTPUT>({ ...this.params });
  }

  protected isTaskCompleteStep(): LoopStep {
    return createIsTaskCompleteStep<Tools, OUTPUT>({ ...this.params });
  }

  protected goalStep(): LoopStep {
    return createGoalStep<Tools, OUTPUT>({ ...this.params });
  }

  // ── Composition ────────────────────────────────────────────────────────

  /**
   * The single-iteration workflow: LLM execution → tool-call foreach →
   * mapping → background check → signal drain → isTaskComplete → goal.
   */
  buildIterationWorkflow(): LoopWorkflow {
    const { _internal, ...rest } = this.params;

    const { limit: configuredToolCallConcurrency, strategy: toolCallConcurrencyStrategy } =
      normalizeToolCallConcurrency(rest.toolCallConcurrency);
    const toolCallForeachOptions: ToolCallForeachOptions = {
      // This initial value is a conservative fallback for resume paths that can enter
      // a suspended foreach before llm-execution recomputes the effective step tools.
      // Use the 'available' strategy here regardless of the configured strategy: the
      // called tool set is not known yet, and map-tool-calls narrows it before the
      // foreach actually consumes this value.
      concurrency: resolveToolCallConcurrency({
        requireToolApproval: rest.requireToolApproval,
        tools: rest.tools,
        activeTools: rest.activeTools as string[] | undefined,
        configuredConcurrency: configuredToolCallConcurrency,
      }),
    };

    const llmExecutionStep = this.llmExecutionStep(toolCallForeachOptions);
    const toolCallStep = this.toolCallStep();
    const llmMappingStep = this.llmMappingStep(llmExecutionStep);
    const backgroundTaskCheckStep = this.backgroundTaskCheckStep();
    const signalDrainStep = this.signalDrainStep();
    const isTaskCompleteStep = this.isTaskCompleteStep();
    const goalStep = this.goalStep();

    return this.workflowFactory()({
      id: AGENTIC_EXECUTION_WORKFLOW_ID,
      inputSchema: llmIterationOutputSchema,
      outputSchema: llmIterationOutputSchema,
      options: {
        tracingPolicy: {
          // mark all workflow spans related to the
          // VNext execution as internal
          internal: InternalSpans.WORKFLOW,
        },
        shouldPersistSnapshot: params => {
          // We need a persisted snapshot record to support `resumeStream()`.
          // - Create the initial record early ("pending")
          // - Update it when execution is suspended ("paused"/"suspended")
          // Avoid persisting "running" snapshots so we don't overwrite an existing suspended snapshot.
          return (
            params.workflowStatus === 'pending' ||
            params.workflowStatus === 'paused' ||
            params.workflowStatus === 'suspended'
          );
        },
        // Excluding `running` means resume claims cannot persist; the agent loop
        // serializes its own resumes, so suppress the per-resume warning.
        allowUnclaimedResumes: true,
        // Agent-loop snapshots are pure resume artifacts — strip everything a
        // resume never reads (stale suspend payloads, duplicated message
        // arrays, AI SDK step history) before persisting.
        pruneSnapshot: pruneAgentLoopSnapshot,
        validateInputs: false,
      },
    })
      .then(llmExecutionStep)
      .map(
        async ({ inputData }) => {
          const typedInputData = inputData as LLMIterationData<Tools, OUTPUT>;
          const toolCalls = typedInputData.output.toolCalls || [];
          // Recompute concurrency now that the model has emitted its tool calls.
          //
          // Default ('available') strategy: resolve from the step's effective
          // active tool set (set by llm-execution-step), NOT from the tools the
          // model actually called. A registered approval/suspending tool that the
          // model did not call this step must still force sequential execution.
          //
          // Opt-in ('called') strategy: resolve from the tools the model actually
          // called this step. A pure-safe batch parallelizes even while an
          // approval/suspend tool stays registered; a batch that calls one still
          // serializes; run-wide requireToolApproval still forces sequential.
          const stepActiveTools = _internal?.stepActiveTools as string[] | undefined;
          toolCallForeachOptions.concurrency = resolveToolCallConcurrency({
            requireToolApproval: rest.requireToolApproval,
            tools: ((_internal?.stepTools as Tools | undefined) ?? rest.tools) as Tools | undefined,
            activeTools: stepActiveTools,
            configuredConcurrency: configuredToolCallConcurrency,
            strategy: toolCallConcurrencyStrategy,
            calledToolNames: toolCalls.map(toolCall => toolCall.toolName),
          });
          return toolCalls;
        },
        { id: 'map-tool-calls' },
      )
      .foreach(toolCallStep, toolCallForeachOptions)
      .then(llmMappingStep)
      .then(backgroundTaskCheckStep)
      .then(signalDrainStep)
      .then(isTaskCompleteStep)
      .then(goalStep)
      .commit();
  }

  /**
   * The dowhile predicate: decides after each iteration whether the loop
   * continues. Owns resume seal-and-rotate (#19445), inter-iteration signal
   * draining, stopWhen evaluation, the onIterationComplete hook, delegation
   * bail, and step accumulation.
   */
  protected buildContinuationPredicate(): LoopContinuationPredicate {
    const { _internal, runId, messageList, outputWriter, ...rest } = this.params;

    const scopeCtx: RunScopeContext = { mastra: rest.mastra, runId, _internal };

    // Between-iterations loop state, converged onto the engine-agnostic
    // contract shape (the durable loop flows the same shape through workflow
    // input/output as serialized state; here it stays in memory, owned by
    // this predicate closure).
    const state: MainLoopIterationState<StepResult<Tools>> = {
      // Steps accumulated across iterations, passed to stopWhen
      accumulatedSteps: [],
      // Content length seen so far — determines what's new in each step
      previousContentLength: 0,
      // When continue:false + feedback, allow one more LLM turn then stop
      pendingFeedbackStop: false,
      // When this loop is a resume (e.g. after tool approval), the suspended run
      // already flushed its in-progress assistant message to storage. The first
      // continuation must start a fresh response message instead of merging into
      // that persisted row — see the guard in the predicate below (issue #19445).
      resumeContinuationPending: !!rest.resumeContext,
    };

    return async (predicateParams: any) => {
      const rt = this.resolveRuntime(predicateParams);
      const typedInputData = predicateParams.inputData as LLMIterationData<Tools, OUTPUT>;
      let hasFinishedSteps = false;

      // First loop-back after a resume: the suspended run flushed its
      // in-progress assistant message (reasoning + text + the pending
      // tool-call) to storage before parking. The approved tool result has
      // now attached to that same message — which is correct, it resolves the
      // message's own tool call — but everything the model produces from here
      // is a separate response and must NOT merge back into the persisted row.
      // Appending a second response's parts mutates the row in place, and
      // providers that sign reasoning blocks (Anthropic extended thinking)
      // then reject the next turn ("thinking blocks in the latest assistant
      // message cannot be modified"). Seal the flushed message and rotate to a
      // fresh response message for the continuation. See issue #19445.
      if (state.resumeContinuationPending) {
        state.resumeContinuationPending = false;
        const nextMessageId = rest.rotateResponseMessageId(
          typedInputData.stepResult?.messageId ?? typedInputData.messageId,
        );
        typedInputData.messageId = nextMessageId;
        if (typedInputData.stepResult) {
          typedInputData.stepResult.messageId = nextMessageId;
          typedInputData.stepResult.isContinued = true;
        }
      }

      const pendingSignals = rt.drainPendingSignals?.() ?? [];
      if (pendingSignals.length > 0) {
        const nextMessageId = rest.rotateResponseMessageId(
          typedInputData.stepResult?.messageId ?? typedInputData.messageId,
        );
        typedInputData.messageId = nextMessageId;
        for (const pendingSignal of pendingSignals) {
          const signalForTranscript = messageList.addSignal(pendingSignal);
          await this.emitChunk(rt, signalForTranscript.toDataPart());
        }
        if (typedInputData.stepResult) {
          typedInputData.stepResult.messageId = nextMessageId;
          typedInputData.stepResult.isContinued = true;
        }
        typedInputData.messages = {
          all: messageList.get.all.aiV5.model(),
          user: messageList.get.input.aiV5.model(),
          nonUser: messageList.get.response.aiV5.model(),
        };
      }

      if (state.pendingFeedbackStop) {
        hasFinishedSteps = true;
        state.pendingFeedbackStop = false;
      }

      const allContent: StepResult<Tools>['content'] = typedInputData.messages.nonUser.flatMap(
        message => message.content as unknown as StepResult<Tools>['content'],
      );

      // Only include new content in this step (content added since the previous iteration)
      const currentContent = allContent.slice(state.previousContentLength);
      state.previousContentLength = allContent.length;

      const toolResultParts = currentContent.filter(part => part.type === 'tool-result');

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
        toolResults: toolResultParts as StepResult<Tools>['toolResults'],
        sources: typedInputData.output.sources || [],
        staticToolCalls: typedInputData.output.staticToolCalls || [],
        dynamicToolCalls: typedInputData.output.dynamicToolCalls || [],
        staticToolResults: toolResultParts.filter(
          (part: any) => part.dynamic === false,
        ) as StepResult<Tools>['staticToolResults'],
        dynamicToolResults: toolResultParts.filter(
          (part: any) => part.dynamic === true,
        ) as StepResult<Tools>['dynamicToolResults'],
        providerMetadata: typedInputData.metadata?.providerMetadata,
      };

      state.accumulatedSteps.push(currentStep);

      // Only call stopWhen if we're continuing (not on the final step)
      if (rt.stopWhen && typedInputData.stepResult?.isContinued && state.accumulatedSteps.length > 0) {
        // Cast steps to any for v5/v6 StopCondition compatibility
        // v5 and v6 StepResult types have minor differences (e.g., rawFinishReason, finishReason format)
        // but are compatible at runtime for stop condition evaluation
        const steps = state.accumulatedSteps as any;
        const conditions = await Promise.all(
          (Array.isArray(rt.stopWhen) ? rt.stopWhen : [rt.stopWhen]).map(condition => {
            return condition({ steps });
          }),
        );

        const hasStopped = conditions.some(condition => condition);
        hasFinishedSteps = hasFinishedSteps || hasStopped;
      }

      // Call onIterationComplete hook if provided (call for every iteration, not just continued ones)
      if (rt.onIterationComplete && !typedInputData.backgroundTaskPending) {
        const isFinal = !typedInputData.stepResult?.isContinued || hasFinishedSteps;
        const iterationContext = {
          iteration: state.accumulatedSteps.length,
          maxIterations: rt.maxSteps,
          text: typedInputData.output.text || '',
          toolCalls: (typedInputData.output.toolCalls || []).map((tc: any) => ({
            id: tc.toolCallId || tc.id || '',
            name: tc.toolName || tc.name || '',
            args: (tc.args || {}) as Record<string, unknown>,
          })),
          toolResults: toolResultParts.map(tr => ({
            id: tr.toolCallId,
            name: tr.toolName,
            result: unwrapToolResultOutput(tr.output),
          })),
          isFinal,
          finishReason: typedInputData.stepResult?.reason || 'unknown',
          runId: runId,
          threadId: rt.threadId,
          resourceId: rt.resourceId,
          agentId: rt.agentId,
          agentName: rt.agentName || rt.agentId,
          messages: messageList.get.all.db(),
        };

        try {
          const iterationResult = await rt.onIterationComplete(iterationContext);

          if (iterationResult) {
            if (iterationResult.feedback && typedInputData.stepResult?.isContinued) {
              messageList.add(
                {
                  id: rt.mastra?.generateId() || randomUUID(),
                  createdAt: new Date(),
                  type: 'text',
                  role: 'assistant',
                  content: {
                    parts: [
                      {
                        type: 'text',
                        text: iterationResult.feedback,
                      },
                    ],
                    metadata: {
                      mode: 'stream',
                      completionResult: {
                        suppressFeedback: true,
                      },
                    },
                    format: 2,
                  },
                } as MastraDBMessage,
                'response',
              );

              if (iterationResult.continue === false) {
                state.pendingFeedbackStop = true;
              } else if (!hasFinishedSteps && rt.maxSteps && state.accumulatedSteps.length < rt.maxSteps) {
                hasFinishedSteps = false;
                typedInputData.stepResult.isContinued = true;
              }
            } else if (iterationResult.continue === false && !hasFinishedSteps) {
              hasFinishedSteps = true;
            } else if (
              iterationResult.continue === true &&
              (hasFinishedSteps || !typedInputData.stepResult?.isContinued)
            ) {
              if ((rt.maxSteps && state.accumulatedSteps.length < rt.maxSteps) || !rt.maxSteps) {
                hasFinishedSteps = false;
                if (typedInputData.stepResult) {
                  typedInputData.stepResult.isContinued = true;
                }
              }
            }
          }
        } catch (error) {
          // Log error but don't fail the iteration
          rt.logger?.error('Error in onIterationComplete hook:', error);
        }
      }

      // Check if a delegation hook called ctx.bail() — stop the loop after this iteration
      if (!hasFinishedSteps && readScoped(scopeCtx, DELEGATION_BAILED_KEY, '_delegationBailed')) {
        hasFinishedSteps = true;
        writeScoped(scopeCtx, DELEGATION_BAILED_KEY, '_delegationBailed', false);
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
        await outputWriter({
          type: 'step-finish',
          runId,
          from: ChunkFrom.AGENT,
          payload: typedInputData,
        });
      }

      const reason = typedInputData.stepResult?.reason;

      if (reason === undefined) {
        return false;
      }

      return typedInputData.stepResult?.isContinued ?? false;
    };
  }

  /**
   * The outer loop workflow: dowhile(iteration workflow, continuation
   * predicate).
   */
  build(): LoopWorkflow {
    return this.workflowFactory()({
      id: AGENTIC_LOOP_WORKFLOW_ID,
      inputSchema: llmIterationOutputSchema,
      outputSchema: llmIterationOutputSchema,
      options: {
        tracingPolicy: {
          // mark all workflow spans related to the
          // VNext execution as internal
          internal: InternalSpans.WORKFLOW,
        },
        shouldPersistSnapshot: params => {
          // We need a persisted snapshot record to support `resumeStream()`.
          // - Create the initial record early ("pending")
          // - Update it when execution is suspended ("paused"/"suspended")
          // Avoid persisting "running" snapshots so we don't overwrite an existing suspended snapshot.
          return (
            params.workflowStatus === 'pending' ||
            params.workflowStatus === 'paused' ||
            params.workflowStatus === 'suspended'
          );
        },
        // Excluding `running` means resume claims cannot persist; the agent loop
        // serializes its own resumes, so suppress the per-resume warning.
        allowUnclaimedResumes: true,
        // Agent-loop snapshots are pure resume artifacts — strip everything a
        // resume never reads (stale suspend payloads, duplicated message
        // arrays, AI SDK step history) before persisting.
        pruneSnapshot: pruneAgentLoopSnapshot,
        validateInputs: false,
      },
    })
      .dowhile(this.buildIterationWorkflow(), this.buildContinuationPredicate())
      .commit();
  }
}

function unwrapToolResultOutput(output: unknown): unknown {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    return output;
  }

  const record = output as Record<string, unknown>;
  if (!('value' in record)) {
    return output;
  }

  switch (record.type) {
    case 'text':
    case 'json':
    case 'error-text':
    case 'error-json':
    case 'content':
      return record.value;
    default:
      return output;
  }
}
