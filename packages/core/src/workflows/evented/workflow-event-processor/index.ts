import { randomUUID } from 'node:crypto';
import EventEmitter from 'node:events';
import { ErrorCategory, ErrorDomain, MastraError, getErrorFromUnknown } from '../../../error';
import { EventProcessor } from '../../../events/processor';
import type { Event } from '../../../events/types';
import type { Mastra } from '../../../mastra';
import type { TracingContext } from '../../../observability';
import { RequestContext } from '../../../request-context/';
import type { StepExecutionStrategy } from '../../../worker/types';
import type { Step } from '../../../workflows/step';
import type {
  RestartExecutionParams,
  StepFlowEntry,
  StepResult,
  StepSuccess,
  TimeTravelExecutionParams,
  WorkflowRunState,
} from '../../../workflows/types';
import type { Workflow } from '../../../workflows/workflow';
import { getInnerStepId, materializeInnerStep } from '../../inner-step';
import {
  createRestartExecutionParams,
  createTimeTravelExecutionParams,
  getSingleStepEntryId,
  getStepIds,
  isSingleStepEntry,
  validateStepResumeData,
} from '../../utils';
import { createMappingStep, createStepFromAgent, createStepFromTool } from '../../workflow';
import { resolveCurrentState } from '../helpers';
import { StepExecutor } from '../step-executor';
import { EventedWorkflow } from '../workflow';
import { processWorkflowForEach, processWorkflowLoop } from './loop';
import { processWorkflowConditional, processWorkflowParallel } from './parallel';
import { processWorkflowSleep, processWorkflowSleepUntil, processWorkflowWaitForEvent } from './sleep';
import { getNestedWorkflow, getStep, isExecutableStep } from './utils';

export type ProcessorArgs = {
  activeStepsPath: Record<string, number[]>;
  workflow: Workflow;
  workflowId: string;
  runId: string;
  executionPath: number[];
  stepResults: Record<string, StepResult<any, any, any, any>>;
  resumeSteps: string[];
  prevResult: StepResult<any, any, any, any>;
  requestContext: Record<string, any>;
  timeTravel?: TimeTravelExecutionParams;
  restart?: RestartExecutionParams;
  resumeData?: any;
  parentWorkflow?: ParentWorkflow;
  parentContext?: {
    workflowId: string;
    input: any;
  };
  retryCount?: number;
  perStep?: boolean;
  format?: 'legacy' | 'vnext';
  state?: Record<string, any>;
  outputOptions?: {
    includeState?: boolean;
    includeResumeLabels?: boolean;
  };
  forEachIndex?: number;
  nestedRunId?: string; // runId of nested workflow when reporting back to parent
};

export type ParentWorkflow = {
  workflowId: string;
  runId: string;
  executionPath: number[];
  resume: boolean;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  parentWorkflow?: ParentWorkflow;
  timeTravel?: TimeTravelExecutionParams;
  restart?: RestartExecutionParams;
  stepId: string;
  stepGraph: StepFlowEntry[];
  activeStepsPath: Record<string, number[]>;
  resumeSteps: string[];
  resumeData: any;
  input: any;
  parentContext?: {
    workflowId: string;
    input: any;
  };
};

/**
 * The run event a graph entry should be scheduled with. Declarative single
 * step-like entries (agent / tool / mapping) each get their own per-type run
 * event so the evented engine can interpret them explicitly; every other entry
 * (plain step / loop / foreach / parallel / conditional / sleep) uses the
 * generic `workflow.step.run`. `Event.type` is just a string so no event union
 * needs widening.
 */
/**
 * A foreach step stores its per-iteration state in a shape that layers on top
 * of {@link StepResult}: the `payload` is the input array and `output` is the
 * (partial) array of iteration results, with any per-iteration `suspendPayload`
 * shape flowing through. This helper narrows the union so call sites that
 * specifically consume foreach state don't need `as any`, while keeping the
 * per-iteration item shape untyped (it varies by inner step).
 */
type ForeachIterationResult = null | {
  status?: string;
  output?: unknown;
  suspendPayload?: any;
  [key: string]: unknown;
};
type ForeachStepResult = {
  output?: ForeachIterationResult[];
  payload?: unknown[];
  status?: string;
  startedAt?: number;
  [key: string]: unknown;
};

function readForeachResult(
  stepResults: Record<string, StepResult<any, any, any, any>>,
  id: string,
): ForeachStepResult | undefined {
  const result = stepResults[id] as (StepResult<any, any, any, any> & ForeachStepResult) | undefined;
  return result;
}

export function stepRunEventType(entry: StepFlowEntry | undefined): string {
  switch (entry?.type) {
    case 'agent':
      return 'workflow.agent.run';
    case 'tool':
      return 'workflow.tool.run';
    case 'mapping':
      return 'workflow.mapping.run';
    default:
      return 'workflow.step.run';
  }
}

/**
 * Resolve the graph entry targeted by an execution path, descending into the
 * picked child of a `parallel` / `conditional` block when the path points at
 * one. Mirrors the child-pick the processors do inline.
 */
export function getEntryAtPath(stepGraph: StepFlowEntry[], executionPath: number[]): StepFlowEntry | undefined {
  let entry: StepFlowEntry | undefined = stepGraph[executionPath[0]!];
  if ((entry?.type === 'parallel' || entry?.type === 'conditional') && executionPath.length > 1) {
    entry = entry.steps[executionPath[1]!];
  }
  return entry;
}

export class WorkflowEventProcessor extends EventProcessor {
  private stepExecutor: StepExecutor;
  private stepExecutionStrategy?: StepExecutionStrategy;
  // Map of runId -> AbortController for active workflow runs
  private abortControllers: Map<string, AbortController> = new Map();
  // Map of child runId -> parent runId for tracking nested workflows
  private parentChildRelationships: Map<string, string> = new Map();
  private runFormats: Map<string, 'legacy' | 'vnext' | undefined> = new Map();
  // Map of event.id -> number of times we've returned { retry: true } for it.
  // Used to cap transport-level redelivery so a poisoned event (e.g. sustained
  // SQLITE_BUSY) eventually surfaces as a terminal workflow.fail rather than
  // silently hanging agent.generate().
  private deliveryAttempts: Map<string, number> = new Map();
  // Maximum number of times handle() will ask the transport to redeliver the
  // same event before declaring it terminally failed. The underlying storage
  // layer already retries lock errors internally (~5 attempts with backoff)
  // so 3 transport-level redeliveries is enough headroom for transient
  // failures without keeping a poisoned event in flight for minutes.
  private static readonly MAX_DELIVERY_ATTEMPTS = 3;
  // Sentinel value stored in deliveryAttempts to mark an event whose terminal
  // workflow.fail has already been published. Any subsequent redelivery of
  // the same logical event short-circuits as terminal and does NOT re-run
  // errorWorkflow or reset the per-event budget.
  private static readonly TERMINAL_SENTINEL = Number.POSITIVE_INFINITY;
  // Upper bound on entries kept in deliveryAttempts so a long-lived processor
  // can't grow the map without limit. When the map exceeds this size we evict
  // the oldest entries in insertion order (Map preserves insertion order). The
  // cap is high enough that a realistic burst of concurrent runs never trims
  // an entry mid-retry, but low enough to bound memory.
  private static readonly DELIVERY_ATTEMPTS_MAX_ENTRIES = 1024;

  // How long after a run reaches a terminal state before its
  // `workflow.events.v2.<runId>` topic is cleared from the pubsub. The
  // terminal `workflow-finish` watch event is published to that same topic,
  // so deletion must lag long enough for attached watchers/streams to drain
  // it. Mirrors DurableAgent's cleanupTimeoutMs default. 0 disables cleanup.
  private readonly topicCleanupDelayMs: number;
  private static readonly DEFAULT_TOPIC_CLEANUP_DELAY_MS = 30_000;

  // Pending per-run topic cleanup timers, so a run restarted in this process
  // (timeTravel/restart reuse the runId) cancels its own pending deletion.
  private readonly pendingTopicCleanups = new Map<string, ReturnType<typeof setTimeout>>();

  // Statuses under which a run is still (or again) writing to its watch
  // topic. If the run was restarted via timeTravel/restart after its terminal
  // end, deletion must be skipped — the new execution reschedules cleanup
  // when it reaches its own terminal state.
  private static readonly ACTIVE_RUN_STATUSES: ReadonlySet<string> = new Set([
    'running',
    'pending',
    'waiting',
    'suspended',
    'paused',
  ]);

  constructor({
    mastra,
    stepExecutionStrategy,
    topicCleanupDelayMs,
  }: {
    mastra: Mastra;
    stepExecutionStrategy?: StepExecutionStrategy;
    topicCleanupDelayMs?: number;
  }) {
    super({ mastra });
    this.stepExecutor = new StepExecutor({ mastra });
    this.stepExecutionStrategy = stepExecutionStrategy;
    this.topicCleanupDelayMs = topicCleanupDelayMs ?? WorkflowEventProcessor.DEFAULT_TOPIC_CLEANUP_DELAY_MS;
  }

  /**
   * Schedule deletion of a finished run's `workflow.events.v2.<runId>` topic.
   *
   * Per-run watch topics are written by every step of a run; on transports
   * that retain messages (e.g. Redis Streams) they would otherwise live
   * forever once the run ends. Deletion is delayed so subscribers still
   * draining the terminal `workflow-finish` event aren't cut off, and
   * fire-and-forget because topic cleanup must never affect run completion.
   *
   * Best-effort by design: if the process exits before the timer fires, the
   * transport-level idle TTL (e.g. `streamIdleTtlMs`) is the backstop.
   *
   * A finished run can be re-executed under the same runId (`timeTravel`,
   * `restart`), so deletion is double-guarded: a restart processed by this
   * process cancels the pending timer directly, and when the timer fires we
   * re-check the run's persisted status — a restart may have been picked up
   * by a different worker process — and skip deletion while the run is
   * active again.
   */
  private scheduleRunTopicCleanup(workflowId: string, runId: string): void {
    if (this.topicCleanupDelayMs <= 0) return;
    this.cancelRunTopicCleanup(runId);
    const timer = setTimeout(() => {
      this.pendingTopicCleanups.delete(runId);
      void this.clearRunTopicUnlessActive(workflowId, runId);
    }, this.topicCleanupDelayMs);
    // Don't let a pending cleanup timer keep a short-lived process alive.
    timer.unref?.();
    this.pendingTopicCleanups.set(runId, timer);
  }

  private cancelRunTopicCleanup(runId: string): void {
    const timer = this.pendingTopicCleanups.get(runId);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.pendingTopicCleanups.delete(runId);
    }
  }

  private async clearRunTopicUnlessActive(workflowId: string, runId: string): Promise<void> {
    try {
      // Without a storage backend there is no way to observe a cross-process
      // restart, so we delete unconditionally — the in-process timer
      // cancellation in processWorkflowStart still covers same-process
      // restarts. The status check below is also not atomic with the delete:
      // a restart persisting `running` between the read and the DEL can still
      // lose its topic. That window is milliseconds (vs. the full cleanup
      // delay without this guard) and self-heals — persistent transports
      // recover subscribers on the next publish (e.g. Redis NOGROUP
      // recreation). Closing it fully would require distributed locking,
      // which best-effort topic cleanup does not justify.
      const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
      if (workflowsStore) {
        const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflowId, runId });
        const status = typeof snapshot === 'string' ? undefined : snapshot?.status;
        // Run was restarted (possibly by another worker process) after the
        // terminal end that scheduled this cleanup: it is writing to its
        // topic again, and its own terminal end will reschedule deletion.
        if (status && WorkflowEventProcessor.ACTIVE_RUN_STATUSES.has(status)) return;
      }
      await this.mastra.pubsub.clearTopic(`workflow.events.v2.${runId}`);
    } catch (err) {
      this.mastra.getLogger()?.warn('Failed to clear workflow events topic', { workflowId, runId, error: err });
    }
  }

  /**
   * Get or create an AbortController for a workflow run
   */
  private getOrCreateAbortController(runId: string): AbortController {
    let controller = this.abortControllers.get(runId);
    if (!controller) {
      controller = new AbortController();
      this.abortControllers.set(runId, controller);
    }
    return controller;
  }

  /**
   * Cancel a workflow run and all its nested child workflows
   */
  private cancelRunAndChildren(runId: string): void {
    // Abort the controller for this run
    const controller = this.abortControllers.get(runId);
    if (controller) {
      controller.abort();
    }

    // Find and cancel all child workflows
    for (const [childRunId, parentRunId] of this.parentChildRelationships.entries()) {
      if (parentRunId === runId) {
        this.cancelRunAndChildren(childRunId);
      }
    }
  }

  /**
   * Clean up abort controller and relationships when a workflow completes.
   * Also cleans up any orphaned child entries that reference this run as parent.
   */
  private cleanupRun(runId: string): void {
    this.abortControllers.delete(runId);
    this.parentChildRelationships.delete(runId);
    this.runFormats.delete(runId);

    // Clean up any orphaned child entries pointing to this run as their parent
    for (const [childRunId, parentRunId] of this.parentChildRelationships.entries()) {
      if (parentRunId === runId) {
        this.parentChildRelationships.delete(childRunId);
      }
    }
  }

  /**
   * Resolves the tracing context for a run, walking up the parent chain so a
   * nested workflow run (e.g. `agentic-execution` inside `agentic-loop`)
   * inherits its parent's parent span. `EventedRun.start` records the context
   * on Mastra keyed by runId; nested runs are only registered against their
   * parent.
   */
  private resolveRunTracingContext(runId: string): TracingContext | undefined {
    const seen = new Set<string>();
    let current: string | undefined = runId;
    while (current && !seen.has(current)) {
      seen.add(current);
      const ctx = this.mastra.__getRunTracingContext(current);
      if (ctx) return ctx;
      current = this.parentChildRelationships.get(current);
    }
    return undefined;
  }

  /**
   * Snapshot of the run's current span as the {traceId, spanId, parentSpanId} shape that
   * `UpdateWorkflowStateOptions.tracingContext` expects, so a suspend's persisted snapshot
   * can stitch the resumed AGENT_RUN/WORKFLOW_RUN span back to the original trace. Mirrors
   * `default.ts`'s `persistTracingContext`; the evented engine holds the live span on
   * Mastra (since it can't ride pubsub events), so we resolve it via runId here.
   */
  private resolveSuspendTracingContext(
    runId: string,
  ): { traceId?: string; spanId?: string; parentSpanId?: string } | undefined {
    const span = this.resolveRunTracingContext(runId)?.currentSpan as
      { id?: string; traceId?: string; getParentSpanId?: () => string | undefined } | undefined;
    if (!span) return undefined;
    return { traceId: span.traceId, spanId: span.id, parentSpanId: span.getParentSpanId?.() };
  }

  /**
   * Applies the workflow's `pruneSnapshot` option to an already-persisted snapshot.
   *
   * The evented engine persists suspensions via merge operations
   * (`updateWorkflowResults` + `updateWorkflowState`) rather than writing a full
   * snapshot object, so the prune hook can't intercept the write itself. Instead,
   * after the merge completes, we load the merged snapshot, prune it, and
   * re-persist the full row. No-op when the workflow has no `pruneSnapshot` option.
   */
  private async pruneAndRepersistSnapshot({
    workflow,
    workflowId,
    runId,
  }: {
    workflow: Workflow | undefined;
    workflowId: string;
    runId: string;
  }): Promise<void> {
    const pruneSnapshot = workflow?.options?.pruneSnapshot;
    if (!pruneSnapshot) return;
    try {
      const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
      if (!workflowsStore) return;
      const run = await workflowsStore.getWorkflowRunById({ runId, workflowName: workflowId });
      const snapshot = run?.snapshot;
      if (!snapshot || typeof snapshot === 'string') return;
      const pruned = pruneSnapshot({ snapshot, workflowStatus: snapshot.status });
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflowId,
        runId,
        resourceId: run?.resourceId,
        snapshot: pruned,
      });
    } catch (error) {
      // Pruning is a size optimization — never fail the suspension over it.
      this.mastra.getLogger()?.warn?.(`Failed to prune workflow snapshot for run ${runId}: ${error}`);
    }
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.stepExecutor.__registerMastra(mastra);
  }

  /**
   * Resolves a workflow by id without throwing. Searches first by the
   * workflow's `.id` (the value that ends up on event payloads) and then
   * falls back to the registration key in `Mastra.workflows`. Returns
   * `undefined` if neither lookup succeeds — callers decide how to handle
   * the missing case (e.g. terminal failure vs. cleanup pass-through) so
   * we don't throw inside `#dispatch` and trigger infinite event retries.
   */
  #tryResolveWorkflow(workflowId: string): Workflow | undefined {
    try {
      return this.mastra.getWorkflowById(workflowId) as Workflow;
    } catch {
      return undefined;
    }
  }

  private async errorWorkflow(
    {
      parentWorkflow,
      workflowId,
      runId,
      resumeSteps,
      stepResults,
      resumeData,
      requestContext,
    }: Omit<ProcessorArgs, 'workflow'>,
    e: Error,
  ) {
    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.fail',
      runId,
      data: {
        workflowId,
        runId,
        executionPath: [],
        resumeSteps,
        stepResults,
        prevResult: { status: 'failed', error: getErrorFromUnknown(e).toJSON() },
        requestContext,
        resumeData,
        activeStepsPath: {},
        parentWorkflow: parentWorkflow,
      },
    });
  }

  protected async processWorkflowCancel({ workflowId, runId, prevResult, ...args }: ProcessorArgs) {
    // Cancel this workflow and all nested child workflows
    this.cancelRunAndChildren(runId);

    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const currentState = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: workflowId,
      runId,
    });

    if (!currentState) {
      this.mastra.getLogger()?.warn('Canceling workflow without loaded state', { workflowId, runId });
    }

    //call end workflow with status of canceled to indicate the workflow was canceled
    await this.endWorkflow(
      {
        workflowId,
        runId,
        prevResult,
        ...args,
      },
      'canceled',
    );
  }

  protected async processWorkflowStart({
    workflow,
    parentWorkflow,
    workflowId,
    runId,
    resumeSteps,
    prevResult,
    resumeData,
    timeTravel,
    restart,
    executionPath,
    stepResults,
    requestContext,
    perStep,
    format,
    state,
    outputOptions,
    forEachIndex,
  }: ProcessorArgs & { initialState?: Record<string, any> }) {
    // Use initialState from event data if provided, otherwise use state from ProcessorArgs
    const initialState = (arguments[0] as any).initialState ?? state ?? {};
    const resolvedFormat = format ?? this.runFormats.get(runId);
    this.runFormats.set(runId, resolvedFormat);
    // The run is starting (or restarting via timeTravel/restart under the
    // same runId): any topic cleanup pending from a previous terminal end
    // must not fire while the run is writing to its topic again.
    this.cancelRunTopicCleanup(runId);
    // Create abort controller for this workflow run
    this.getOrCreateAbortController(runId);

    // Track parent-child relationship if this is a nested workflow
    if (parentWorkflow?.runId) {
      this.parentChildRelationships.set(runId, parentWorkflow.runId);
    }
    // Preserve resourceId from existing snapshot if present
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const existingRun = await workflowsStore?.getWorkflowRunById({ runId, workflowName: workflow.id });
    const resourceId = existingRun?.resourceId;

    // Check shouldPersistSnapshot option - default to true if not specified
    // This is particularly important for resume: if shouldPersist returns false for 'running',
    // we shouldn't overwrite the existing 'suspended' status with 'running'
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: 'running',
      }) ?? true;

    if (shouldPersist) {
      const runningSnapshot: WorkflowRunState = {
        activePaths: [],
        suspendedPaths: {},
        resumeLabels: {},
        waitingPaths: {},
        activeStepsPath: {},
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
        runId,
        context: {
          ...(stepResults ?? {
            input: prevResult?.status === 'success' ? prevResult.output : undefined,
          }),
          __state: initialState,
        } as WorkflowRunState['context'],
        status: 'running',
        value: initialState,
      };
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        resourceId,
        snapshot: workflow?.options?.pruneSnapshot
          ? workflow.options.pruneSnapshot({ snapshot: runningSnapshot, workflowStatus: 'running' })
          : runningSnapshot,
      });

      if (parentWorkflow) {
        const parentSnap = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
        });
        const existing = parentSnap?.context?.[workflowId] as any;
        await workflowsStore?.updateWorkflowResults({
          workflowName: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          stepId: workflowId,
          result: {
            startedAt: existing?.startedAt ?? Date.now(),
            status: 'running',
            payload: existing?.payload ?? parentWorkflow.input?.output ?? {},
            ...(existing ?? {}), // preserve anything else (suspendPayload, etc.)
            metadata: { ...(existing?.metadata ?? {}), nestedRunId: runId },
          },
          requestContext,
        });
      }
    }

    const startExecutionPath = executionPath ?? [0];
    await this.mastra.pubsub.publish('workflows', {
      // Schedule the first/resumed step with its own per-type run event so a
      // declarative agent/tool/mapping entry is interpreted explicitly.
      type: stepRunEventType(getEntryAtPath(workflow.stepGraph, startExecutionPath)),
      runId,
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionPath: startExecutionPath,
        resumeSteps,
        stepResults: {
          ...(stepResults ?? {
            input: prevResult?.status === 'success' ? prevResult.output : undefined,
          }),
          __state: initialState,
        },
        prevResult,
        timeTravel,
        restart,
        requestContext,
        resumeData,
        activeStepsPath: {},
        perStep,
        state: initialState,
        outputOptions,
        forEachIndex,
      },
    });
  }

  protected async endWorkflow(args: ProcessorArgs, status: 'success' | 'failed' | 'canceled' | 'paused' = 'success') {
    const {
      workflowId,
      runId,
      prevResult,
      perStep,
      workflow,
      stepResults,
      activeStepsPath,
      executionPath,
      parentWorkflow,
    } = args;
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const normalizedPrevResult = prevResult ?? ({ status } as StepResult<any, any, any, any>);

    // Check shouldPersistSnapshot option - default to true if not specified
    const finalStatus = perStep && status === 'success' ? 'paused' : status;
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: finalStatus,
      }) ?? true;

    if (shouldPersist) {
      await workflowsStore?.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: finalStatus,
          result: normalizedPrevResult,
          activePaths: executionPath,
          activeStepsPath: activeStepsPath,
        },
      });
    } else if (parentWorkflow && finalStatus !== 'paused') {
      // The nested run reached a terminal state its workflow opted not to
      // persist (e.g. the internal `executionWorkflow` inside `agentic-loop`).
      // A row may still exist from an earlier persisted phase — 'pending' at
      // nested-run start or 'suspended' before a resume — and without the
      // terminal update it would leak as a stale, resumable-looking record.
      // Terminal runs can't be resumed, so drop the row entirely. Best-effort:
      // a storage failure here must not abort run completion.
      try {
        await workflowsStore?.deleteWorkflowRunById({ runId, workflowName: workflowId });
      } catch (e) {
        this.mastra.getLogger()?.warn('Failed to clean up nested workflow snapshot', { workflowId, runId, error: e });
      }
    }

    if (perStep) {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-paused',
          payload: {},
        },
      });
    }

    await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'workflow-finish',
        payload: {
          runId,
        },
      },
    });

    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.end',
      runId,
      data: { ...args, prevResult: normalizedPrevResult, workflow: undefined },
    });
  }

  protected async processWorkflowEnd(args: ProcessorArgs) {
    const {
      resumeSteps,
      prevResult,
      resumeData,
      parentWorkflow,
      activeStepsPath,
      requestContext,
      runId,
      timeTravel,
      perStep,
      stepResults,
      state,
      workflowId,
    } = args;

    // Extract final state from stepResults or args
    const finalState = resolveCurrentState({ stepResults, state });

    // Clean up abort controller and parent-child tracking
    this.cleanupRun(runId);

    // A per-step run publishes `workflow.end` while merely paused — it will
    // keep writing to its watch topic when the next step executes, so only
    // truly terminal runs get their topic cleared.
    if (!perStep) {
      this.scheduleRunTopicCleanup(workflowId, runId);
    }

    // handle nested workflow
    if (parentWorkflow) {
      // get the step from the parent workflow and process it if it's a loop
      const step = parentWorkflow.stepGraph[parentWorkflow.executionPath[0]!];
      if (step?.type === 'loop') {
        // pick workflow information from parentWorkflow as the workflow end being processed here is actually a step in the parentWorkflow
        await processWorkflowLoop(
          {
            workflow: parentWorkflow as unknown as Workflow,
            workflowId: parentWorkflow.workflowId,
            prevResult,
            runId: parentWorkflow.runId,
            executionPath: parentWorkflow.executionPath,
            stepResults: parentWorkflow.stepResults,
            activeStepsPath: parentWorkflow.activeStepsPath,
            resumeSteps: parentWorkflow.resumeSteps,
            resumeData: parentWorkflow.resumeData,
            parentWorkflow: parentWorkflow.parentWorkflow,
            requestContext,
            retryCount: 0,
          },
          {
            pubsub: this.mastra.pubsub,
            stepExecutor: this.stepExecutor,
            step,
            stepResult: prevResult,
          },
        );
      } else {
        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.step.end',
          runId: parentWorkflow.runId, // Use parent's runId for event routing
          data: {
            workflowId: parentWorkflow.workflowId,
            runId: parentWorkflow.runId,
            executionPath: parentWorkflow.executionPath,
            resumeSteps,
            stepResults: parentWorkflow.stepResults,
            prevResult,
            resumeData,
            activeStepsPath,
            parentWorkflow: parentWorkflow.parentWorkflow,
            parentContext: parentWorkflow,
            requestContext,
            timeTravel,
            perStep,
            state: finalState,
            nestedRunId: runId, // Pass nested workflow's runId for step retrieval
          },
        });
      }
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.end',
      runId,
      data: { ...args, workflow: undefined, state: finalState },
    });

    // Clean up run-scoped internal workflow registrations (e.g. execution-workflow)
    // now that all events for this run have been processed.
    if (this.mastra.__hasInternalWorkflow(args.workflowId, runId)) {
      this.mastra.__unregisterInternalWorkflow(args.workflowId, runId);
    }
  }

  protected async processWorkflowSuspend(args: ProcessorArgs) {
    const {
      workflow,
      executionPath,
      resumeSteps,
      prevResult,
      resumeData,
      parentWorkflow,
      activeStepsPath,
      runId,
      requestContext,
      timeTravel,
      restart,
      stepResults,
      state,
      outputOptions,
    } = args;

    // Extract final state from stepResults or args
    const finalState = resolveCurrentState({ stepResults, state });

    // TODO: if there are still active paths don't end the workflow yet
    // handle nested workflow
    if (parentWorkflow) {
      // When propagating a suspend up to the parent, the parent stores this result under
      // the nested-workflow step's id, so the path we hand up must be the path *within
      // this workflow* to the suspended step (the parent / `execute()` re-prepends the
      // step id). Prepend the id of the step that suspended here, unless the path already
      // starts with it (the deepest level — the step that called `suspend()` directly —
      // already includes its own id via the executor's `path: [step.id]`).
      const existingPath: string[] = prevResult.suspendPayload?.__workflow_meta?.path ?? [];
      const suspendedStepId = workflow && executionPath ? getStep(workflow, executionPath)?.id : undefined;
      const propagatedPath =
        suspendedStepId && existingPath[0] !== suspendedStepId ? [suspendedStepId, ...existingPath] : existingPath;

      const resumeLabels: Record<string, { stepId: string; foreachIndex?: number }> = {};

      const nestedResumeLabels = prevResult.suspendPayload?.__workflow_meta?.resumeLabels ?? {};

      for (const label of Object.keys(nestedResumeLabels)) {
        resumeLabels[label] = {
          stepId: parentWorkflow.stepId,
          foreachIndex: nestedResumeLabels[label].foreachIndex,
        };
      }

      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId: parentWorkflow.runId, // Use parent's runId for event routing
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          executionPath: parentWorkflow.executionPath,
          resumeSteps,
          stepResults: parentWorkflow.stepResults,
          prevResult: {
            ...prevResult,
            suspendPayload: {
              ...prevResult.suspendPayload,
              __workflow_meta: {
                // keep resumeLabels / foreachIndex etc. — only the runId and path change as we propagate up
                ...(prevResult.suspendPayload?.__workflow_meta ?? {}),
                resumeLabels: Object.keys(resumeLabels).length > 0 ? resumeLabels : undefined,
                runId: runId,
                path: propagatedPath,
              },
            },
          },
          timeTravel,
          restart,
          resumeData,
          activeStepsPath,
          requestContext,
          parentWorkflow: parentWorkflow.parentWorkflow,
          parentContext: parentWorkflow,
          state: finalState,
          outputOptions,
          nestedRunId: runId, // Pass nested workflow's runId for step retrieval
        },
      });
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.suspend',
      runId,
      data: { ...args, workflow: undefined, state: finalState },
    });

    // Clean up run-scoped internal workflow registrations (e.g. execution-workflow)
    // now that all events for this run have been processed.
    if (this.mastra.__hasInternalWorkflow(args.workflowId, runId)) {
      this.mastra.__unregisterInternalWorkflow(args.workflowId, runId);
    }
  }

  protected async processWorkflowFail(args: ProcessorArgs) {
    const {
      workflowId,
      runId,
      resumeSteps,
      prevResult,
      resumeData,
      parentWorkflow,
      activeStepsPath,
      requestContext,
      timeTravel,
      restart,
      stepResults,
      state,
      outputOptions,
      workflow,
      executionPath,
    } = args;

    // Extract final state from stepResults or args
    const finalState = resolveCurrentState({ stepResults, state });

    // Clean up abort controller and parent-child tracking
    this.cleanupRun(runId);

    // 'failed' is terminal: the run stops writing to its watch topic.
    this.scheduleRunTopicCleanup(workflowId, runId);

    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');

    // Check shouldPersistSnapshot option - default to true if not specified
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: 'failed',
      }) ?? true;

    if (shouldPersist) {
      await workflowsStore?.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: 'failed',
          error: (prevResult as any).error,
          activePaths: executionPath,
          activeStepsPath: activeStepsPath,
        },
      });
    } else if (parentWorkflow) {
      // Mirrors endWorkflow: a nested run whose workflow opted out of
      // persisting the terminal 'failed' status would otherwise leak its
      // earlier-phase ('pending'/'suspended') snapshot row forever.
      // Best-effort: a storage failure here must not abort run completion.
      try {
        await workflowsStore?.deleteWorkflowRunById({ runId, workflowName: workflowId });
      } catch (e) {
        this.mastra.getLogger()?.warn('Failed to clean up nested workflow snapshot', { workflowId, runId, error: e });
      }
    }

    // handle nested workflow
    if (parentWorkflow) {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId: parentWorkflow.runId, // Use parent's runId for event routing
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          executionPath: parentWorkflow.executionPath,
          resumeSteps,
          stepResults: parentWorkflow.stepResults,
          prevResult,
          timeTravel,
          restart,
          resumeData,
          activeStepsPath,
          requestContext,
          parentWorkflow: parentWorkflow.parentWorkflow,
          parentContext: parentWorkflow,
          state: finalState,
          outputOptions,
          nestedRunId: runId, // Pass nested workflow's runId for step retrieval
        },
      });
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.fail',
      runId,
      data: { ...args, workflow: undefined, state: finalState },
    });

    // Clean up run-scoped internal workflow registrations (e.g. execution-workflow)
    // now that all events for this run have been processed.
    if (this.mastra.__hasInternalWorkflow(args.workflowId, runId)) {
      this.mastra.__unregisterInternalWorkflow(args.workflowId, runId);
    }
  }

  protected async processWorkflowStepRun(args: ProcessorArgs) {
    const {
      workflow,
      workflowId,
      runId,
      executionPath,
      stepResults,
      activeStepsPath,
      resumeSteps,
      timeTravel,
      restart,
      prevResult,
      resumeData,
      parentWorkflow,
      requestContext,
      perStep,
      state,
      outputOptions,
      forEachIndex,
    } = args;
    // Get current state from stepResults.__state or from passed state
    const currentState = resolveCurrentState({ stepResults, state });
    const stepGraph: StepFlowEntry[] = workflow.stepGraph;

    if (!executionPath?.length) {
      return this.errorWorkflow(
        {
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Execution path is empty: ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    const rawStep: StepFlowEntry | undefined = stepGraph[executionPath[0]!];

    if (!rawStep) {
      // If we're past the last step, end the workflow successfully
      if (executionPath[0]! >= stepGraph.length) {
        return this.endWorkflow({
          workflow,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult,
          activeStepsPath,
          requestContext,
          // Use currentState (resolved from stepResults.__state and state) instead of
          // the possibly-undefined state parameter, to ensure final state is preserved
          state: currentState,
          outputOptions,
        });
      }
      return this.errorWorkflow(
        {
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step not found in step graph: ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    // Keep the raw declarative entry. Control structures are routed below; a
    // declarative single entry (agent / tool / mapping) is interpreted by its own
    // per-type handler, and plain steps run through `runLeafStep`.
    let step: StepFlowEntry = rawStep;

    //if parallel/conditional and execution path is greater than 1
    // and restart is present but isParallelOrConditionalRestarted is false,
    // then we need to process the step using processWorkflowParallel/processWorkflowConditional
    // to ensure all active steps are processed.
    if (
      (step.type === 'parallel' || step.type === 'conditional') &&
      executionPath.length > 1 &&
      (!restart || (restart && restart.isParallelOrConditionalRestarted))
    ) {
      step = step.steps[executionPath[1]!]!;
    } else if (step.type === 'parallel') {
      return processWorkflowParallel(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          restart,
          timeTravel,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
        {
          pubsub: this.mastra.pubsub,
          step,
        },
      );
    } else if (step?.type === 'conditional') {
      return processWorkflowConditional(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          restart,
          timeTravel,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
        },
      );
    } else if (step?.type === 'sleep') {
      return processWorkflowSleep(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          timeTravel,
          restart,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
        },
      );
    } else if (step?.type === 'sleepUntil') {
      return processWorkflowSleepUntil(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          timeTravel,
          restart,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
        },
      );
    } else if (step?.type === 'foreach' && executionPath.length === 1) {
      return processWorkflowForEach(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          timeTravel,
          restart,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
          forEachIndex,
        },
        {
          pubsub: this.mastra.pubsub,
          mastra: this.mastra,
          step,
        },
      );
    }

    // Declarative single step-like entries (agent / tool / mapping) - including a
    // child picked out of a parallel/conditional block above - are interpreted by
    // their own per-type handlers, which build the runnable step and run it through
    // `runLeafStep`. This branch also covers an in-flight generic `workflow.step.run`
    // event that targets a declarative entry (cross-version compatibility).
    if (step.type === 'agent') {
      return this.processWorkflowAgentRun(args);
    }
    if (step.type === 'tool') {
      return this.processWorkflowToolRun(args);
    }
    if (step.type === 'mapping') {
      return this.processWorkflowMappingRun(args);
    }

    // Control structures (sleep / sleepUntil / parallel / conditional) already
    // returned above; what remains is a plain `step` or a `loop` / `foreach` body.
    return this.runLeafStep({
      ...args,
      step: step as Extract<StepFlowEntry, { type: 'step' | 'loop' | 'foreach' }>,
      entry: step,
    });
  }

  /**
   * Build the runnable step for a declarative `agent` entry and run it. Mirrors the
   * default engine's `executeAgent`: resolve the agent, wrap it as a step keyed by
   * the entry's own id, and execute through the shared `runLeafStep`.
   */
  protected async processWorkflowAgentRun(args: ProcessorArgs) {
    const entry = getEntryAtPath(args.workflow.stepGraph, args.executionPath);
    if (entry?.type !== 'agent') {
      return this.runLeafStepFromMisroute(args, entry, 'agent');
    }
    const agent = entry.agent ?? this.mastra?.getAgent(entry.agentId);
    if (!agent) {
      throw new Error(
        `Agent '${entry.agentId}' not found for workflow step '${entry.id}'. Register the agent on the Mastra instance or pass the agent instance directly.`,
      );
    }
    const step: Step = { ...createStepFromAgent(agent as any, entry.options), id: entry.id } as Step;
    return this.runLeafStep({ ...args, step: { type: 'step', step }, entry });
  }

  /**
   * Build the runnable step for a declarative `tool` entry and run it. Mirrors the
   * default engine's `executeTool`.
   */
  protected async processWorkflowToolRun(args: ProcessorArgs) {
    const entry = getEntryAtPath(args.workflow.stepGraph, args.executionPath);
    if (entry?.type !== 'tool') {
      return this.runLeafStepFromMisroute(args, entry, 'tool');
    }
    const tool = entry.tool ?? this.mastra?.getTool(entry.toolId);
    if (!tool) {
      throw new Error(
        `Tool '${entry.toolId}' not found for workflow step '${entry.id}'. Pass the tool instance directly.`,
      );
    }
    const step: Step = { ...createStepFromTool(tool as any, entry.options), id: entry.id } as Step;
    return this.runLeafStep({ ...args, step: { type: 'step', step }, entry });
  }

  /**
   * Build the runnable step for a declarative `mapping` entry and run it. Mirrors the
   * default engine's `executeMapping`.
   */
  protected async processWorkflowMappingRun(args: ProcessorArgs) {
    const entry = getEntryAtPath(args.workflow.stepGraph, args.executionPath);
    if (entry?.type !== 'mapping') {
      return this.runLeafStepFromMisroute(args, entry, 'mapping');
    }
    const step: Step = createMappingStep(entry.id, entry.mapConfig) as Step;
    return this.runLeafStep({ ...args, step: { type: 'step', step }, entry });
  }

  /**
   * A per-type run event whose target entry isn't of the expected type. This is
   * only reachable if a typed run event is scheduled against the wrong entry (e.g.
   * a graph mutation); surface it as a workflow error rather than running the wrong
   * thing.
   */
  private async runLeafStepFromMisroute(args: ProcessorArgs, entry: StepFlowEntry | undefined, expected: string) {
    const {
      workflowId,
      runId,
      executionPath,
      stepResults,
      activeStepsPath,
      resumeSteps,
      prevResult,
      resumeData,
      parentWorkflow,
      requestContext,
    } = args;
    return this.errorWorkflow(
      {
        workflowId,
        runId,
        executionPath,
        stepResults,
        activeStepsPath,
        resumeSteps,
        prevResult,
        resumeData,
        parentWorkflow,
        requestContext,
      },
      new MastraError({
        id: 'MASTRA_WORKFLOW',
        text: `Expected a '${expected}' step at ${JSON.stringify(executionPath)} but found '${entry?.type ?? 'none'}'`,
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.SYSTEM,
      }),
    );
  }

  /**
   * Shared leaf-step runner. Executes a single concrete step - a plain `step`
   * entry, a `loop` / `foreach` body, or the step built by an agent / tool /
   * mapping handler - and emits its lifecycle events (`workflow.step.end`,
   * retries, suspend, cancel). `entry` is the original graph entry, used to
   * re-emit the correct per-type run event on retry.
   */
  protected async runLeafStep(
    args: ProcessorArgs & {
      step: Extract<StepFlowEntry, { type: 'step' | 'loop' | 'foreach' }>;
      entry: StepFlowEntry;
    },
  ) {
    const {
      workflow,
      workflowId,
      runId,
      executionPath,
      stepResults,
      activeStepsPath,
      resumeSteps,
      timeTravel,
      restart,
      prevResult,
      resumeData,
      parentWorkflow,
      retryCount = 0,
      perStep,
      state,
      outputOptions,
      forEachIndex,
      step,
      entry,
    } = args;
    let requestContext = args.requestContext;
    const streamFormat = this.runFormats.get(runId);
    const currentState = resolveCurrentState({ stepResults, state });
    const stepGraph: StepFlowEntry[] = workflow.stepGraph;
    // For 'step' entries step.step is already a live Step. For 'loop' / 'foreach'
    // (widened to SingleStepEntry) materialize the inner step so the rest of this
    // method can keep treating step.step as a live Step at runtime.
    const innerStep: Step = step.type === 'step' ? step.step : materializeInnerStep(step.step, this.mastra);

    if (!isExecutableStep(step)) {
      return this.errorWorkflow(
        {
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step is not executable: ${step?.type} -- ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    activeStepsPath[innerStep.id] = executionPath;

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');

    // Run nested workflow - check for both EventedWorkflow and regular Workflow
    if (innerStep instanceof EventedWorkflow || innerStep.component === 'WORKFLOW') {
      const nestedWorkflow = innerStep as Workflow;
      // Handle resume with only nested workflow ID specified (auto-detect suspended inner step)
      if (resumeSteps?.length === 1 && resumeSteps[0] === innerStep.id) {
        const stepData = stepResults[innerStep.id];
        const nestedRunId = stepData?.suspendPayload?.__workflow_meta?.runId;
        if (!nestedRunId) {
          return this.errorWorkflow(
            {
              workflowId,
              runId,
              executionPath,
              stepResults,
              activeStepsPath,
              resumeSteps,
              prevResult,
              resumeData,
              parentWorkflow,
              requestContext,
            },
            new MastraError({
              id: 'MASTRA_WORKFLOW',
              text: `Nested workflow run id not found for auto-detection: ${JSON.stringify(stepResults)}`,
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }

        const snapshot = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: innerStep.id,
          runId: nestedRunId,
        });

        // Auto-detect the suspended step within the nested workflow
        const suspendedStepId = Object.keys(snapshot?.suspendedPaths ?? {})?.[0];
        if (!suspendedStepId) {
          return this.errorWorkflow(
            {
              workflowId,
              runId,
              executionPath,
              stepResults,
              activeStepsPath,
              resumeSteps,
              prevResult,
              resumeData,
              parentWorkflow,
              requestContext,
            },
            new MastraError({
              id: 'MASTRA_WORKFLOW',
              text: `No suspended step found in nested workflow: ${innerStep.id}`,
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }

        const nestedExecutionPath = snapshot?.suspendedPaths?.[suspendedStepId];
        const nestedStepResults = snapshot?.context;
        // The resumed inner step's input is the output of the step that ran before it
        // inside the nested workflow (i.e. the suspended step's stored payload), not the
        // input to the nested-workflow step itself.
        const nestedPrevResult = {
          status: 'success' as const,
          output: (nestedStepResults?.[suspendedStepId] as any)?.payload ?? (prevResult as any)?.output,
        };

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.resume',
          runId,
          data: {
            workflowId: innerStep.id,
            parentWorkflow: {
              stepId: innerStep.id,
              workflowId,
              runId,
              stepGraph,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
            },
            executionPath: nestedExecutionPath as any,
            runId: nestedRunId,
            resumeSteps: [suspendedStepId], // Resume the auto-detected inner step
            stepResults: nestedStepResults,
            prevResult: nestedPrevResult,
            resumeData,
            activeStepsPath,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      } else if (resumeSteps?.length > 1 && resumeSteps[0] === innerStep.id) {
        const stepData = stepResults[innerStep.id];
        const nestedRunId = stepData?.suspendPayload?.__workflow_meta?.runId;
        if (!nestedRunId) {
          return this.errorWorkflow(
            {
              workflowId,
              runId,
              executionPath,
              stepResults,
              activeStepsPath,
              resumeSteps,
              prevResult,
              resumeData,
              parentWorkflow,
              requestContext,
            },
            new MastraError({
              id: 'MASTRA_WORKFLOW',
              text: `Nested workflow run id not found: ${JSON.stringify(stepResults)}`,
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }

        const snapshot = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: innerStep.id,
          runId: nestedRunId,
        });

        const nestedStepResults = snapshot?.context;
        const nestedSteps = resumeSteps.slice(1);
        // The step the nested workflow resumes into receives the output of the step that
        // ran before it (its stored payload), not the input to the nested-workflow step.
        const nestedPrevResult = {
          status: 'success' as const,
          output: (nestedStepResults?.[nestedSteps[0]!] as any)?.payload ?? (prevResult as any)?.output,
        };

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.resume',
          runId,
          data: {
            workflowId: innerStep.id,
            parentWorkflow: {
              stepId: innerStep.id,
              workflowId,
              runId,
              stepGraph,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
            },
            executionPath: snapshot?.suspendedPaths?.[nestedSteps[0]!] as any,
            runId: nestedRunId,
            resumeSteps: nestedSteps,
            stepResults: nestedStepResults,
            prevResult: nestedPrevResult,
            resumeData,
            activeStepsPath,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      } else if (timeTravel && timeTravel.steps?.length > 1 && timeTravel.steps[0] === innerStep.id) {
        const nestedRunId = stepResults[innerStep.id]?.metadata?.nestedRunId ?? randomUUID();
        const snapshot =
          (await workflowsStore?.loadWorkflowSnapshot({
            workflowName: innerStep.id,
            runId: nestedRunId,
          })) ?? ({ context: {} } as WorkflowRunState);

        const timeTravelParams = createTimeTravelExecutionParams({
          steps: timeTravel.steps.slice(1),
          inputData: timeTravel.inputData,
          resumeData: timeTravel.resumeData,
          context: (timeTravel.nestedStepResults?.[innerStep.id] ?? {}) as any,
          nestedStepsContext: (timeTravel.nestedStepResults ?? {}) as any,
          snapshot,
          graph: nestedWorkflow.buildExecutionGraph(),
          perStep,
        });

        const nestedPrevStep = getStep(nestedWorkflow, timeTravelParams.executionPath);
        const nestedPrevResult = timeTravelParams.stepResults[nestedPrevStep?.id ?? 'input'];

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.start',
          runId,
          data: {
            workflowId: innerStep.id,
            parentWorkflow: {
              stepId: innerStep.id,
              workflowId,
              runId,
              stepGraph,
              executionPath,
              resumeSteps,
              stepResults,
              timeTravel,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
            },
            executionPath: timeTravelParams.executionPath,
            runId: nestedRunId,
            stepResults: timeTravelParams.stepResults,
            prevResult: { status: 'success', output: nestedPrevResult?.payload },
            timeTravel: timeTravelParams,
            activeStepsPath,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      } else if (restart && !!restart.activeStepsPath?.[innerStep.id]) {
        const nestedRunId = stepResults[innerStep.id]?.metadata?.nestedRunId ?? randomUUID();
        const snapshot =
          (await workflowsStore?.loadWorkflowSnapshot({
            workflowName: innerStep.id,
            runId: nestedRunId,
          })) ?? ({ context: {} } as WorkflowRunState);

        const restartParams = createRestartExecutionParams({ snapshot, graph: nestedWorkflow.buildExecutionGraph() });

        const nestedPrevStep = getStep(nestedWorkflow, snapshot.activePaths);
        const nestedPrevResult = restartParams.stepResults[nestedPrevStep?.id ?? 'input'];

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.start',
          runId,
          data: {
            workflowId: innerStep.id,
            parentWorkflow: {
              stepId: innerStep.id,
              workflowId,
              runId,
              stepGraph,
              executionPath,
              resumeSteps,
              stepResults,
              restart,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
            },
            executionPath: restartParams.activePaths,
            runId: nestedRunId,
            stepResults: restartParams.stepResults,
            prevResult: { status: 'success', output: nestedPrevResult?.payload },
            restart: restartParams,
            activeStepsPath: restartParams.activeStepsPath,
            requestContext,
            perStep,
            initialState: restartParams.state,
            state: restartParams.state,
            outputOptions,
          },
        });
      } else {
        const nestedRunId = randomUUID();
        const shouldPersist =
          nestedWorkflow?.options?.shouldPersistSnapshot?.({
            stepResults: {},
            workflowStatus: 'pending',
          }) ?? true;
        const parentRun = await workflowsStore?.getWorkflowRunById({ runId, workflowName: workflow.id });

        //create nested workflow run snapshot in storage. use parent workflow resource id in nested workflow
        if (shouldPersist) {
          const pendingSnapshot: WorkflowRunState = {
            runId: nestedRunId,
            status: 'pending',
            value: {},
            context: {} as WorkflowRunState['context'],
            activePaths: [],
            serializedStepGraph: nestedWorkflow.serializedStepGraph,
            activeStepsPath: {},
            suspendedPaths: {},
            resumeLabels: {},
            waitingPaths: {},
            result: undefined,
            error: undefined,
            timestamp: Date.now(),
          };
          await workflowsStore?.persistWorkflowSnapshot({
            workflowName: nestedWorkflow.id,
            runId: nestedRunId,
            resourceId: parentRun?.resourceId,
            snapshot: nestedWorkflow?.options?.pruneSnapshot
              ? nestedWorkflow.options.pruneSnapshot({ snapshot: pendingSnapshot, workflowStatus: 'pending' })
              : pendingSnapshot,
          });
        }

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.start',
          runId,
          data: {
            workflowId: innerStep.id,
            parentWorkflow: {
              stepId: innerStep.id,
              workflowId,
              stepGraph,
              runId,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
            },
            executionPath: [0],
            runId: nestedRunId,
            resumeSteps,
            prevResult,
            resumeData,
            activeStepsPath,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      }

      return;
    }

    if (step.type === 'step') {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-start',
          payload: {
            id: innerStep.id,
            startedAt: Date.now(),
            payload: prevResult.status === 'success' ? prevResult.output : undefined,
            status: 'running',
          },
        },
      });
    }

    const ee = new EventEmitter();
    ee.on('watch', async (event: any) => {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: event,
      });
    });
    const rc = new RequestContext();
    for (const [key, value] of Object.entries(requestContext)) {
      rc.set(key, value);
    }
    const { resumeData: timeTravelResumeData, validationError: timeTravelResumeValidationError } =
      await validateStepResumeData({
        resumeData: timeTravel?.stepResults[innerStep.id]?.status === 'suspended' ? timeTravel?.resumeData : undefined,
        step: innerStep,
      });

    let resumeDataToUse;
    if (timeTravelResumeData && !timeTravelResumeValidationError) {
      resumeDataToUse = timeTravelResumeData;
    } else if (timeTravelResumeData && timeTravelResumeValidationError) {
      this.mastra.getLogger()?.warn('Time travel resume data validation failed', {
        stepId: innerStep.id,
        error: timeTravelResumeValidationError.message,
      });
    } else if (resumeSteps?.length > 0 && resumeSteps?.[0] === innerStep.id) {
      resumeDataToUse = resumeData;
    }

    // Get the abort controller for this workflow run
    const abortController = this.getOrCreateAbortController(runId);

    let stepResult: StepResult<any, any, any, any>;

    if (this.stepExecutionStrategy) {
      stepResult = await this.stepExecutionStrategy.executeStep({
        workflowId,
        runId,
        stepId: innerStep.id,
        executionPath,
        stepResults,
        state: currentState,
        requestContext: Object.fromEntries(rc.entries()),
        input: (prevResult as any)?.output,
        resumeData: resumeDataToUse,
        retryCount,
        foreachIdx: step.type === 'foreach' ? executionPath[1] : undefined,
        format: streamFormat,
        perStep,
        validateInputs: workflow.options.validateInputs,
        abortSignal: abortController.signal,
      });
    } else {
      stepResult = await this.stepExecutor.execute({
        workflowId,
        step: innerStep,
        runId,
        stepResults,
        state: currentState,
        requestContext: rc,
        input: (prevResult as any)?.output,
        resumeData: resumeDataToUse,
        retryCount,
        foreachIdx: step.type === 'foreach' ? executionPath[1] : undefined,
        validateInputs: workflow.options.validateInputs,
        abortController,
        format: streamFormat,
        perStep,
        // Non-serializable parent span for span nesting; held on Mastra by
        // `EventedRun.start` since it can't ride pubsub events. Walk the parent
        // chain so nested workflow runs inherit it.
        tracingContext: this.resolveRunTracingContext(runId),
        tracingPolicy: workflow.options?.tracingPolicy,
      });
    }
    requestContext = Object.fromEntries(rc.entries());

    if (abortController?.signal?.aborted) {
      // Extract updated state from step result
      const updatedState = (stepResult as any).__state ?? currentState;
      //cancel the workflow
      return this.mastra.pubsub.publish('workflows', {
        type: 'workflow.cancel',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          timeTravel,
          stepResults: {
            ...stepResults,
            [innerStep.id]: stepResult,
            __state: updatedState,
          },
          prevResult: { ...stepResult, status: 'canceled' }, //set the status to canceled to indicate the workflow was canceled
          activeStepsPath,
          requestContext,
          perStep,
          state: updatedState,
          outputOptions,
        },
      });
    }

    // @ts-expect-error - bailed status not in type
    if (stepResult.status === 'bailed') {
      // @ts-expect-error - bailed status not in type
      stepResult.status = 'success';

      await this.endWorkflow({
        workflow,
        resumeData,
        parentWorkflow,
        workflowId,
        runId,
        executionPath,
        resumeSteps,
        stepResults: {
          ...stepResults,
          [innerStep.id]: stepResult,
        },
        prevResult: stepResult,
        activeStepsPath,
        requestContext,
        perStep,
        state: currentState,
        outputOptions,
      });
      return;
    }

    if (stepResult.status === 'failed') {
      const retries = innerStep.retries ?? workflow.retryConfig.attempts ?? 0;
      if (retryCount >= retries || stepResult.nonRetryable) {
        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.step.end',
          runId,
          data: {
            parentWorkflow,
            workflowId,
            runId,
            executionPath,
            resumeSteps,
            stepResults,
            prevResult: stepResult,
            activeStepsPath,
            requestContext,
            state: currentState,
            outputOptions,
          },
        });
      } else {
        return this.mastra.pubsub.publish('workflows', {
          // Re-run the same entry on retry via its own per-type run event so the
          // retry is interpreted the same way as the initial run.
          type: stepRunEventType(entry),
          runId,
          data: {
            parentWorkflow,
            workflowId,
            runId,
            executionPath,
            resumeSteps,
            stepResults,
            timeTravel,
            restart,
            prevResult,
            activeStepsPath,
            requestContext,
            retryCount: retryCount + 1,
            state: currentState,
            outputOptions,
          },
        });
      }
    }

    if (step.type === 'loop' && stepResult.status === 'suspended') {
      // The loop body suspended — we can't evaluate the loop condition yet (there's no
      // output). Propagate the suspend like any other step; the body re-runs on resume,
      // at which point processWorkflowLoop evaluates the condition with its output.
      const updatedState = (stepResult as any).__state ?? currentState;
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          timeTravel,
          restart,
          stepResults: {
            ...stepResults,
            [innerStep.id]: stepResult,
            __state: updatedState,
          },
          prevResult: stepResult,
          activeStepsPath,
          requestContext,
          perStep,
          state: updatedState,
          outputOptions,
        },
      });
      return;
    }

    if (step.type === 'loop') {
      //timeTravel is not passed to the processWorkflowLoop function becuase the step already ran the first time
      // with whatever information it needs from timeTravel, subsequent loop runs use the previous loop run result as it's input.
      await processWorkflowLoop(
        {
          workflow,
          workflowId,
          prevResult: stepResult,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          resumeData,
          parentWorkflow,
          requestContext,
          retryCount: retryCount + 1,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
          stepResult,
        },
      );
    } else {
      // Extract updated state from step result
      const updatedState = (stepResult as any).__state ?? currentState;

      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          timeTravel, //timeTravel is passed in as workflow.step.end ends the step, not the workflow, the timeTravel info is passed to the next step to run.
          restart,
          stepResults: {
            ...stepResults,
            [innerStep.id]: stepResult,
            __state: updatedState,
          },
          prevResult: stepResult,
          activeStepsPath,
          requestContext,
          perStep,
          state: updatedState,
          outputOptions,
          forEachIndex,
        },
      });
    }
  }

  /**
   * Aggregate the results of all branches of a `parallel` / `conditional` entry once
   * every branch has reached a terminal state (`success` / `skipped`) or `suspended`.
   *
   * This runs once per branch completion. It only acts when every branch is accounted
   * for; otherwise it returns and lets a later branch finish the aggregation. Because
   * `stepResults` is the snapshot returned by the caller's `updateWorkflowResults`
   * call — which grows monotonically per branch — only the branch whose write landed
   * last observes the full set, so exactly one branch emits (no double emit).
   *
   * - if any branch is still suspended → re-emit `workflow.suspend` with the full set
   *   of suspended paths and persist the workflow state. This both fixes the race where
   *   each branch would overwrite `suspendedPaths` on its own, and lets the workflow
   *   stay suspended while only some branches have been resumed.
   * - otherwise → emit `workflow.step.end` for the parallel/conditional entry with the
   *   merged branch outputs (the existing behaviour).
   */
  protected async aggregateBranchResults({
    workflow,
    workflowId,
    runId,
    branchEntry,
    branchExecutionPath,
    latestBranchResult,
    resumeSteps,
    timeTravel,
    restart,
    parentWorkflow,
    stepResults,
    activeStepsPath,
    requestContext,
    state,
    outputOptions,
  }: {
    workflow: Workflow;
    workflowId: string;
    runId: string;
    branchEntry: Extract<StepFlowEntry, { type: 'parallel' | 'conditional' }>;
    branchExecutionPath: number[];
    /**
     * The in-flight result of the branch that just finished (i.e. the one at
     * `branchExecutionPath`). Used for that branch's output so non-JSON values (e.g.
     * `Date`) survive — the copy in `stepResults` has been round-tripped through storage
     * serialization. Other branches' outputs unavoidably come from `stepResults`.
     */
    latestBranchResult?: StepResult<any, any, any, any>;
    resumeSteps: string[];
    timeTravel?: TimeTravelExecutionParams;
    restart?: RestartExecutionParams;
    parentWorkflow?: ParentWorkflow;
    stepResults: Record<string, any>;
    activeStepsPath: Record<string, number[]>;
    requestContext: Record<string, any>;
    state: Record<string, any>;
    outputOptions?: { includeState?: boolean; includeResumeLabels?: boolean };
  }) {
    const currentState = resolveCurrentState({ stepResults, state });
    const parentIdx = branchExecutionPath[0]!;
    const finishedBranchIdx = branchExecutionPath.length > 1 ? branchExecutionPath[1]! : undefined;

    let suspendedCount = 0;
    let skippedCount = 0;
    const allResults: Record<string, any> = {};
    const suspendedPaths: Record<string, number[]> = {};
    const resumeLabels: Record<string, { stepId: string; foreachIndex?: number }> = {};

    branchEntry.steps.forEach((branch, idx) => {
      if (!isSingleStepEntry(branch)) {
        return;
      }
      const branchId = getSingleStepEntryId(branch);
      const res = stepResults?.[branchId] as any;
      if (!res || !res.status) {
        return; // branch not finished yet
      }
      if (res.status === 'success') {
        // For the branch that just completed, prefer its in-flight result so structured
        // values (Date, Map, ...) aren't flattened by the storage round-trip.
        const output =
          idx === finishedBranchIdx && latestBranchResult?.status === 'success'
            ? (latestBranchResult as any).output
            : res.output;
        allResults[branchId] = output;
      } else if (res.status === 'skipped') {
        skippedCount++;
      } else if (res.status === 'suspended') {
        suspendedCount++;
        suspendedPaths[branchId] = [parentIdx, idx];
        Object.assign(resumeLabels, res.suspendPayload?.__workflow_meta?.resumeLabels ?? {});
      }
      // failed / canceled branches short-circuit the workflow before reaching here
    });

    const finishedCount = Object.keys(allResults).length + skippedCount + suspendedCount;
    if (finishedCount < branchEntry.steps.length) {
      return; // wait for the remaining branches to finish
    }

    if (suspendedCount > 0) {
      const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
      const shouldPersist =
        workflow?.options?.shouldPersistSnapshot?.({
          stepResults: stepResults ?? {},
          workflowStatus: 'suspended',
        }) ?? true;
      if (shouldPersist) {
        await workflowsStore?.updateWorkflowResults({
          workflowName: workflow.id,
          runId,
          stepId: '__state',
          result: currentState as any,
          requestContext,
        });
        const suspendTracingContext = this.resolveSuspendTracingContext(runId);
        await workflowsStore?.updateWorkflowState({
          workflowName: workflowId,
          runId,
          opts: {
            status: 'suspended',
            result: { status: 'suspended' } as any,
            suspendedPaths,
            resumeLabels,
            ...(suspendTracingContext ? { tracingContext: suspendTracingContext } : {}),
          },
        });
        await this.pruneAndRepersistSnapshot({ workflow, workflowId, runId });
      }
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.suspend',
        runId,
        data: {
          workflowId,
          runId,
          executionPath: branchExecutionPath,
          resumeSteps,
          parentWorkflow,
          stepResults,
          prevResult: { status: 'suspended' } as any,
          activeStepsPath,
          requestContext,
          timeTravel,
          restart,
          state: currentState,
          outputOptions,
        },
      });
      return;
    }

    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.step.end',
      runId,
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionPath: branchExecutionPath.slice(0, -1),
        resumeSteps,
        stepResults,
        prevResult: { status: 'success', output: allResults },
        activeStepsPath,
        requestContext,
        timeTravel,
        restart,
        state: currentState,
        outputOptions,
      },
    });
  }

  protected async processWorkflowStepEnd({
    workflow,
    workflowId,
    runId,
    executionPath,
    resumeSteps,
    timeTravel,
    restart,
    prevResult,
    parentWorkflow,
    stepResults,
    activeStepsPath,
    parentContext,
    requestContext,
    perStep,
    state,
    outputOptions,
    forEachIndex,
    nestedRunId,
  }: ProcessorArgs) {
    // Extract state from prevResult if it was updated by the step
    // For nested workflow completion (parentContext present), prefer the passed state
    // as it contains the nested workflow's updated state
    const currentState = parentContext
      ? (state ?? (prevResult as any)?.__state ?? stepResults?.__state ?? {})
      : ((prevResult as any)?.__state ?? stepResults?.__state ?? state ?? {});

    // Create a clean version of prevResult without __state for storing
    const { __state: _removedState, ...cleanPrevResult } = prevResult as any;
    prevResult = cleanPrevResult as typeof prevResult;

    const rawStep = workflow.stepGraph[executionPath[0]!];

    // The just-finished entry. Keep it raw (declarative agent / tool / mapping
    // entries are not materialized); we only need its id and type here.
    let step: StepFlowEntry | undefined = rawStep;

    if ((step?.type === 'parallel' || step?.type === 'conditional') && executionPath.length > 1) {
      step = step.steps[executionPath[1]!];
    }

    if (!step) {
      return this.errorWorkflow(
        {
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          prevResult,
          stepResults,
          activeStepsPath,
          requestContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step not found: ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    // The finished step's id. Works for plain steps, declarative agent/tool/mapping
    // entries (their own id) and loop/foreach bodies (the wrapped step's id).
    const stepId = getStepIds(step)[0]!;

    // Cache workflows store to avoid redundant async calls
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');

    if (step.type === 'foreach') {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: workflowId,
        runId,
      });

      const currentIdx = executionPath[1];
      const snapshotContext = snapshot?.context as Record<string, ForeachStepResult> | undefined;
      const existingStepResult = snapshotContext?.[getInnerStepId(step.step)];
      const currentResult = existingStepResult?.output;
      // Preserve the original payload (the input array) from the existing step result
      const originalPayload = existingStepResult?.payload;

      let newResult = prevResult;
      if (currentIdx !== undefined) {
        // Check for bail - short circuit foreach execution
        // @ts-expect-error - bailed status not in type
        if (prevResult.status === 'bailed') {
          const bailedResult = {
            status: 'success' as const,
            output: (prevResult as any).output,
            startedAt: existingStepResult?.startedAt ?? Date.now(),
            endedAt: Date.now(),
            payload: originalPayload,
          };

          // Store final result
          await workflowsStore?.updateWorkflowResults({
            workflowName: workflow.id,
            runId,
            stepId: getInnerStepId(step.step),
            result: bailedResult as any,
            requestContext,
          });

          // End workflow with bail result
          return this.endWorkflow({
            workflow,
            parentWorkflow,
            workflowId,
            runId,
            executionPath: [executionPath[0]!],
            resumeSteps,
            stepResults: { ...stepResults, [getInnerStepId(step.step)]: bailedResult },
            prevResult: bailedResult,
            activeStepsPath,
            requestContext,
            perStep,
            state: currentState,
            outputOptions,
          });
        }

        // For foreach, store the full iteration result (including status, suspendPayload, etc.)
        // not just the output, so suspend state is preserved
        const iterationResult =
          prevResult.status === 'suspended'
            ? prevResult // Keep full result for suspended iterations
            : (prevResult as any).output; // Just output for completed iterations

        if (currentResult) {
          currentResult[currentIdx] = iterationResult;
          // Merge foreach step-level properties (suspendPayload, resumePayload, suspendedAt, resumedAt)
          // New iteration's resume properties take precedence for resumePayload/resumedAt (most recent resume)
          // Existing step's suspend properties are preserved (first suspend)
          newResult = {
            ...existingStepResult, // Preserve step-level properties
            ...prevResult, // Get iteration timing info
            output: currentResult,
            payload: originalPayload,
            // Preserve suspend metadata from first suspension
            suspendPayload: existingStepResult?.suspendPayload ?? prevResult.suspendPayload,
            suspendedAt: existingStepResult?.suspendedAt ?? (prevResult as any).suspendedAt,
            // Update resume metadata to most recent resume (new iteration takes precedence)
            resumePayload: (prevResult as any).resumePayload ?? existingStepResult?.resumePayload,
            resumedAt: (prevResult as any).resumedAt ?? existingStepResult?.resumedAt,
          } as any;
        } else {
          newResult = { ...prevResult, output: [iterationResult], payload: originalPayload } as any;
        }
      }
      const newStepResults = await workflowsStore?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId: getInnerStepId(step.step),
        result: newResult,
        requestContext,
      });

      // Persist (and thread forward) any state changes made inside the foreach body.
      // Each iteration is a separate event in the evented engine, so unless we write
      // the updated state back here, the next iteration / the step after the foreach
      // would re-read the stale `__state` from storage instead of `state` (see
      // resolveCurrentState's priority order). This is what makes setState() inside a
      // foreach body propagate across iterations.
      if (currentState) {
        await workflowsStore?.updateWorkflowResults({
          workflowName: workflow.id,
          runId,
          stepId: '__state',
          result: currentState as any,
          requestContext,
        });
      }

      // Same fallback as the regular step path: when no run record was
      // persisted (shouldPersistSnapshot opted out of running) the store
      // returns `{}`, and when there's no storage at all newStepResults is
      // undefined. In both cases preserve the inline stepResults instead of
      // discarding everything but the foreach step's result.
      const mergedForeachStepResults =
        !newStepResults || Object.keys(newStepResults).length === 0
          ? { ...(stepResults ?? {}), [getInnerStepId(step.step)]: newResult }
          : newStepResults;
      stepResults = { ...mergedForeachStepResults, __state: currentState };

      // For foreach iterations, check if all iterations are complete before emitting events
      // This prevents emitting workflow.suspend when only some concurrent iterations have finished
      if (currentIdx !== undefined) {
        const foreachResult = readForeachResult(stepResults, getInnerStepId(step.step));
        const iterationResults: ForeachIterationResult[] = foreachResult?.output ?? [];
        const targetLen = foreachResult?.payload?.length ?? 0;

        // Count iterations by status - pending iterations appear as null in stepResults after
        // storage merge (pending markers are converted to null by the storage layer).
        const pendingCount = iterationResults.filter((r: any) => r === null).length;
        const suspendedCount = iterationResults.filter(
          (r: any) => r && typeof r === 'object' && r.status === 'suspended',
        ).length;
        const iterationsStarted = iterationResults.length;

        // Emit per-iteration progress event
        const completedCount = iterationResults.filter(
          (r: any) => r !== null && !(typeof r === 'object' && r.status === 'suspended'),
        ).length;
        const iterationStatus =
          prevResult.status === 'suspended'
            ? ('suspended' as const)
            : prevResult.status === 'success'
              ? ('success' as const)
              : ('failed' as const);

        await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-progress',
            payload: {
              id: getInnerStepId(step.step),
              completedCount,
              totalCount: targetLen,
              currentIndex: currentIdx,
              iterationStatus,
              ...(prevResult.status === 'success' ? { iterationOutput: (prevResult as any).output } : {}),
            },
          },
        });

        if (pendingCount > 0) {
          // There are still pending (null) iterations - concurrent execution in progress
          // Wait for them to complete
          return;
        }

        // Check if there are more iterations to start before deciding to suspend
        // This handles partial concurrency: don't suspend until all iterations have been started
        if (iterationsStarted < targetLen) {
          // More iterations need to be started - call processWorkflowForEach to continue
          await processWorkflowForEach(
            {
              workflow,
              workflowId,
              prevResult: { status: 'success', output: foreachResult!.payload } as any,
              runId,
              executionPath: [executionPath[0]!],
              stepResults,
              activeStepsPath,
              resumeSteps,
              timeTravel,
              restart,
              resumeData: undefined, // Don't pass resumeData when starting new iterations
              parentWorkflow,
              requestContext,
              perStep,
              state: currentState,
              outputOptions,
            },
            {
              pubsub: this.mastra.pubsub,
              mastra: this.mastra,
              step,
            },
          );
          return;
        }

        if (suspendedCount > 0) {
          // Some iterations are suspended - emit workflow suspend
          // Build aggregated suspend metadata from all suspended iterations
          const collectedResumeLabels: Record<string, { stepId: string; foreachIndex?: number }> = {};
          // suspendedPaths maps stepId -> executionPath, using the step ID (not stepId[index])
          const suspendedPaths: Record<string, number[]> = {
            [getInnerStepId(step.step)]: [executionPath[0]!],
          };

          let firstSuspendedIterationPayload: Record<string, unknown> | undefined;
          for (let i = 0; i < iterationResults.length; i++) {
            const iterResult = iterationResults[i];
            if (iterResult && typeof iterResult === 'object' && iterResult.status === 'suspended') {
              // Collect resume labels
              if (iterResult.suspendPayload?.__workflow_meta?.resumeLabels) {
                Object.assign(collectedResumeLabels, iterResult.suspendPayload.__workflow_meta.resumeLabels);
              }
              if (firstSuspendedIterationPayload === undefined) {
                firstSuspendedIterationPayload = iterResult.suspendPayload;
              }
            }
          }

          // Create the aggregated foreach step suspend result.
          // Preserve non-__workflow_meta keys (e.g. __streamState stashed by the agent loop's
          // tool-call-step) from a suspended iteration so callers reading the step-level
          // suspendPayload still see that state. The agent-loop snapshot reader only inspects
          // step.suspendPayload, not the nested per-iteration payloads, so without this spread
          // __streamState would be lost on resume.
          const foreachSuspendResult = {
            status: 'suspended' as const,
            output: iterationResults,
            payload: foreachResult!.payload,
            suspendedAt: Date.now(),
            startedAt: foreachResult!.startedAt ?? Date.now(),
            suspendPayload: {
              ...firstSuspendedIterationPayload,
              __workflow_meta: {
                path: executionPath,
                resumeLabels: collectedResumeLabels,
              },
            },
          };

          // Update the step result with aggregated suspend status
          await workflowsStore?.updateWorkflowResults({
            workflowName: workflow.id,
            runId,
            stepId: getInnerStepId(step.step),
            result: foreachSuspendResult as any,
            requestContext,
          });

          // Check shouldPersistSnapshot option - default to true if not specified
          const shouldPersist =
            workflow?.options?.shouldPersistSnapshot?.({
              stepResults: stepResults ?? {},
              workflowStatus: 'suspended',
            }) ?? true;

          if (shouldPersist) {
            // Persist state to snapshot context before suspending
            await workflowsStore?.updateWorkflowResults({
              workflowName: workflow.id,
              runId,
              stepId: '__state',
              result: currentState as any,
              requestContext,
            });

            const suspendTracingContext = this.resolveSuspendTracingContext(runId);
            await workflowsStore?.updateWorkflowState({
              workflowName: workflowId,
              runId,
              opts: {
                status: 'suspended',
                result: foreachSuspendResult,
                suspendedPaths,
                resumeLabels: collectedResumeLabels,
                activePaths: executionPath,
                activeStepsPath,
                ...(suspendTracingContext ? { tracingContext: suspendTracingContext } : {}),
              },
            });
            await this.pruneAndRepersistSnapshot({ workflow, workflowId, runId });
          }

          await this.mastra.pubsub.publish('workflows', {
            type: 'workflow.suspend',
            runId,
            data: {
              workflowId,
              runId,
              executionPath: [executionPath[0]!],
              resumeSteps,
              parentWorkflow,
              stepResults: { ...stepResults, [getInnerStepId(step.step)]: foreachSuspendResult },
              prevResult: foreachSuspendResult,
              activeStepsPath,
              requestContext,
              timeTravel,
              restart,
              state: currentState,
              outputOptions,
            },
          });

          return;
        }

        // All iterations succeeded - call processWorkflowForEach to advance to next step
        await processWorkflowForEach(
          {
            workflow,
            workflowId,
            prevResult: { status: 'success', output: foreachResult!.payload } as any,
            runId,
            executionPath: [executionPath[0]!],
            stepResults,
            activeStepsPath,
            resumeSteps,
            timeTravel,
            restart,
            resumeData: undefined,
            parentWorkflow,
            requestContext,
            perStep,
            state: currentState,
            outputOptions,
          },
          {
            pubsub: this.mastra.pubsub,
            mastra: this.mastra,
            step,
          },
        );
        return;
      }
    } else if (isExecutableStep(step)) {
      // clear from activeStepsPath
      delete activeStepsPath[stepId];

      // handle nested workflow
      if (parentContext) {
        prevResult = stepResults[stepId] = {
          ...prevResult,
          payload: parentContext.input?.output ?? {},
          // Store nestedRunId in metadata for getWorkflowRunById retrieval
          ...(nestedRunId && {
            metadata: {
              ...(prevResult as any).metadata,
              nestedRunId,
            },
          }),
        };
      }

      const newStepResults = await workflowsStore?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId,
        result: prevResult,
        requestContext,
      });

      // When the Mastra has no storage configured, workflowsStore is undefined
      // and updateWorkflowResults returns undefined. When it has storage but no
      // run record yet (shouldPersistSnapshot skipped the initial running
      // snapshot), it returns `{}`. In both cases the event payload is the
      // source of truth — merge prevResult into the inline stepResults instead
      // of treating it as a hard early-return.
      if (!newStepResults || Object.keys(newStepResults).length === 0) {
        stepResults = { ...(stepResults ?? {}), [stepId]: prevResult };
      } else {
        stepResults = newStepResults;
      }
    }

    // Update stepResults with current state
    stepResults = { ...stepResults, __state: currentState };

    if (!prevResult?.status || prevResult.status === 'failed') {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.fail',
        runId,
        data: {
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          parentWorkflow,
          stepResults,
          timeTravel,
          restart,
          prevResult,
          activeStepsPath,
          requestContext,
          state: currentState,
          outputOptions,
        },
      });

      return;
    } else if (prevResult.status === 'suspended') {
      // Emit the per-step suspended watch event (fires per branch even inside a parallel/conditional)
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-suspended',
          payload: {
            id: stepId,
            ...prevResult,
            suspendedAt: Date.now(),
            suspendPayload: prevResult.suspendPayload,
          },
        },
      });

      const parentEntry = workflow.stepGraph[executionPath[0]!];
      if ((parentEntry?.type === 'parallel' || parentEntry?.type === 'conditional') && executionPath.length > 1) {
        // A branch of a parallel/conditional suspended. Wait for all sibling branches and
        // aggregate their suspended paths into a single workflow.suspend so resume() can
        // target any of them (each branch publishing its own workflow.suspend would
        // otherwise race and clobber suspendedPaths).
        await this.aggregateBranchResults({
          workflow,
          workflowId,
          runId,
          branchEntry: parentEntry,
          branchExecutionPath: executionPath,
          latestBranchResult: prevResult,
          resumeSteps,
          timeTravel,
          restart,
          parentWorkflow,
          stepResults,
          activeStepsPath,
          requestContext,
          state: currentState,
          outputOptions,
        });
        return;
      }

      const suspendedPaths: Record<string, number[]> = {};
      const suspendedStep = getStep(workflow, executionPath);
      if (suspendedStep) {
        suspendedPaths[suspendedStep.id] = executionPath;
      }

      // Extract resume labels from suspend payload metadata
      const resumeLabels: Record<string, { stepId: string; foreachIndex?: number }> =
        prevResult.suspendPayload?.__workflow_meta?.resumeLabels ?? {};

      // Check shouldPersistSnapshot option - default to true if not specified
      const shouldPersist =
        workflow?.options?.shouldPersistSnapshot?.({
          stepResults: stepResults ?? {},
          workflowStatus: 'suspended',
        }) ?? true;

      if (shouldPersist) {
        // Persist state to snapshot context before suspending
        // We use a special '__state' key to store state at the context level
        await workflowsStore?.updateWorkflowResults({
          workflowName: workflow.id,
          runId,
          stepId: '__state',
          result: currentState as any,
          requestContext,
        });

        const suspendTracingContext = this.resolveSuspendTracingContext(runId);
        await workflowsStore?.updateWorkflowState({
          workflowName: workflowId,
          runId,
          opts: {
            status: 'suspended',
            result: prevResult,
            suspendedPaths,
            resumeLabels,
            activePaths: executionPath,
            activeStepsPath,
            ...(suspendTracingContext ? { tracingContext: suspendTracingContext } : {}),
          },
        });
        await this.pruneAndRepersistSnapshot({ workflow, workflowId, runId });
      }

      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.suspend',
        runId,
        data: {
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          parentWorkflow,
          stepResults,
          prevResult,
          activeStepsPath,
          requestContext,
          timeTravel,
          restart,
          state: currentState,
          outputOptions,
        },
      });

      return;
    }

    if (step && isSingleStepEntry(step)) {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-result',
          payload: {
            id: stepId,
            ...prevResult,
          },
        },
      });

      if (prevResult.status === 'success') {
        await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-finish',
            payload: {
              id: stepId,
              metadata: {},
            },
          },
        });
      }
    }

    // Re-resolve the top-level entry at this path to drive next-step routing
    // (parallel/conditional aggregation, foreach re-run, or advancing the index).
    const rawNextStep = workflow.stepGraph[executionPath[0]!];
    step = rawNextStep;
    if (perStep) {
      if (parentWorkflow && executionPath[0]! < workflow.stepGraph.length - 1) {
        const { endedAt, output, status, ...nestedPrevResult } = prevResult as StepSuccess<any, any, any, any>;
        await this.endWorkflow({
          workflow,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult: { ...nestedPrevResult, status: 'paused' },
          activeStepsPath,
          requestContext,
          perStep,
        });
      } else {
        await this.endWorkflow({
          workflow,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult,
          activeStepsPath,
          requestContext,
          perStep,
        });
      }
    } else if ((step?.type === 'parallel' || step?.type === 'conditional') && executionPath.length > 1) {
      await this.aggregateBranchResults({
        workflow,
        workflowId,
        runId,
        branchEntry: step,
        branchExecutionPath: executionPath,
        latestBranchResult: prevResult,
        resumeSteps,
        timeTravel,
        restart,
        parentWorkflow,
        stepResults,
        activeStepsPath,
        requestContext,
        state: currentState,
        outputOptions,
      });
    } else if (step?.type === 'foreach') {
      // Get the original array from the foreach step's stored payload
      const foreachStepResult = readForeachResult(stepResults, getInnerStepId(step.step));
      const originalArray = foreachStepResult?.payload;
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1),
          resumeSteps,
          parentWorkflow,
          stepResults,
          prevResult: { ...prevResult, output: originalArray },
          activeStepsPath,
          requestContext,
          timeTravel,
          restart,
          state: currentState,
          outputOptions,
          forEachIndex,
        },
      });
    } else if (executionPath[0]! >= workflow.stepGraph.length - 1) {
      await this.endWorkflow({
        workflow,
        parentWorkflow,
        workflowId,
        runId,
        executionPath,
        resumeSteps,
        stepResults,
        prevResult,
        activeStepsPath,
        requestContext,
        state: currentState,
        outputOptions,
      });
    } else {
      const nextExecutionPath = executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]);
      await this.mastra.pubsub.publish('workflows', {
        // Schedule the next step with its own per-type run event so a declarative
        // agent/tool/mapping step is interpreted explicitly by its handler.
        type: stepRunEventType(getEntryAtPath(workflow.stepGraph, nextExecutionPath)),
        runId,
        data: {
          workflowId,
          runId,
          executionPath: nextExecutionPath,
          resumeSteps,
          parentWorkflow,
          stepResults,
          prevResult,
          activeStepsPath,
          requestContext,
          timeTravel,
          restart,
          state: currentState,
          outputOptions,
        },
      });
    }
  }

  async loadData({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null | undefined> {
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: workflowId,
      runId,
    });

    return snapshot;
  }

  /**
   * Result of handling a single workflow event.
   *
   * - `ok: true` — event was processed; the transport should ack.
   * - `ok: false, retry: true` — transient failure, the transport should
   *   nack/redeliver (or, for HTTP push, return 5xx so the broker retries).
   * - `ok: false, retry: false` — terminal/poison failure, the transport
   *   should drop the event (or return 4xx for HTTP push).
   */
  async handle(event: Event): Promise<{ ok: true } | { ok: false; retry: boolean }> {
    // Build a stable retry key once per call. If event.id is missing we fall
    // back to a deterministic composite of type/runId/workflowId/executionPath
    // so the same logical event lands in the same bucket on each redelivery
    // and eventually reaches MAX_DELIVERY_ATTEMPTS. Never include a timestamp
    // (or any monotonically-changing token) here — that resets the counter
    // every attempt and reopens the infinite-retry path this guards against.
    const baseWorkflowData = event.data as Partial<Pick<ProcessorArgs, 'workflowId' | 'executionPath'>>;
    const eventKey =
      event.id ??
      JSON.stringify({
        type: event.type,
        runId: event.runId,
        workflowId: baseWorkflowData?.workflowId,
        executionPath: baseWorkflowData?.executionPath,
      });

    // If we've already declared this event terminal, stay terminal. A buggy
    // transport that re-delivers a poisoned event must not rerun
    // errorWorkflow on every redelivery or reset the per-event budget.
    if (this.deliveryAttempts.get(eventKey) === WorkflowEventProcessor.TERMINAL_SENTINEL) {
      return { ok: false, retry: false };
    }

    try {
      await this.#dispatch(event);
      this.deliveryAttempts.delete(eventKey);
      return { ok: true };
    } catch (err) {
      const attempts = (this.deliveryAttempts.get(eventKey) ?? 0) + 1;
      this.#setDeliveryAttempts(eventKey, attempts);
      const exhausted = attempts >= WorkflowEventProcessor.MAX_DELIVERY_ATTEMPTS;

      this.mastra.getLogger()?.error('WorkflowEventProcessor.handle: error processing event', {
        type: event.type,
        runId: event.runId,
        attempts,
        maxAttempts: WorkflowEventProcessor.MAX_DELIVERY_ATTEMPTS,
        terminal: exhausted,
        error: err,
      });

      if (!exhausted) {
        return { ok: false, retry: true };
      }

      // Transport-level retries are exhausted. Surface as a terminal workflow
      // failure so any caller awaiting workflows-finish (e.g. agent.generate())
      // sees an error instead of hanging forever. Replace the counter with a
      // TERMINAL sentinel so any later redelivery of the same logical event
      // short-circuits at the top of handle() instead of rerunning
      // errorWorkflow or resetting the budget.
      this.#setDeliveryAttempts(eventKey, WorkflowEventProcessor.TERMINAL_SENTINEL);
      try {
        const failWorkflowData = event.data as Omit<ProcessorArgs, 'workflow'>;
        // Never republish workflow.fail for an event that IS workflow.fail.
        // Each publish gets a fresh event id (fresh retry bucket), so with a
        // persistently-broken dependency (e.g. missing workflows table) the
        // fail event would exhaust its own budget and publish another
        // workflow.fail forever.
        if (
          event.type !== 'workflow.fail' &&
          failWorkflowData &&
          failWorkflowData.workflowId &&
          failWorkflowData.runId
        ) {
          await this.errorWorkflow(failWorkflowData, getErrorFromUnknown(err));
        }
      } catch (failErr) {
        this.mastra
          .getLogger()
          ?.error('WorkflowEventProcessor.handle: failed to publish workflow.fail after retry exhaustion', {
            type: event.type,
            runId: event.runId,
            error: failErr,
          });
      }
      return { ok: false, retry: false };
    }
  }

  /**
   * Set a deliveryAttempts entry and evict the oldest entries (FIFO via Map's
   * insertion-order iteration) if we've exceeded DELIVERY_ATTEMPTS_MAX_ENTRIES.
   * Re-setting an existing key first deletes then re-inserts so that the entry
   * moves to the tail of the iteration order; this keeps actively-retrying
   * events from being evicted while idle TERMINAL_SENTINEL entries age out.
   */
  #setDeliveryAttempts(eventKey: string, value: number): void {
    if (this.deliveryAttempts.has(eventKey)) {
      this.deliveryAttempts.delete(eventKey);
    }
    this.deliveryAttempts.set(eventKey, value);
    while (this.deliveryAttempts.size > WorkflowEventProcessor.DELIVERY_ATTEMPTS_MAX_ENTRIES) {
      const oldestKey = this.deliveryAttempts.keys().next().value;
      if (oldestKey === undefined) break;
      this.deliveryAttempts.delete(oldestKey);
    }
  }

  /**
   * @deprecated prefer {@link WorkflowEventProcessor.handle}, which returns a
   * structured result instead of relying on an ack callback. Kept as a thin
   * wrapper so existing pull-mode call sites continue to work.
   */
  async process(event: Event, ack?: () => Promise<void>) {
    const result = await this.handle(event);
    if (result.ok) {
      try {
        await ack?.();
      } catch (e) {
        this.mastra.getLogger()?.error('Error acking event', e);
      }
    }
  }

  async #dispatch(event: Event) {
    const { type, data } = event;

    const workflowData = data as Omit<ProcessorArgs, 'workflow'>;

    const currentState = await this.loadData({
      workflowId: workflowData.workflowId,
      runId: workflowData.runId,
    });

    if (currentState?.status === 'canceled' && type !== 'workflow.end' && type !== 'workflow.cancel') {
      return;
    }

    if (type.startsWith('workflow.user-event.')) {
      const userEventWorkflow = this.#tryResolveWorkflow(workflowData.workflowId);
      if (!userEventWorkflow) {
        // Workflow no longer registered (e.g. deleted from code). Treat as a
        // terminal failure rather than throwing — otherwise the transport
        // would redeliver this event indefinitely.
        return this.errorWorkflow(
          workflowData,
          new MastraError({
            id: 'MASTRA_WORKFLOW',
            text: `Workflow not found: ${workflowData.workflowId}`,
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          }),
        );
      }
      await processWorkflowWaitForEvent(
        {
          ...workflowData,
          workflow: userEventWorkflow,
        },
        {
          pubsub: this.mastra.pubsub,
          eventName: type.split('.').slice(2).join('.'),
          currentState: currentState!,
        },
      );
      return;
    }

    let workflow;
    if (this.mastra.__hasInternalWorkflow(workflowData.workflowId, workflowData.runId)) {
      workflow = this.mastra.__getInternalWorkflow(workflowData.workflowId, workflowData.runId);
    } else if (workflowData.parentWorkflow) {
      workflow = getNestedWorkflow(this.mastra, workflowData.parentWorkflow);
    } else {
      workflow = this.#tryResolveWorkflow(workflowData.workflowId);
    }

    if (!workflow) {
      // For terminal/cleanup events (`workflow.fail`, `workflow.end`,
      // `workflow.cancel`), we deliberately keep dispatching with
      // `workflow=undefined` so the processors can finish their cleanup work
      // (persist final state, notify parent workflow, publish to
      // workflows-finish). Republishing `workflow.fail` here would loop
      // forever because the redelivered event would hit this same branch.
      if (type === 'workflow.fail' || type === 'workflow.end' || type === 'workflow.cancel') {
        // fall through to switch below with workflow=undefined
      } else {
        return this.errorWorkflow(
          workflowData,
          new MastraError({
            id: 'MASTRA_WORKFLOW',
            text: `Workflow not found: ${workflowData.workflowId}`,
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          }),
        );
      }
    }

    if (type === 'workflow.start' || type === 'workflow.resume') {
      const { runId } = workflowData;
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-start',
          payload: {
            runId,
          },
        },
      });
    }

    // For the cleanup-path events (`workflow.fail`/`workflow.end`/
    // `workflow.cancel`) we may have fallen through above with no resolved
    // workflow. The processors for those events tolerate `workflow=undefined`
    // (they rely on optional chaining / persisted state), so we cast here to
    // avoid widening the shared `ProcessorArgs.workflow` type across the
    // hundreds of usage sites in this file.
    const workflowArg = workflow as Workflow;

    switch (type) {
      case 'workflow.cancel':
        await this.processWorkflowCancel({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.start':
        await this.processWorkflowStart({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.resume':
        await this.processWorkflowStart({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.end':
        await this.processWorkflowEnd({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.step.end':
        await this.processWorkflowStepEnd({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.step.run':
        await this.processWorkflowStepRun({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.agent.run':
        await this.processWorkflowAgentRun({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.tool.run':
        await this.processWorkflowToolRun({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.mapping.run':
        await this.processWorkflowMappingRun({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.suspend':
        await this.processWorkflowSuspend({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      case 'workflow.fail':
        await this.processWorkflowFail({
          workflow: workflowArg,
          ...workflowData,
        });
        break;
      default:
        break;
    }
  }
}
