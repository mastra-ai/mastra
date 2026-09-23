import { createHash } from 'node:crypto';
import EventEmitter from 'node:events';
import { ErrorCategory, ErrorDomain, MastraError, getErrorFromUnknown } from '../../../error';
import { EventProcessor } from '../../../events/processor';
import type { Event } from '../../../events/types';
import type { Mastra } from '../../../mastra';
import type { TracingContext } from '../../../observability';
import { resolveExportedSpanId } from '../../../observability';
import { RequestContext } from '../../../request-context/';
import type { GetWorkflowRunTerminalStatusResult } from '../../../storage/types';
import type { StepExecutionStrategy } from '../../../worker/types';
import { getEntryId, getEntryRetries, getEntrySchemas, getEntryWorkflow } from '../../../workflows/step-entry';
import type {
  RestartExecutionParams,
  SingleStepEntry,
  StepFlowEntry,
  StepResult,
  StepSuccess,
  TimeTravelExecutionParams,
  WorkflowRunState,
} from '../../../workflows/types';
import type { Workflow } from '../../../workflows/workflow';
import {
  getOrCreateWorkflowStepLifecycleState,
  getWorkflowLifecycleTopic,
  mergeWorkflowStepLifecycleStates,
  publishWorkflowLifecycleEvent,
  requireWorkflowExecutionGeneration,
} from '../../lifecycle-events';
import { computeScheduleDefinitionHash } from '../../scheduler/definition-hash';
import { WORKFLOW_TERMINAL_FOREACH_RUN_KEY, createWorkflowTerminalGraphFingerprint } from '../../terminal-continuation';
import {
  canonicalPlannerInteger,
  canonicalPlannerPath,
  canonicalPlannerStructuralString,
} from '../../terminal-continuation/planning-view';
import { materializeWorkflowTerminalRecoveryAncestry } from '../../terminal-recovery';
import type { WorkflowTerminalRecoveryAncestryV1 } from '../../terminal-recovery';
import {
  createRestartExecutionParams,
  createTimeTravelExecutionParams,
  getSingleStepEntryId,
  getStepIds,
  isSingleStepEntry,
  omitPriorCompletionFields,
  resolveForeachConcurrency,
  validateStepResumeData,
} from '../../utils';
import { getPersistedRequestContext, resolveCurrentState } from '../helpers';
import { createEventedResumeLabels, mergeEventedResumeLabels, normalizeEventedResumeLabels } from '../resume-label';
import { StepExecutor } from '../step-executor';
import {
  aggregateEventedForeachSuspensions,
  assertValidEventedForeachSuspensionResults,
  isEventedForeachSuspensionResult,
  restoreEventedForeachSuspensionPayloads,
  stripEventedForeachStreamStateForPropagation,
} from './foreach-suspension';
import { isQueuedForeachIteration, processWorkflowForEach, processWorkflowLoop } from './loop';
import { processWorkflowConditional, processWorkflowParallel } from './parallel';
import { processWorkflowSleep, processWorkflowSleepUntil, processWorkflowWaitForEvent } from './sleep';
import { getNestedWorkflow, getStepId, isExecutableStep } from './utils';

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
  /** Original public resume label, retained while routing through nested workflow boundaries. */
  resumeLabel?: string;
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
  /** A new nested run whose pending policy requires an initial snapshot. */
  initializeSnapshot?: boolean;
  /** Resource identity inherited by a newly initialized nested run. */
  resourceId?: string;
  /** Registration generation held by the event currently being dispatched. */
  internalWorkflowRegistrationGeneration?: number;
  /** Public execution lineage; never substitute the registry generation above. */
  executionGeneration?: string;
  lifecycleResumeAttempt?: number;
  lifecycleStepStates?: Record<string, { stepCallId: string; stepAttempt: number }>;
  /** The fan-out producer durably reserved this branch attempt before dispatch. */
  lifecycleStepAttemptReserved?: boolean;
  /** Producer-side attempt baselines captured before dispatch mutates durable state. */
  lifecycleIncomingStepStates?: Record<string, { stepCallId: string; stepAttempt: number }>;
  lifecycleAttemptBaselineCaptured?: boolean;
  /** Complete logical suspension set for a multi-branch transition. */
  suspendedStepIds?: string[];
  lifecycleStartKind?: 'start' | 'resume';
};

export type ParentWorkflow = {
  workflowId: string;
  runId: string;
  executionGeneration: string;
  lifecycleResumeAttempt: number;
  lifecycleStepStates: Record<string, { stepCallId: string; stepAttempt: number }>;
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
  /** Data-only child-to-root identity captured before nested execution starts. */
  recoveryAncestry?: WorkflowTerminalRecoveryAncestryV1;
  /** Whether this parent transition is represented by a durable workflow snapshot. */
  shouldPersistSnapshot?: boolean;
};

function parentWorkflowLifecycleExecution(parentWorkflow: ParentWorkflow) {
  return {
    executionGeneration: requireWorkflowExecutionGeneration(
      parentWorkflow.executionGeneration,
      `Nested parent workflow ${parentWorkflow.workflowId}/${parentWorkflow.runId}`,
    ),
    lifecycleResumeAttempt: parentWorkflow.lifecycleResumeAttempt,
    lifecycleStepStates: parentWorkflow.lifecycleStepStates,
  };
}

function resolveWorkflowStepPath(workflow: Workflow, executionPath: number[] | undefined) {
  if (!Array.isArray(executionPath) || executionPath.length === 0) return undefined;

  let entry = workflow.stepGraph[executionPath[0]!];
  if (entry?.type === 'parallel' || entry?.type === 'conditional') {
    if (executionPath.length !== 2) return undefined;
    entry = entry.steps[executionPath[1]!];
  } else if (executionPath.length !== 1) {
    return undefined;
  }

  if (entry === undefined || !isExecutableStep(entry)) return undefined;
  return entry;
}

function pathsEqual(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Recover one already-reserved active attempt from durable lifecycle state.
 *
 * Cancellation cleanup must still work after a deployment removes the
 * workflow definition. In that case the persisted coordinate is the only
 * authority available, so accept it only when the coordinate is canonical,
 * its deterministic call id matches, and exactly one retained attempt matches
 * the active step/path.
 */
function resolvePersistedActiveStepLifecycleIdentity(params: {
  workflow?: Workflow;
  workflowId: string;
  runId: string;
  executionGeneration: string;
  activeStepId: unknown;
  executionPath: unknown;
  lifecycleStepStates: Record<string, { stepCallId: string; stepAttempt: number }>;
  stepResult: unknown;
}): { stepId: string; stepCallId: string; stepAttempt: number } | undefined {
  let stepId: string;
  let executionPath: number[];
  try {
    stepId = canonicalPlannerStructuralString(params.activeStepId, 'activeStepId', 512);
    executionPath = canonicalPlannerPath(params.executionPath, `activeStepsPath.${stepId}`);
  } catch {
    return undefined;
  }

  let registeredEntry: StepFlowEntry | undefined;
  if (params.workflow) {
    registeredEntry = params.workflow.stepGraph[executionPath[0]!];
    if (registeredEntry?.type === 'parallel' || registeredEntry?.type === 'conditional') {
      if (executionPath.length !== 2) return undefined;
      registeredEntry = registeredEntry.steps[executionPath[1]!];
    } else if (registeredEntry?.type === 'foreach') {
      if (executionPath.length !== 2) return undefined;
    } else if (executionPath.length !== 1) {
      return undefined;
    }
    if (!registeredEntry || !isExecutableStep(registeredEntry) || getStepIds(registeredEntry)[0] !== stepId) {
      return undefined;
    }
  }

  const rawIterationCount =
    params.stepResult !== null && typeof params.stepResult === 'object'
      ? (params.stepResult as { metadata?: { iterationCount?: unknown } }).metadata?.iterationCount
      : undefined;
  let currentIterationCount: number | undefined;
  if (rawIterationCount !== undefined) {
    try {
      currentIterationCount = canonicalPlannerInteger(rawIterationCount, `context.${stepId}.metadata.iterationCount`);
    } catch {
      return undefined;
    }
  }

  const matches: Array<{ stepId: string; stepCallId: string; stepAttempt: number }> = [];
  for (const [coordinateKey, retainedState] of Object.entries(params.lifecycleStepStates)) {
    // Canonical coordinates are short JSON tuples. Bound parsing so corrupt
    // persisted state cannot turn terminal cleanup into unbounded work.
    if (coordinateKey.length > 4_096) continue;

    let coordinate: unknown;
    try {
      coordinate = JSON.parse(coordinateKey);
    } catch {
      continue;
    }
    if (!Array.isArray(coordinate) || coordinate.length !== 4) continue;

    let coordinateStepId: string;
    let coordinatePath: number[];
    let foreachIndex: number | undefined;
    let iterationCount: number | undefined;
    try {
      coordinateStepId = canonicalPlannerStructuralString(coordinate[0], 'lifecycleStepCoordinate.stepId', 512);
      coordinatePath = canonicalPlannerPath(coordinate[1], 'lifecycleStepCoordinate.executionPath');
      foreachIndex =
        coordinate[2] === null
          ? undefined
          : canonicalPlannerInteger(coordinate[2], 'lifecycleStepCoordinate.foreachIndex');
      iterationCount =
        coordinate[3] === null
          ? undefined
          : canonicalPlannerInteger(coordinate[3], 'lifecycleStepCoordinate.iterationCount');
    } catch {
      continue;
    }
    if (coordinateStepId !== stepId || !pathsEqual(coordinatePath, executionPath)) continue;
    if (foreachIndex !== undefined && foreachIndex !== executionPath[1]) continue;

    if (registeredEntry) {
      const expectedForeachIndex = registeredEntry.type === 'foreach' ? executionPath[1] : undefined;
      const expectedIterationCount =
        registeredEntry.type === 'loop' ? (currentIterationCount ?? 0) : currentIterationCount;
      if (foreachIndex !== expectedForeachIndex || iterationCount !== expectedIterationCount) continue;
    } else if (currentIterationCount !== undefined && iterationCount !== currentIterationCount) {
      continue;
    }

    const expectedStates: Record<string, { stepCallId: string; stepAttempt: number }> = {};
    const expected = getOrCreateWorkflowStepLifecycleState({
      workflowId: params.workflowId,
      runId: params.runId,
      executionGeneration: params.executionGeneration,
      stepId,
      executionPath,
      foreachIndex,
      iterationCount,
      states: expectedStates,
    });
    if (
      expected.key !== coordinateKey ||
      retainedState === null ||
      typeof retainedState !== 'object' ||
      retainedState.stepCallId !== expected.state.stepCallId ||
      !Number.isSafeInteger(retainedState.stepAttempt) ||
      retainedState.stepAttempt < 1
    ) {
      continue;
    }
    matches.push({ stepId, stepCallId: retainedState.stepCallId, stepAttempt: retainedState.stepAttempt });
  }

  return matches.length === 1 ? matches[0] : undefined;
}

type NestedWorkflowRunCoordinate = {
  parentWorkflowId: string;
  parentRunId: string;
  nestedWorkflowId: string;
  stepId: string;
  executionPath: number[];
  loopIteration?: number;
};

type OwnEnumerableDataObservation = { status: 'missing' } | { status: 'found'; value: unknown };

function observeOwnEnumerableData(value: unknown, key: PropertyKey): OwnEnumerableDataObservation {
  if (value === null || typeof value !== 'object') return { status: 'missing' };
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor?.enumerable && 'value' in descriptor
    ? { status: 'found', value: descriptor.value }
    : { status: 'missing' };
}

function ownEnumerableDataValue(value: unknown, key: PropertyKey): unknown {
  const observation = observeOwnEnumerableData(value, key);
  return observation.status === 'found' ? observation.value : undefined;
}

function materializeNestedWorkflowRunCoordinate(input: NestedWorkflowRunCoordinate): NestedWorkflowRunCoordinate {
  const parentWorkflowId = canonicalPlannerStructuralString(input.parentWorkflowId, 'parentWorkflowId', 512);
  const parentRunId = canonicalPlannerStructuralString(input.parentRunId, 'parentRunId', 512);
  const nestedWorkflowId = canonicalPlannerStructuralString(input.nestedWorkflowId, 'nestedWorkflowId', 512);
  const stepId = canonicalPlannerStructuralString(input.stepId, 'stepId', 512);
  const executionPath = canonicalPlannerPath(input.executionPath, 'executionPath');
  const loopIteration =
    input.loopIteration === undefined ? undefined : canonicalPlannerInteger(input.loopIteration, 'loopIteration');
  return {
    parentWorkflowId,
    parentRunId,
    nestedWorkflowId,
    stepId,
    executionPath,
    ...(loopIteration === undefined ? {} : { loopIteration }),
  };
}

function createNestedWorkflowRunIdFromCoordinate(input: NestedWorkflowRunCoordinate): string {
  const digest = createHash('sha256')
    .update('mastra.evented.nested-workflow-run.v1\0', 'utf8')
    .update(
      JSON.stringify([
        input.parentWorkflowId,
        input.parentRunId,
        input.nestedWorkflowId,
        input.stepId,
        input.executionPath,
        input.loopIteration ?? null,
      ]),
      'utf8',
    )
    .digest('hex');
  return `wfn:v1:${digest}`;
}

/** @internal Resolves scalar or per-iteration nested ownership for restart/time travel. */
export function resolveNestedWorkflowOwnedRunId({
  metadata,
  isForEach,
  forEachIndex,
}: {
  metadata: Record<string, any> | undefined;
  isForEach: boolean;
  forEachIndex?: number;
}): string | undefined {
  if (isForEach) {
    if (forEachIndex === undefined) return undefined;
    const canonicalForEachIndex = canonicalPlannerInteger(forEachIndex, 'forEachIndex');
    const workflowMetadata = ownEnumerableDataValue(metadata, '__workflow_meta');
    const iterationRuns = ownEnumerableDataValue(workflowMetadata, WORKFLOW_TERMINAL_FOREACH_RUN_KEY);
    const owned = observeOwnEnumerableData(iterationRuns, String(canonicalForEachIndex));
    if (owned.status === 'missing') return undefined;
    if (typeof owned.value !== 'string') throw new TypeError('ownedNestedRunId must be a string');
    return canonicalPlannerStructuralString(owned.value, 'ownedNestedRunId', 512);
  }
  const owned = observeOwnEnumerableData(metadata, 'nestedRunId');
  if (owned.status === 'missing') return undefined;
  if (typeof owned.value !== 'string') throw new TypeError('ownedNestedRunId must be a string');
  return canonicalPlannerStructuralString(owned.value, 'ownedNestedRunId', 512);
}

/** @internal Reads loop identity only from durable own data metadata. */
export function resolveNestedWorkflowLoopIteration(metadata: Record<string, any> | undefined): number {
  const iteration = ownEnumerableDataValue(metadata, 'iterationCount');
  return iteration === undefined ? 0 : canonicalPlannerInteger(iteration, 'loopIteration');
}

/** @internal Stable across broker redelivery for one exact nested execution coordinate. */
export function createNestedWorkflowRunId(input: NestedWorkflowRunCoordinate): string {
  return createNestedWorkflowRunIdFromCoordinate(materializeNestedWorkflowRunCoordinate(input));
}

/** @internal Restart/time travel reuse retained ownership; only a missing owner falls back to the stable coordinate. */
export function resolveNestedWorkflowDispatchRunId(
  input: Parameters<typeof createNestedWorkflowRunId>[0] & { ownedRunId?: string },
): string {
  const coordinate = materializeNestedWorkflowRunCoordinate(input);
  return input.ownedRunId === undefined
    ? createNestedWorkflowRunIdFromCoordinate(coordinate)
    : canonicalPlannerStructuralString(input.ownedRunId, 'ownedRunId', 512);
}

/** @internal Stable lineage for one child dispatch within a parent execution. */
export function createNestedWorkflowExecutionGeneration(
  input: NestedWorkflowRunCoordinate & {
    parentExecutionGeneration: string;
    nestedRunId: string;
  },
): string {
  const coordinate = materializeNestedWorkflowRunCoordinate(input);
  const parentExecutionGeneration = requireWorkflowExecutionGeneration(
    input.parentExecutionGeneration,
    `Nested workflow ${coordinate.nestedWorkflowId}/${input.nestedRunId}`,
  );
  const nestedRunId = canonicalPlannerStructuralString(input.nestedRunId, 'nestedRunId', 512);
  const digest = createHash('sha256')
    .update('mastra.evented.nested-workflow-execution.v1\0', 'utf8')
    .update(
      JSON.stringify([
        coordinate.parentWorkflowId,
        coordinate.parentRunId,
        parentExecutionGeneration,
        coordinate.nestedWorkflowId,
        coordinate.stepId,
        coordinate.executionPath,
        coordinate.loopIteration ?? null,
        nestedRunId,
      ]),
      'utf8',
    )
    .digest('hex');
  return `wfeg:v1:${digest}`;
}

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

export class WorkflowEventProcessor extends EventProcessor {
  /**
   * Maximum number of source-event deliveries that may enter workflow
   * dispatch. The transport owns the durable delivery count through
   * `Event.deliveryAttempt`; do not mirror it in process-local state.
   */
  private static readonly MAX_DELIVERY_ATTEMPTS = 3;
  private static readonly TERMINALIZABLE_RUN_STATUSES = new Set<WorkflowRunState['status']>([
    'running',
    'waiting',
    'pending',
    'suspended',
  ]);
  private static readonly TERMINAL_CHILD_RUN_STATUSES = new Set<WorkflowRunState['status']>([
    'success',
    'failed',
    'canceled',
    'tripwire',
    'bailed',
    'skipped',
  ]);
  private stepExecutor: StepExecutor;
  private stepExecutionStrategy?: StepExecutionStrategy;
  // Map of runId -> AbortController for active workflow runs
  private abortControllers: Map<string, AbortController> = new Map();
  // Map of child runId -> parent runId for tracking nested workflows
  private parentChildRelationships: Map<string, string> = new Map();
  private runFormats: Map<string, 'legacy' | 'vnext' | undefined> = new Map();

  // How long after a run reaches a terminal state before its
  // `workflow.events.v2.<runId>` topic is cleared from the pubsub. Exact
  // indexed replay extends this delay to its declared retention horizon so a
  // terminal timer cannot erase history before a restartable subscriber's
  // advertised window closes. 0 explicitly disables timer-based cleanup.
  private readonly topicCleanupDelayMs: number;
  private static readonly DEFAULT_TOPIC_CLEANUP_DELAY_MS = 30_000;

  // Pending per-execution topic cleanup timers. Workflow id and execution
  // generation are both part of the key because run ids are not globally
  // unique and an older generation retains its own exact lifecycle log.
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
  private scheduleRunTopicCleanup(workflowId: string, runId: string, executionGeneration: string): void {
    if (this.topicCleanupDelayMs <= 0) return;
    const cleanupKey = this.runTopicCleanupKey(workflowId, runId, executionGeneration);
    this.cancelRunTopicCleanup(workflowId, runId, executionGeneration);
    // Event processors may be constructed before their owning Mastra instance
    // is registered. Resolve the transport capability here, when the terminal
    // event is actually processed, rather than capturing a possibly absent or
    // stale pubsub during construction.
    const cleanupDelayMs = Math.max(this.topicCleanupDelayMs, this.mastra?.pubsub.indexedReplay?.retentionMs ?? 0);
    const timer = setTimeout(() => {
      this.pendingTopicCleanups.delete(cleanupKey);
      void this.clearRunTopicUnlessActive(workflowId, runId, executionGeneration);
    }, cleanupDelayMs);
    // Don't let a pending cleanup timer keep a short-lived process alive.
    timer.unref?.();
    this.pendingTopicCleanups.set(cleanupKey, timer);
  }

  private runTopicCleanupKey(workflowId: string, runId: string, executionGeneration: string): string {
    return JSON.stringify([workflowId, runId, executionGeneration]);
  }

  private cancelRunTopicCleanup(workflowId: string, runId: string, executionGeneration: string): void {
    const cleanupKey = this.runTopicCleanupKey(workflowId, runId, executionGeneration);
    const timer = this.pendingTopicCleanups.get(cleanupKey);
    if (timer !== undefined) {
      clearTimeout(timer);
      this.pendingTopicCleanups.delete(cleanupKey);
    }
  }

  private async clearRunTopicUnlessActive(
    workflowId: string,
    runId: string,
    executionGeneration: string,
  ): Promise<void> {
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
        const currentExecutionGeneration = typeof snapshot === 'string' ? undefined : snapshot?.executionGeneration;
        // An older generation never owns deletion of the runId-scoped watch
        // topic after a newer execution has taken over, even if that newer
        // execution has already become terminal. Its own retention timer owns
        // shared-topic cleanup. The old generation may still clear its exact,
        // generation-scoped lifecycle log after its retention horizon.
        if (currentExecutionGeneration && currentExecutionGeneration !== executionGeneration) {
          await this.mastra.pubsub.clearTopic(getWorkflowLifecycleTopic({ workflowId, runId, executionGeneration }));
          return;
        }
        // Run was restarted (possibly by another worker process) after the
        // terminal end that scheduled this cleanup: it is writing to its
        // topic again, and its own terminal end will reschedule deletion.
        if (status && WorkflowEventProcessor.ACTIVE_RUN_STATUSES.has(status)) return;
      }
      await Promise.all([
        this.mastra.pubsub.clearTopic(`workflow.events.v2.${runId}`),
        this.mastra.pubsub.clearTopic(getWorkflowLifecycleTopic({ workflowId, runId, executionGeneration })),
      ]);
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
      | {
          id?: string;
          traceId?: string;
          getParentSpanId?: () => string | undefined;
          getExportedSpanId?: () => string | undefined;
        }
      | undefined;
    if (!span) return undefined;
    // See default.ts: the persisted spanId becomes the resumed span's parentSpanId,
    // so it must reference a span that actually reaches exporters.
    return { traceId: span.traceId, spanId: resolveExportedSpanId(span), parentSpanId: span.getParentSpanId?.() };
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
        snapshot: {
          ...pruned,
          executionGeneration: snapshot.executionGeneration,
          lifecycleResumeAttempt: snapshot.lifecycleResumeAttempt,
          lifecycleStepStates: snapshot.lifecycleStepStates,
        },
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

  /**
   * Stale-build fence for scheduled fires (#19169).
   *
   * A `workflow.start` published by the scheduler carries no step graph —
   * only a workflow id, which this process resolves against its *own*
   * registry. When the scheduler cannot keep the fire local (scheduler-only
   * topology) the event reaches every consumer on the shared topic, so a
   * straggler from a previous deploy could execute an outdated graph and
   * skip steps the current build added (e.g. a gate enforcing a disable).
   *
   * The scheduler stamps `scheduleDefinitionHash` from the schedule row.
   * If our locally registered definition hashes differently, we refuse the
   * fire and record a failed trigger so the mismatch is visible in schedule
   * history rather than silently doing nothing.
   *
   * Fails open when the event carries no hash (imperative/legacy schedules
   * and all non-scheduled runs) or when our own graph can't be hashed.
   *
   * @returns `true` to proceed with execution, `false` to abandon the fire.
   */
  async #ensureScheduledDefinitionMatches(data: unknown, workflow: Workflow): Promise<boolean> {
    const expected = (data as { scheduleDefinitionHash?: unknown } | undefined)?.scheduleDefinitionHash;
    if (typeof expected !== 'string' || !expected) return true;

    const localHash = computeScheduleDefinitionHash(workflow.serializedStepGraph);
    if (!localHash || localHash === expected) return true;

    const { workflowId, runId } = data as { workflowId: string; runId: string };
    this.mastra
      .getLogger()
      ?.error?.(
        'Refusing scheduled workflow fire: local definition does not match the schedule row. This instance is running a different build of the workflow.',
        { workflowId, runId, expectedDefinitionHash: expected, localDefinitionHash: localHash },
      );

    try {
      const schedulesStore = await this.mastra.getStorage()?.getStore('schedules');
      // The scheduler derives runId as `sched_<scheduleId>_<scheduledFireAt>`.
      const match = /^sched_(.+)_(\d+)$/.exec(runId);
      if (schedulesStore && match) {
        await schedulesStore.recordTrigger({
          scheduleId: match[1]!,
          runId,
          scheduledFireAt: Number(match[2]),
          actualFireAt: Date.now(),
          outcome: 'failed',
          error: `Stale workflow definition on consuming instance (expected ${expected}, local ${localHash})`,
          triggerKind: 'schedule-fire',
        });
      }
    } catch (err) {
      // History is diagnostic — never let it resurrect a refused fire.
      this.mastra.getLogger()?.warn?.('Failed to record stale-definition schedule trigger', { runId, error: err });
    }

    return false;
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
      executionGeneration: suppliedExecutionGeneration,
      lifecycleResumeAttempt = 0,
      lifecycleStepStates = {},
    }: Omit<ProcessorArgs, 'workflow'>,
    e: Error,
  ) {
    const executionGeneration = requireWorkflowExecutionGeneration(
      suppliedExecutionGeneration,
      `Evented workflow error ${workflowId}/${runId}`,
    );
    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.fail',
      runId,
      data: {
        executionGeneration,
        lifecycleResumeAttempt,
        lifecycleStepStates,
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
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const currentState = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: workflowId,
      runId,
    });

    if (!currentState) {
      this.mastra.getLogger()?.warn('Canceling workflow without loaded state', { workflowId, runId });
    }

    const executionGeneration = requireWorkflowExecutionGeneration(
      args.executionGeneration,
      `Evented workflow cancellation ${workflowId}/${runId}`,
    );
    const lifecycleStepStates = mergeWorkflowStepLifecycleStates(
      args.lifecycleStepStates,
      currentState?.executionGeneration === executionGeneration ? currentState.lifecycleStepStates : undefined,
    );
    const activeStepsPath = currentState?.activeStepsPath ?? args.activeStepsPath;
    // A cancel event may be processed by a different worker than the one
    // running the step. Close each active coordinate represented by the
    // persisted activeStepsPath when cancellation observes it. Admission vs.
    // cancel linearization and multiple concurrent foreach coordinates for one
    // step id require the storage-atomic PF-2013 contract; this legacy map
    // cannot prove either invariant. The executing worker may publish the same
    // semantic events after observing its abort, and deterministic IDs make
    // that at-least-once duplicate idempotent for consumers.
    const persistedLifecycleStepStates =
      currentState?.executionGeneration === executionGeneration
        ? (currentState.lifecycleStepStates ?? lifecycleStepStates)
        : lifecycleStepStates;
    const activeStepIdentities: Array<{ stepId: string; stepCallId: string; stepAttempt: number }> = [];
    for (const [activeStepId, executionPath] of Object.entries(activeStepsPath ?? {})) {
      const identity = resolvePersistedActiveStepLifecycleIdentity({
        workflow: args.workflow,
        workflowId,
        runId,
        executionGeneration,
        activeStepId,
        executionPath,
        lifecycleStepStates: persistedLifecycleStepStates,
        stepResult: currentState?.context?.[activeStepId],
      });
      if (!identity) continue;
      activeStepIdentities.push(identity);
    }

    //call end workflow with status of canceled to indicate the workflow was canceled
    await this.endWorkflow(
      {
        workflowId,
        runId,
        prevResult,
        ...args,
        executionGeneration,
        lifecycleStepStates,
      },
      'canceled',
      async () => {
        // Cancellation step events must follow terminal admission. A losing
        // cancellation must not close steps or publish any terminal effects.
        this.cancelRunAndChildren(runId);
        for (const identity of activeStepIdentities) {
          await publishWorkflowLifecycleEvent({
            pubsub: this.mastra.pubsub,
            workflowId,
            runId,
            executionGeneration,
            event: { type: 'step.canceled', ...identity },
          });
          await publishWorkflowLifecycleEvent({
            pubsub: this.mastra.pubsub,
            workflowId,
            runId,
            executionGeneration,
            event: { type: 'step.finished', ...identity, status: 'canceled' },
          });
        }
      },
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
    resumeLabel,
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
    initializeSnapshot,
    resourceId: requestedResourceId,
    executionGeneration: suppliedExecutionGeneration,
    lifecycleResumeAttempt = 0,
    lifecycleStepStates = {},
    lifecycleStartKind = 'start',
  }: ProcessorArgs & { initialState?: Record<string, any> }) {
    const executionGeneration = requireWorkflowExecutionGeneration(
      suppliedExecutionGeneration,
      `Evented workflow start ${workflowId}/${runId}`,
    );
    // Use initialState from event data if provided, otherwise use state from ProcessorArgs
    const initialState = (arguments[0] as any).initialState ?? state ?? {};
    const resolvedFormat = format ?? this.runFormats.get(runId);
    // Preserve resourceId from existing snapshot if present
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const terminalRecoveryEnabled = workflowsStore?.getWorkflowTerminalizationCapabilities().recoveryVersion === 1;
    const existingRun = await workflowsStore?.getWorkflowRunById({ runId, workflowName: workflow.id });
    const retainedRunSnapshot = existingRun
      ? typeof existingRun.snapshot === 'string'
        ? (JSON.parse(existingRun.snapshot) as WorkflowRunState)
        : existingRun.snapshot
      : undefined;
    const serializedStepGraph = retainedRunSnapshot?.serializedStepGraph ?? workflow.serializedStepGraph;
    if (
      terminalRecoveryEnabled &&
      retainedRunSnapshot &&
      createWorkflowTerminalGraphFingerprint(serializedStepGraph) !==
        createWorkflowTerminalGraphFingerprint(workflow.serializedStepGraph)
    ) {
      throw new MastraError({
        id: 'MASTRA_WORKFLOW_TERMINAL_RECOVERY_GRAPH_CONFLICT',
        text: 'Workflow graph does not match the retained recovery snapshot',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.SYSTEM,
      });
    }
    const resourceId = existingRun?.resourceId ?? requestedResourceId;

    // Check shouldPersistSnapshot option - default to true if not specified.
    // On resume, a false result must not overwrite a retained suspended snapshot.
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: 'running',
      }) ?? true;
    const shouldInitializeSnapshot = shouldPersist || initializeSnapshot === true;
    const initialWorkflowSnapshot: WorkflowRunState | undefined = shouldInitializeSnapshot
      ? {
          activePaths: [],
          suspendedPaths: {},
          resumeLabels: {},
          waitingPaths: {},
          activeStepsPath: {},
          serializedStepGraph,
          timestamp: Date.now(),
          runId,
          executionGeneration,
          lifecycleResumeAttempt,
          lifecycleStepStates,
          context: {
            ...(stepResults ?? {
              input: prevResult?.status === 'success' ? prevResult.output : undefined,
            }),
            __state: initialState,
          },
          status: shouldPersist ? 'running' : 'pending',
          value: initialState,
        }
      : undefined;
    const initialWorkflowSnapshotToPersist = initialWorkflowSnapshot
      ? {
          ...(workflow?.options?.pruneSnapshot
            ? workflow.options.pruneSnapshot({
                snapshot: initialWorkflowSnapshot,
                workflowStatus: initialWorkflowSnapshot.status,
              })
            : initialWorkflowSnapshot),
          executionGeneration,
          lifecycleResumeAttempt,
          lifecycleStepStates,
        }
      : undefined;
    const retainedChildEvidence =
      parentWorkflow && terminalRecoveryEnabled && !shouldInitializeSnapshot && workflowsStore
        ? await Promise.all([
            workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId }),
            workflowsStore.getWorkflowTerminalization({ workflowName: workflow.id, runId }),
            workflowsStore.getWorkflowTerminalRecoveryAncestry({ workflowName: workflow.id, runId }),
          ])
        : undefined;
    const persistedChildSnapshot = retainedChildEvidence?.[0];
    const retainedChildTerminalization = retainedChildEvidence?.[1];
    const retainedChildRecovery = retainedChildEvidence?.[2];
    // Storage capability alone must not opt transient workflows into persistence.
    // A nested run participates in recovery only when this transition is durable
    // or an earlier durable snapshot proves that this is a replay/resume.
    const terminalRecoveryActive =
      terminalRecoveryEnabled &&
      (shouldInitializeSnapshot ||
        (persistedChildSnapshot !== null && persistedChildSnapshot !== undefined) ||
        retainedChildTerminalization?.status === 'found' ||
        retainedChildRecovery?.status === 'found');
    // Missing means an older/internal producer did not declare the boundary, so
    // remain fail-closed. A declared transient parent and transient child can run
    // entirely in-process even when the configured store supports recovery.
    const parentRequiresDurableEvidence =
      parentWorkflow !== undefined &&
      (parentWorkflow.shouldPersistSnapshot !== false || shouldInitializeSnapshot || terminalRecoveryActive);

    let parentSnapshot: WorkflowRunState | null | undefined;
    let parentTerminalStatus: GetWorkflowRunTerminalStatusResult | undefined;
    let parentForEachIndex: number | undefined;
    let recoveryAncestry: WorkflowTerminalRecoveryAncestryV1 | undefined;
    let childSnapshotEnsuredByAdmission = false;
    if (
      parentWorkflow &&
      workflowsStore &&
      (shouldInitializeSnapshot || terminalRecoveryActive || parentRequiresDurableEvidence)
    ) {
      [parentSnapshot, parentTerminalStatus] = await Promise.all([
        workflowsStore.loadWorkflowSnapshot({
          workflowName: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
        }),
        terminalRecoveryEnabled
          ? workflowsStore.getWorkflowRunTerminalStatus({
              workflowName: parentWorkflow.workflowId,
              runId: parentWorkflow.runId,
            })
          : Promise.resolve(undefined),
      ]);
      if (parentTerminalStatus?.status === 'terminal') return;
      if (terminalRecoveryEnabled && parentTerminalStatus?.status === 'unsupported') {
        throw new MastraError({
          id: 'MASTRA_WORKFLOW_TERMINAL_RECOVERY_ADMISSION_UNAVAILABLE',
          text: 'Workflow storage does not expose durable parent terminal status',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        });
      }
      if (parentSnapshot) {
        if (WorkflowEventProcessor.TERMINAL_CHILD_RUN_STATUSES.has(parentSnapshot.status)) return;
        const parentEntry = parentWorkflow.stepGraph[parentWorkflow.executionPath[0]!];
        parentForEachIndex =
          parentEntry?.type === 'foreach' ? (forEachIndex ?? parentWorkflow.executionPath[1]) : undefined;
        const source =
          parentForEachIndex === undefined
            ? {
                kind: 'step' as const,
                stepId: parentWorkflow.stepId,
                executionPath: parentWorkflow.executionPath,
              }
            : {
                kind: 'foreach-iteration' as const,
                stepId: parentWorkflow.stepId,
                containerPath: [parentWorkflow.executionPath[0]!],
                iterationIndex: parentForEachIndex,
              };
        if (terminalRecoveryActive) {
          const retained =
            retainedChildRecovery ??
            (await workflowsStore.getWorkflowTerminalRecoveryAncestry({
              workflowName: workflow.id,
              runId,
            }));
          recoveryAncestry =
            retained.status === 'found'
              ? retained.record.ancestry
              : materializeWorkflowTerminalRecoveryAncestry([
                  {
                    version: 1,
                    childWorkflowName: workflow.id,
                    childRunId: runId,
                    parentWorkflowName: parentWorkflow.workflowId,
                    parentRunId: parentWorkflow.runId,
                    parentGraphFingerprint: createWorkflowTerminalGraphFingerprint(parentSnapshot.serializedStepGraph),
                    source,
                    inputPointer: { kind: 'parent-source-payload', stepId: parentWorkflow.stepId },
                    resultPointer: { kind: 'retained-terminal-result', workflowName: workflow.id, runId },
                    resumeMetadata: {
                      wasResume: parentWorkflow.resume === true,
                      resumeSteps: parentWorkflow.resumeSteps ?? [],
                    },
                  },
                  ...(parentWorkflow.recoveryAncestry ?? []),
                ]);
          parentWorkflow.recoveryAncestry = recoveryAncestry;
        }
      } else if (terminalRecoveryEnabled && parentRequiresDurableEvidence) {
        throw new MastraError({
          id: 'MASTRA_WORKFLOW_TERMINAL_RECOVERY_PARENT_MISSING',
          text: 'Nested workflow recovery parent evidence is missing',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        });
      }
    }

    if (parentWorkflow && parentSnapshot && workflowsStore && (shouldInitializeSnapshot || terminalRecoveryActive)) {
      const existing = parentSnapshot.context?.[workflowId] as any;
      const existingMetadata = existing?.metadata ?? {};
      const existingWorkflowMetadata = existingMetadata.__workflow_meta ?? {};
      const nestedRunMetadata =
        parentForEachIndex === undefined
          ? { ...existingMetadata, nestedRunId: runId }
          : {
              ...existingMetadata,
              __workflow_meta: {
                ...existingWorkflowMetadata,
                [WORKFLOW_TERMINAL_FOREACH_RUN_KEY]: {
                  ...(existingWorkflowMetadata[WORKFLOW_TERMINAL_FOREACH_RUN_KEY] ?? {}),
                  [String(parentForEachIndex)]: runId,
                },
              },
            };
      const parentResult = {
        startedAt: existing?.startedAt ?? Date.now(),
        status: 'running' as const,
        payload: existing?.payload ?? parentWorkflow.input?.output ?? {},
        ...(existing ?? {}), // preserve anything else (suspendPayload, etc.)
      };
      if (terminalRecoveryActive) {
        if (!recoveryAncestry) {
          throw new MastraError({
            id: 'MASTRA_WORKFLOW_TERMINAL_RECOVERY_ANCESTRY_UNAVAILABLE',
            text: 'Nested workflow recovery ancestry could not be retained',
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          });
        }
        const admission = await workflowsStore.admitWorkflowNestedRun({
          workflowName: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          stepId: parentWorkflow.stepId,
          nestedWorkflowName: workflow.id,
          nestedRunId: runId,
          expectedChildGraphFingerprint: createWorkflowTerminalGraphFingerprint(serializedStepGraph),
          forEachIndex: parentForEachIndex,
          result: parentResult,
          requestContext: getPersistedRequestContext(requestContext),
          recoveryAncestry,
          ...(initialWorkflowSnapshotToPersist
            ? {
                initialChildSnapshot: {
                  snapshot: initialWorkflowSnapshotToPersist,
                  ...(resourceId === undefined ? {} : { resourceId }),
                },
              }
            : {}),
        });
        if (admission.status === 'parent_terminal' || admission.status === 'child_terminal') return;
        if (admission.status !== 'admitted' && admission.status !== 'already_admitted') {
          throw new MastraError({
            id:
              admission.status === 'ownership_conflict'
                ? 'MASTRA_WORKFLOW_NESTED_RUN_OWNERSHIP_CONFLICT'
                : admission.status === 'ancestry_conflict'
                  ? 'MASTRA_WORKFLOW_TERMINAL_RECOVERY_ANCESTRY_CONFLICT'
                  : admission.status === 'child_snapshot_conflict'
                    ? 'MASTRA_WORKFLOW_NESTED_RUN_CHILD_SNAPSHOT_CONFLICT'
                    : admission.status === 'parent_snapshot_conflict'
                      ? 'MASTRA_WORKFLOW_NESTED_RUN_PARENT_SNAPSHOT_CONFLICT'
                      : 'MASTRA_WORKFLOW_TERMINAL_RECOVERY_ADMISSION_UNAVAILABLE',
            text: 'Nested workflow recovery admission could not be retained',
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          });
        }
        if (initialWorkflowSnapshotToPersist) {
          if (admission.childSnapshotState === 'not_requested') {
            throw new MastraError({
              id: 'MASTRA_WORKFLOW_NESTED_RUN_INITIALIZATION_UNAVAILABLE',
              text: 'Nested workflow initial snapshot was not retained with durable admission',
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            });
          }
          childSnapshotEnsuredByAdmission = true;
        }
        if (admission.status === 'already_admitted') {
          const [retainedChild, childTerminalization] = await Promise.all([
            workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId }),
            retainedChildTerminalization ??
              workflowsStore.getWorkflowTerminalization({ workflowName: workflow.id, runId }),
          ]);
          if (
            (retainedChild && WorkflowEventProcessor.TERMINAL_CHILD_RUN_STATUSES.has(retainedChild.status)) ||
            childTerminalization.status === 'found'
          ) {
            return;
          }
          if (!retainedChild) {
            throw new MastraError({
              id: 'MASTRA_WORKFLOW_NESTED_RUN_RETAINED_SNAPSHOT_MISSING',
              text: 'Nested workflow retained recovery ancestry has no durable child snapshot',
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            });
          }
        }
      } else {
        const ownership = await workflowsStore.bindWorkflowNestedRunOwnership({
          workflowName: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          stepId: parentWorkflow.stepId,
          nestedRunId: runId,
          forEachIndex: parentForEachIndex,
          result: parentResult,
          requestContext: getPersistedRequestContext(requestContext),
        });
        if (ownership.status === 'unsupported') {
          await workflowsStore.updateWorkflowResults({
            workflowName: parentWorkflow.workflowId,
            runId: parentWorkflow.runId,
            stepId: parentWorkflow.stepId,
            result: { ...parentResult, metadata: nestedRunMetadata },
            requestContext: getPersistedRequestContext(requestContext),
            executionGeneration: parentWorkflow.executionGeneration,
          });
        } else if (ownership.status !== 'bound' && ownership.status !== 'already_bound') {
          throw new MastraError({
            id: 'MASTRA_WORKFLOW_NESTED_RUN_OWNERSHIP_CONFLICT',
            text: 'Nested workflow run ownership conflicts with retained evidence',
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          });
        }
      }
    }

    if (
      parentWorkflow &&
      workflowsStore &&
      terminalRecoveryEnabled &&
      !terminalRecoveryActive &&
      parentRequiresDurableEvidence
    ) {
      const currentParentTerminalStatus = await workflowsStore.getWorkflowRunTerminalStatus({
        workflowName: parentWorkflow.workflowId,
        runId: parentWorkflow.runId,
      });
      if (currentParentTerminalStatus.status === 'terminal') return;
      if (currentParentTerminalStatus.status !== 'nonterminal') {
        throw new MastraError({
          id:
            currentParentTerminalStatus.status === 'missing_run'
              ? 'MASTRA_WORKFLOW_TERMINAL_RECOVERY_PARENT_MISSING'
              : 'MASTRA_WORKFLOW_TERMINAL_RECOVERY_ADMISSION_UNAVAILABLE',
          text: 'Nested workflow recovery parent evidence is unavailable',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        });
      }
    }

    const guardedResume =
      lifecycleStartKind === 'resume' && !parentWorkflow && workflowsStore?.supportsConcurrentUpdates();
    if (guardedResume && workflowsStore) {
      // The publisher already claimed this suspension. Recheck that exact claim
      // after parent admission and never replace its snapshot with an unguarded
      // running payload: cancellation may have committed while dispatch waited.
      const currentClaim = await workflowsStore.updateWorkflowState({
        workflowName: workflow.id,
        runId,
        opts: {
          status: 'running',
          expectedStatus: 'running',
          expectedExecutionGeneration: executionGeneration,
          expectedLifecycleResumeAttempt: lifecycleResumeAttempt,
          ...(shouldInitializeSnapshot
            ? {
                activePaths: [],
                suspendedPaths: {},
                resumeLabels: {},
                waitingPaths: {},
                activeStepsPath: {},
                lifecycleStepStates,
              }
            : {}),
        },
      });
      if (!currentClaim) return;
    }

    // The run is now admitted (or readmitted through time travel/restart), so
    // cancel any terminal-topic cleanup before the first new watch event is
    // published. Delaying this until after durable parent admission keeps a
    // rejected stale child start from leaving cleanup state behind.
    this.cancelRunTopicCleanup(workflowId, runId, executionGeneration);

    // Announce the run only after durable nested admission succeeds. A stale
    // child start rejected by a terminal parent must remain invisible to
    // stream/watch consumers because no child execution will follow it.
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

    await publishWorkflowLifecycleEvent({
      pubsub: this.mastra.pubsub,
      workflowId,
      runId,
      executionGeneration,
      event:
        lifecycleStartKind === 'resume'
          ? { type: 'workflow.resumed', resumeAttempt: lifecycleResumeAttempt, resumeData }
          : {
              type: 'workflow.started',
              resumeAttempt: lifecycleResumeAttempt,
              input: prevResult?.status === 'success' ? prevResult.output : undefined,
            },
    });

    if (shouldInitializeSnapshot && workflowsStore && !childSnapshotEnsuredByAdmission && !guardedResume) {
      await workflowsStore.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        resourceId,
        snapshot: initialWorkflowSnapshotToPersist!,
      });
    }

    // Create process-local execution state only after durable parent admission
    // succeeds, so a rejected child cannot leave abort or relationship debris.
    this.runFormats.set(runId, resolvedFormat);
    this.getOrCreateAbortController(runId);
    if (parentWorkflow?.runId) {
      this.parentChildRelationships.set(runId, parentWorkflow.runId);
    }

    const startExecutionPath = executionPath ?? [0];
    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.step.run',
      runId,
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionGeneration,
        lifecycleResumeAttempt,
        lifecycleStepStates,
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
        resumeLabel,
        activeStepsPath: {},
        perStep,
        state: initialState,
        outputOptions,
        forEachIndex,
      },
    });
  }

  protected async endWorkflow(
    args: ProcessorArgs,
    status: 'success' | 'failed' | 'canceled' | 'paused' = 'success',
    afterTerminalAdmission?: () => Promise<void>,
  ) {
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
      state,
      executionGeneration: suppliedExecutionGeneration,
      lifecycleResumeAttempt = 0,
    } = args;
    const executionGeneration = requireWorkflowExecutionGeneration(
      suppliedExecutionGeneration,
      `Evented workflow finish ${workflowId}/${runId}`,
    );
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const normalizedPrevResult = prevResult ?? ({ status } as StepResult<any, any, any, any>);

    // Check shouldPersistSnapshot option - default to true if not specified
    const finalStatus = perStep && status === 'success' ? 'paused' : status;
    const authoritativeState = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: workflowId,
      runId,
    });
    if (
      authoritativeState &&
      ((authoritativeState.executionGeneration !== undefined &&
        authoritativeState.executionGeneration !== executionGeneration) ||
        WorkflowEventProcessor.TERMINAL_CHILD_RUN_STATUSES.has(authoritativeState.status))
    ) {
      // A different generation or an already-terminal transition owns this
      // run now. Do not let a delayed step/end delivery replace that outcome
      // or publish a contradictory lifecycle terminal. The guarded update
      // below also rejects transitions that race this observation.
      this.mastra.getLogger()?.debug?.('Evented workflow finish lost durable terminal ownership', {
        workflowId,
        runId,
        requestedStatus: finalStatus,
        currentStatus: authoritativeState.status,
        currentExecutionGeneration: authoritativeState.executionGeneration,
        incomingExecutionGeneration: executionGeneration,
      });
      return;
    }
    const finalState = resolveCurrentState({ stepResults, state });
    const exactFinalStateEnabled = workflowsStore?.getWorkflowTerminalizationCapabilities().recoveryVersion === 1;
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: finalStatus,
      }) ?? true;

    let terminalAdmission = true;
    const concurrentCas = workflowsStore?.supportsConcurrentUpdates() ?? false;

    if (shouldPersist && workflowsStore) {
      const updated = await workflowsStore.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: finalStatus,
          executionGeneration,
          lifecycleResumeAttempt,
          lifecycleStepStates: args.lifecycleStepStates,
          result: normalizedPrevResult,
          ...(finalStatus === 'paused' || !exactFinalStateEnabled ? {} : { finalState }),
          activePaths: executionPath,
          activeStepsPath: activeStepsPath,
          ...(concurrentCas
            ? {
                expectedStatus: [...Array.from(WorkflowEventProcessor.TERMINALIZABLE_RUN_STATUSES), 'paused'],
                expectedExecutionGeneration: executionGeneration,
                expectedLifecycleResumeAttempt: lifecycleResumeAttempt,
              }
            : {}),
        },
      });
      terminalAdmission = !concurrentCas || updated !== undefined;
    } else if (!shouldPersist && finalStatus !== 'paused') {
      // The run reached a terminal state its workflow opted not to persist
      // (e.g. the durable agentic loop, the internal `executionWorkflow`
      // inside `agentic-loop`, or the notification dispatcher). A row may
      // still exist from an earlier phase — 'pending' at nested-run start,
      // 'suspended' before a resume, or the 'running' record every run writes
      // at start — and without the terminal update it would leak forever as a
      // stale record byte-identical to a genuinely orphaned run, polluting
      // `listActiveRuns()` / `recoverActiveRuns()` (issue #22209). Terminal
      // runs can't be resumed, so drop the row entirely. Best-effort: a storage
      // failure here must not abort run completion.
      try {
        await workflowsStore?.deleteWorkflowRunById({ runId, workflowName: workflowId });
      } catch (e) {
        this.mastra.getLogger()?.warn('Failed to clean up workflow snapshot', { workflowId, runId, error: e });
      }
      // Storage has no atomic compare-and-delete contract. This branch keeps
      // the historical opt-out cleanup behavior; concurrent ownership cannot
      // be claimed from the delete result.
      terminalAdmission = true;
    }

    if (!terminalAdmission) {
      this.mastra.getLogger()?.debug?.('Evented workflow terminal admission lost', {
        workflowId,
        runId,
        requestedStatus: finalStatus,
        executionGeneration,
      });
      return;
    }

    await afterTerminalAdmission?.();

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
          // `workflowStatus` is the RUN's status. For a perStep pause the last
          // step result is 'success' but the workflow itself is 'paused' — the
          // stream terminal (RunOutput#normalizeTerminal adopts this status as
          // the canonical terminal) must report the pause, not the step.
          workflowStatus: finalStatus === 'paused' ? 'paused' : normalizedPrevResult.status,
          ...(finalStatus !== 'paused' && normalizedPrevResult.status === 'success'
            ? { finalWorkflowResult: normalizedPrevResult.output }
            : {}),
        },
      },
    });

    if (finalStatus !== 'paused') {
      const terminalError = (normalizedPrevResult as { error?: unknown }).error;
      if (finalStatus === 'canceled') {
        await publishWorkflowLifecycleEvent({
          pubsub: this.mastra.pubsub,
          workflowId,
          runId,
          executionGeneration,
          event: { type: 'workflow.canceled', resumeAttempt: lifecycleResumeAttempt },
        });
      } else if (finalStatus === 'failed') {
        await publishWorkflowLifecycleEvent({
          pubsub: this.mastra.pubsub,
          workflowId,
          runId,
          executionGeneration,
          event: { type: 'workflow.failed', resumeAttempt: lifecycleResumeAttempt, error: terminalError },
        });
      }
      await publishWorkflowLifecycleEvent({
        pubsub: this.mastra.pubsub,
        workflowId,
        runId,
        executionGeneration,
        event: {
          type: 'workflow.finished',
          resumeAttempt: lifecycleResumeAttempt,
          status: finalStatus,
          result: finalStatus === 'success' ? (normalizedPrevResult as { output?: unknown }).output : undefined,
          error: terminalError,
        },
      });
    }

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

    // A successful per-step run publishes `workflow.end` while merely paused
    // and will keep writing to its watch topic when the next step executes.
    // Cancellation (and any defensive failed status reaching this path) is
    // terminal even when `perStep` is true, so it still needs cleanup.
    const isPausedPerStepEnd = perStep && (prevResult?.status === 'success' || prevResult?.status === 'paused');
    if (!isPausedPerStepEnd) {
      this.scheduleRunTopicCleanup(
        workflowId,
        runId,
        requireWorkflowExecutionGeneration(args.executionGeneration, `Evented workflow cleanup ${workflowId}/${runId}`),
      );
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
            ...parentWorkflowLifecycleExecution(parentWorkflow),
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
            mastra: this.mastra,
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
            ...parentWorkflowLifecycleExecution(parentWorkflow),
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
    if (
      args.internalWorkflowRegistrationGeneration !== undefined &&
      this.mastra.__hasInternalWorkflow(args.workflowId, runId)
    ) {
      this.mastra.__unregisterInternalWorkflow(args.workflowId, runId, args.internalWorkflowRegistrationGeneration);
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
      const suspendedStepId = workflow && executionPath ? (getStepId(workflow, executionPath) ?? undefined) : undefined;
      const propagatedPath =
        suspendedStepId && existingPath[0] !== suspendedStepId ? [suspendedStepId, ...existingPath] : existingPath;

      const nestedResumeLabels = prevResult.suspendPayload?.__workflow_meta?.resumeLabels ?? {};
      let resumeLabels;
      try {
        resumeLabels = mergeEventedResumeLabels(undefined, nestedResumeLabels, target => ({
          stepId: parentWorkflow.stepId,
          ...(target.foreachIndex !== undefined ? { foreachIndex: target.foreachIndex } : {}),
        }));
      } catch (error) {
        return this.errorWorkflow(args, getErrorFromUnknown(error));
      }

      const nestedMeta = prevResult.suspendPayload?.__workflow_meta ?? {};
      const { foreachOutput: nestedForeachOutput, ...nestedMetaWithoutForeachOutput } = nestedMeta;
      const propagatedForeachOutput = stripEventedForeachStreamStateForPropagation(nestedForeachOutput);

      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId: parentWorkflow.runId, // Use parent's runId for event routing
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          ...parentWorkflowLifecycleExecution(parentWorkflow),
          executionPath: parentWorkflow.executionPath,
          resumeSteps,
          stepResults: parentWorkflow.stepResults,
          prevResult: {
            ...prevResult,
            suspendPayload: {
              ...prevResult.suspendPayload,
              __workflow_meta: {
                // keep resumeLabels / foreachIndex etc. — only the runId and path change as we propagate up
                ...nestedMetaWithoutForeachOutput,
                ...(propagatedForeachOutput ? { foreachOutput: propagatedForeachOutput } : {}),
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

    const suspendedStepId = workflow && executionPath ? (getStepId(workflow, executionPath) ?? undefined) : undefined;
    const suspendedStepIds = args.suspendedStepIds ?? (suspendedStepId ? [suspendedStepId] : []);
    await publishWorkflowLifecycleEvent({
      pubsub: this.mastra.pubsub,
      workflowId: args.workflowId,
      runId,
      executionGeneration: requireWorkflowExecutionGeneration(
        args.executionGeneration,
        `Evented workflow suspend ${args.workflowId}/${runId}`,
      ),
      event: {
        type: 'workflow.suspended',
        resumeAttempt: args.lifecycleResumeAttempt ?? 0,
        suspendedStepIds,
      },
    });

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.suspend',
      runId,
      data: { ...args, workflow: undefined, state: finalState },
    });

    // Suspension is non-terminal. Keep run-scoped ownership registered so
    // workflow events remain local to this Mastra instance until a resumed run
    // reaches success or failure (cross-process workflow ownership, PF-1723).
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

    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const exactFinalStateEnabled = workflowsStore?.getWorkflowTerminalizationCapabilities().recoveryVersion === 1;
    const executionGeneration = requireWorkflowExecutionGeneration(
      args.executionGeneration,
      `Evented workflow failure ${workflowId}/${runId}`,
    );

    // Check shouldPersistSnapshot option - default to true if not specified
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: 'failed',
      }) ?? true;

    let terminalAdmission = true;
    const concurrentCas = workflowsStore?.supportsConcurrentUpdates() ?? false;
    if (shouldPersist && workflowsStore) {
      const updated = await workflowsStore.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: 'failed',
          error: (prevResult as any).error,
          ...(exactFinalStateEnabled ? { finalState } : {}),
          activePaths: executionPath,
          activeStepsPath: activeStepsPath,
          ...(concurrentCas
            ? {
                expectedStatus: [...Array.from(WorkflowEventProcessor.TERMINALIZABLE_RUN_STATUSES), 'paused'],
                expectedExecutionGeneration: executionGeneration,
                expectedLifecycleResumeAttempt: args.lifecycleResumeAttempt ?? 0,
              }
            : {}),
        },
      });
      terminalAdmission = !concurrentCas || updated !== undefined;
    } else if (!shouldPersist) {
      // Mirrors endWorkflow: a run whose workflow opted out of persisting the
      // terminal 'failed' status would otherwise leak its earlier-phase
      // ('running'/'pending'/'suspended') snapshot row forever (issue #22209).
      // Best-effort: a storage failure here must not abort run completion.
      try {
        await workflowsStore?.deleteWorkflowRunById({ runId, workflowName: workflowId });
      } catch (e) {
        this.mastra.getLogger()?.warn('Failed to clean up workflow snapshot', { workflowId, runId, error: e });
      }
      // There is no atomic compare-and-delete contract. Preserve this legacy
      // opt-out cleanup branch without claiming concurrent ownership.
      terminalAdmission = true;
    }

    if (!terminalAdmission) {
      this.mastra.getLogger()?.debug?.('Evented workflow failure lost durable terminal admission', {
        workflowId,
        runId,
        executionGeneration,
      });
      return;
    }

    // Terminal ownership is admitted before cleanup or publication.
    this.cleanupRun(runId);

    // 'failed' is terminal: the run stops writing to its watch topic. Arm
    // cleanup only after the terminal snapshot update (or nested-row delete)
    // completes, so a short test delay or slow store can't make the timer read
    // the previous active status and incorrectly skip deletion.
    this.scheduleRunTopicCleanup(workflowId, runId, executionGeneration);

    // handle nested workflow
    if (parentWorkflow) {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId: parentWorkflow.runId, // Use parent's runId for event routing
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          ...parentWorkflowLifecycleExecution(parentWorkflow),
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

    const workflowError = (prevResult as { error?: unknown }).error;
    await publishWorkflowLifecycleEvent({
      pubsub: this.mastra.pubsub,
      workflowId,
      runId,
      executionGeneration,
      event: { type: 'workflow.failed', resumeAttempt: args.lifecycleResumeAttempt ?? 0, error: workflowError },
    });
    await publishWorkflowLifecycleEvent({
      pubsub: this.mastra.pubsub,
      workflowId,
      runId,
      executionGeneration,
      event: {
        type: 'workflow.finished',
        resumeAttempt: args.lifecycleResumeAttempt ?? 0,
        status: 'failed',
        error: workflowError,
      },
    });

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.fail',
      runId,
      data: { ...args, workflow: undefined, state: finalState },
    });

    // Clean up run-scoped internal workflow registrations (e.g. execution-workflow)
    // now that all events for this run have been processed.
    if (
      args.internalWorkflowRegistrationGeneration !== undefined &&
      this.mastra.__hasInternalWorkflow(args.workflowId, runId)
    ) {
      this.mastra.__unregisterInternalWorkflow(args.workflowId, runId, args.internalWorkflowRegistrationGeneration);
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
      resumeLabel,
      parentWorkflow,
      requestContext,
      perStep,
      state,
      outputOptions,
      forEachIndex,
      executionGeneration: suppliedExecutionGeneration,
      lifecycleResumeAttempt = 0,
      lifecycleStepStates = {},
    } = args;
    const executionGeneration = requireWorkflowExecutionGeneration(
      suppliedExecutionGeneration,
      `Evented workflow step ${workflowId}/${runId}`,
    );
    const lifecycleExecution = { executionGeneration, lifecycleResumeAttempt, lifecycleStepStates };
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    // Get current state from stepResults.__state or from passed state
    const currentState = resolveCurrentState({ stepResults, state });
    const stepGraph: StepFlowEntry[] = workflow.stepGraph;

    if (!executionPath?.length) {
      return this.errorWorkflow(
        {
          ...lifecycleExecution,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeStepsPath,
          resumeSteps,
          prevResult,
          resumeData,
          resumeLabel,
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
          ...lifecycleExecution,
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
          ...lifecycleExecution,
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
          ...lifecycleExecution,
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
          workflowsStore,
          step,
        },
      );
    } else if (step?.type === 'conditional') {
      return processWorkflowConditional(
        {
          ...lifecycleExecution,
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
          workflowsStore,
          stepExecutor: this.stepExecutor,
          step,
        },
      );
    } else if (step?.type === 'sleep') {
      return processWorkflowSleep(
        {
          ...lifecycleExecution,
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
          ...lifecycleExecution,
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
          ...lifecycleExecution,
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
          resumeLabel,
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

    // Control structures (sleep / sleepUntil / parallel / conditional) already
    // returned above; what remains is a leaf: a plain `step`, a declarative
    // `agent` / `tool` / `mapping` entry, or a `loop` / `foreach` body.
    return this.runLeafStep({
      ...args,
      step: step as Extract<StepFlowEntry, { type: 'step' | 'agent' | 'tool' | 'mapping' | 'loop' | 'foreach' }>,
    });
  }

  /**
   * Shared leaf-step runner. Executes a single leaf entry - a plain `step`, a
   * declarative `agent` / `tool` / `mapping` entry, or a `loop` / `foreach`
   * body - and emits its lifecycle events (`workflow.step.end`, retries,
   * suspend, cancel). The per-kind interpretation happens in the step
   * executor's dispatch; here entries are only inspected via the `step-entry`
   * accessors.
   */
  protected async runLeafStep(
    args: ProcessorArgs & {
      step: Extract<StepFlowEntry, { type: 'step' | 'agent' | 'tool' | 'mapping' | 'loop' | 'foreach' }>;
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
      resumeLabel,
      parentWorkflow,
      retryCount = 0,
      perStep,
      state,
      outputOptions,
      forEachIndex,
      executionGeneration: suppliedExecutionGeneration,
      lifecycleResumeAttempt = 0,
      lifecycleStepStates = {},
      lifecycleStepAttemptReserved = false,
      lifecycleIncomingStepStates,
      lifecycleAttemptBaselineCaptured = false,
      step,
    } = args;
    let requestContext = args.requestContext;
    const executionGeneration = requireWorkflowExecutionGeneration(
      suppliedExecutionGeneration,
      `Evented workflow step ${workflowId}/${runId}`,
    );
    const lifecycleExecution = { executionGeneration, lifecycleResumeAttempt, lifecycleStepStates };
    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');
    const streamFormat = this.runFormats.get(runId);
    const currentState = resolveCurrentState({ stepResults, state });
    const stepGraph: StepFlowEntry[] = workflow.stepGraph;
    // The leaf entry this run executes: top-level entries are already
    // SingleStepEntry-shaped; `loop` / `foreach` carry their body in `step.step`.
    // It stays a declarative entry - the step executor interprets it per kind.
    const leaf: SingleStepEntry = step.type === 'loop' || step.type === 'foreach' ? step.step : step;
    const leafId = getEntryId(leaf);

    if (!isExecutableStep(step)) {
      return this.errorWorkflow(
        {
          ...lifecycleExecution,
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

    activeStepsPath[leafId] = executionPath;

    const { key: lifecycleStepKey, state: lifecycleStepState } = getOrCreateWorkflowStepLifecycleState({
      workflowId,
      runId,
      executionGeneration,
      stepId: leafId,
      executionPath,
      foreachIndex: step.type === 'foreach' ? executionPath[1] : forEachIndex,
      iterationCount:
        step.type === 'loop'
          ? (stepResults[leafId]?.metadata?.iterationCount ?? 0)
          : stepResults[leafId]?.metadata?.iterationCount,
      states: lifecycleStepStates,
    });
    // Every producer carries the attempt baseline that existed before this
    // semantic step dispatch. The first delivery advances N -> N+1. A broker
    // redelivery sees durable N+1 while still carrying N, so it reuses the
    // same lifecycle identity even when the transport exposes no delivery
    // ordinal. Explicit retry/resume producers carry the current N+1 baseline
    // and therefore reserve the next semantic attempt normally.
    const incomingStepAttempt = lifecycleAttemptBaselineCaptured
      ? (lifecycleIncomingStepStates?.[lifecycleStepKey]?.stepAttempt ?? 0)
      : undefined;
    const retainedRedeliveryAttempt =
      incomingStepAttempt !== undefined && lifecycleStepState.stepAttempt > incomingStepAttempt;
    if (lifecycleStepAttemptReserved) {
      if (lifecycleStepState.stepAttempt < 1) {
        throw new Error(`Workflow lifecycle attempt for ${leafId} was marked reserved without an ordinal`);
      }
    } else if (!retainedRedeliveryAttempt) {
      lifecycleStepState.stepAttempt += 1;
    }

    // Make the executing coordinate visible before entering user code. A
    // cancellation handled by another worker can then close the same durable
    // step attempt instead of finishing only the workflow. Persist even when
    // this delivery reuses a previously reserved attempt: the broker payload's
    // active path is not itself authoritative durable state.
    await workflowsStore?.updateWorkflowState({
      workflowName: workflowId,
      runId,
      opts: {
        executionGeneration,
        lifecycleResumeAttempt,
        lifecycleStepStates,
        activeStepsPath,
      },
    });

    const isResumedStep = resumeSteps?.[0] === leafId && stepResults[leafId]?.status === 'suspended';
    await publishWorkflowLifecycleEvent({
      pubsub: this.mastra.pubsub,
      workflowId,
      runId,
      executionGeneration,
      event:
        retryCount > 0
          ? {
              type: 'step.retrying',
              stepId: leafId,
              stepCallId: lifecycleStepState.stepCallId,
              stepAttempt: lifecycleStepState.stepAttempt,
            }
          : isResumedStep
            ? {
                type: 'step.resumed',
                stepId: leafId,
                stepCallId: lifecycleStepState.stepCallId,
                stepAttempt: lifecycleStepState.stepAttempt,
                resumeData,
              }
            : {
                type: 'step.started',
                stepId: leafId,
                stepCallId: lifecycleStepState.stepCallId,
                stepAttempt: lifecycleStepState.stepAttempt,
                input: prevResult?.status === 'success' ? prevResult.output : undefined,
              },
    });

    // Run nested workflow - only a plain `step` entry can wrap a live Workflow
    const nestedWorkflowStep = getEntryWorkflow(leaf);
    if (nestedWorkflowStep) {
      const storedStepResult = stepResults[leafId] as any;
      const stepData =
        step.type === 'foreach' && executionPath[1] !== undefined
          ? storedStepResult?.output?.[executionPath[1]]
          : storedStepResult;

      const ownershipStepResult = ownEnumerableDataValue(stepResults, leafId);
      const ownershipMetadataValue = ownEnumerableDataValue(ownershipStepResult, 'metadata');
      const ownershipMetadata =
        ownershipMetadataValue !== null && typeof ownershipMetadataValue === 'object'
          ? (ownershipMetadataValue as Record<string, any>)
          : undefined;
      const ownershipIndex = forEachIndex ?? executionPath[1];
      const ownedNestedRunId = resolveNestedWorkflowOwnedRunId({
        metadata: ownershipMetadata,
        isForEach: step.type === 'foreach',
        forEachIndex: ownershipIndex,
      });
      const loopIteration = step.type === 'loop' ? resolveNestedWorkflowLoopIteration(ownershipMetadata) : undefined;
      const nestedRunCoordinate = {
        parentWorkflowId: workflowId,
        parentRunId: runId,
        nestedWorkflowId: leafId,
        stepId: leafId,
        executionPath,
        ...(loopIteration === undefined ? {} : { loopIteration }),
      };
      const nestedWorkflow = nestedWorkflowStep;
      const parentShouldPersistSnapshot =
        workflow.options?.shouldPersistSnapshot?.({
          stepResults,
          workflowStatus: 'running',
        }) ?? true;
      // Handle resume with only nested workflow ID specified (auto-detect suspended inner step)
      if (resumeSteps?.length === 1 && resumeSteps[0] === leafId) {
        const nestedRunId = stepData?.suspendPayload?.__workflow_meta?.runId;
        if (!nestedRunId) {
          return this.errorWorkflow(
            {
              ...lifecycleExecution,
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
          workflowName: leafId,
          runId: nestedRunId,
        });

        let nestedResumeLabels;
        try {
          nestedResumeLabels = normalizeEventedResumeLabels(snapshot?.resumeLabels ?? {});
        } catch (error) {
          return this.errorWorkflow(
            {
              ...lifecycleExecution,
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
            getErrorFromUnknown(error),
          );
        }
        const hasNestedResumeLabel =
          resumeLabel !== undefined && Object.prototype.hasOwnProperty.call(nestedResumeLabels, resumeLabel);
        const nestedResumeLabel = hasNestedResumeLabel ? nestedResumeLabels[resumeLabel!] : undefined;
        const isValidNestedResumeLabel =
          nestedResumeLabel !== null &&
          typeof nestedResumeLabel === 'object' &&
          typeof nestedResumeLabel.stepId === 'string' &&
          nestedResumeLabel.stepId.length > 0 &&
          (nestedResumeLabel.foreachIndex === undefined ||
            (Number.isInteger(nestedResumeLabel.foreachIndex) && nestedResumeLabel.foreachIndex >= 0));

        // A label selects the exact suspended inner step. Without one, retain the
        // established single-step auto-detection behavior.
        const suspendedStepId = isValidNestedResumeLabel
          ? nestedResumeLabel.stepId
          : resumeLabel === undefined
            ? Object.keys(snapshot?.suspendedPaths ?? {})?.[0]
            : undefined;
        const hasNestedExecutionPath =
          suspendedStepId !== undefined &&
          Object.prototype.hasOwnProperty.call(snapshot?.suspendedPaths ?? {}, suspendedStepId);
        const nestedExecutionPath = hasNestedExecutionPath ? snapshot?.suspendedPaths?.[suspendedStepId] : undefined;
        const nestedResumeEntry = resolveWorkflowStepPath(nestedWorkflow, nestedExecutionPath);
        const nestedResumeStepId = nestedResumeEntry ? getStepIds(nestedResumeEntry)[0] : undefined;
        const nestedForEachResult =
          nestedResumeLabel?.stepId !== undefined ? (snapshot?.context?.[nestedResumeLabel.stepId] as any) : undefined;
        const isValidNestedForEachTarget =
          resumeLabel === undefined ||
          nestedResumeEntry?.type !== 'foreach' ||
          (nestedResumeLabel?.foreachIndex !== undefined &&
            Array.isArray(nestedForEachResult?.output) &&
            nestedResumeLabel.foreachIndex < nestedForEachResult.output.length &&
            isEventedForeachSuspensionResult(nestedForEachResult.output[nestedResumeLabel.foreachIndex]));
        const isValidNestedExecutionPath =
          Array.isArray(nestedExecutionPath) &&
          nestedExecutionPath.every(index => Number.isInteger(index) && index >= 0) &&
          nestedResumeStepId === suspendedStepId &&
          isValidNestedForEachTarget;
        if (snapshot?.status !== 'suspended' || !suspendedStepId || !isValidNestedExecutionPath) {
          return this.errorWorkflow(
            {
              ...lifecycleExecution,
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
              text: 'No matching suspended step found in nested workflow',
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }

        const nestedStepResults = snapshot?.context;
        const nestedLifecycleExecution = {
          executionGeneration: requireWorkflowExecutionGeneration(
            snapshot.executionGeneration,
            `Nested workflow resume ${leafId}/${nestedRunId}`,
          ),
          lifecycleResumeAttempt: (snapshot.lifecycleResumeAttempt ?? 0) + 1,
          lifecycleStepStates: snapshot.lifecycleStepStates ?? {},
        };
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
            ...nestedLifecycleExecution,
            workflowId: leafId,
            parentWorkflow: {
              stepId: leafId,
              workflowId,
              runId,
              ...lifecycleExecution,
              stepGraph,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
              resume: true,
              recoveryAncestry: parentWorkflow?.recoveryAncestry ?? [],
              shouldPersistSnapshot: parentShouldPersistSnapshot,
            },
            executionPath: nestedExecutionPath as any,
            runId: nestedRunId,
            resumeSteps: [suspendedStepId], // Resume the auto-detected inner step
            stepResults: nestedStepResults,
            prevResult: nestedPrevResult,
            resumeData,
            resumeLabel,
            forEachIndex: nestedResumeLabel?.foreachIndex ?? forEachIndex,
            activeStepsPath,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      } else if (resumeSteps?.length > 1 && resumeSteps[0] === leafId) {
        const nestedRunId = stepData?.suspendPayload?.__workflow_meta?.runId;
        if (!nestedRunId) {
          return this.errorWorkflow(
            {
              ...lifecycleExecution,
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
          workflowName: leafId,
          runId: nestedRunId,
        });

        const nestedStepResults = snapshot?.context;
        const nestedSteps = resumeSteps.slice(1);
        const nestedExecutionPath = snapshot?.suspendedPaths?.[nestedSteps[0]!];
        const nestedResumeEntry = resolveWorkflowStepPath(nestedWorkflow, nestedExecutionPath);
        const nestedResumeLeaf: SingleStepEntry | undefined =
          nestedResumeEntry === undefined
            ? undefined
            : nestedResumeEntry.type === 'loop' || nestedResumeEntry.type === 'foreach'
              ? nestedResumeEntry.step
              : (nestedResumeEntry as SingleStepEntry);
        const canDescendIntoNestedStep = nestedResumeLeaf !== undefined && getEntryWorkflow(nestedResumeLeaf) !== null;
        const isValidNestedExecutionPath =
          snapshot?.status === 'suspended' &&
          Object.prototype.hasOwnProperty.call(snapshot?.suspendedPaths ?? {}, nestedSteps[0]!) &&
          Array.isArray(nestedExecutionPath) &&
          nestedExecutionPath.every(index => Number.isInteger(index) && index >= 0) &&
          (nestedResumeLeaf ? getEntryId(nestedResumeLeaf) : undefined) === nestedSteps[0] &&
          (nestedSteps.length === 1 || canDescendIntoNestedStep);
        if (!isValidNestedExecutionPath) {
          return this.errorWorkflow(
            {
              ...lifecycleExecution,
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
              text: 'No matching suspended step found in nested workflow',
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }
        const nestedLifecycleExecution = {
          executionGeneration: requireWorkflowExecutionGeneration(
            snapshot.executionGeneration,
            `Nested workflow resume ${leafId}/${nestedRunId}`,
          ),
          lifecycleResumeAttempt: (snapshot.lifecycleResumeAttempt ?? 0) + 1,
          lifecycleStepStates: snapshot.lifecycleStepStates ?? {},
        };
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
            ...nestedLifecycleExecution,
            workflowId: leafId,
            parentWorkflow: {
              stepId: leafId,
              workflowId,
              runId,
              ...lifecycleExecution,
              stepGraph,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
              resume: true,
              recoveryAncestry: parentWorkflow?.recoveryAncestry ?? [],
              shouldPersistSnapshot: parentShouldPersistSnapshot,
            },
            executionPath: nestedExecutionPath,
            runId: nestedRunId,
            resumeSteps: nestedSteps,
            stepResults: nestedStepResults,
            prevResult: nestedPrevResult,
            resumeData,
            resumeLabel,
            forEachIndex,
            activeStepsPath,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      } else if (timeTravel && timeTravel.steps?.length > 1 && timeTravel.steps[0] === leafId) {
        const nestedRunId = resolveNestedWorkflowDispatchRunId({
          ...nestedRunCoordinate,
          ownedRunId: ownedNestedRunId,
        });
        const snapshot =
          (await workflowsStore?.loadWorkflowSnapshot({
            workflowName: leafId,
            runId: nestedRunId,
          })) ?? ({ context: {} } as WorkflowRunState);

        const timeTravelParams = createTimeTravelExecutionParams({
          steps: timeTravel.steps.slice(1),
          inputData: timeTravel.inputData,
          resumeData: timeTravel.resumeData,
          context: (timeTravel.nestedStepResults?.[leafId] ?? {}) as any,
          nestedStepsContext: (timeTravel.nestedStepResults ?? {}) as any,
          snapshot,
          graph: nestedWorkflow.buildExecutionGraph(),
          perStep,
        });

        const nestedPrevStepId = getStepId(nestedWorkflow, timeTravelParams.executionPath);
        const nestedPrevResult = timeTravelParams.stepResults[nestedPrevStepId ?? 'input'];
        const nestedLifecycleExecution = {
          executionGeneration: createNestedWorkflowExecutionGeneration({
            ...nestedRunCoordinate,
            parentExecutionGeneration: executionGeneration,
            nestedRunId,
          }),
          lifecycleResumeAttempt: 0,
          lifecycleStepStates: {},
        };

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.start',
          runId,
          data: {
            ...nestedLifecycleExecution,
            workflowId: leafId,
            parentWorkflow: {
              stepId: leafId,
              workflowId,
              runId,
              ...lifecycleExecution,
              stepGraph,
              executionPath,
              resumeSteps,
              stepResults,
              timeTravel,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
              resume: false,
              recoveryAncestry: parentWorkflow?.recoveryAncestry ?? [],
              shouldPersistSnapshot: parentShouldPersistSnapshot,
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
      } else if (restart && !!restart.activeStepsPath?.[leafId]) {
        const nestedRunId = resolveNestedWorkflowDispatchRunId({
          ...nestedRunCoordinate,
          ownedRunId: ownedNestedRunId,
        });
        const snapshot =
          (await workflowsStore?.loadWorkflowSnapshot({
            workflowName: leafId,
            runId: nestedRunId,
          })) ?? ({ context: {} } as WorkflowRunState);

        const restartParams = createRestartExecutionParams({ snapshot, graph: nestedWorkflow.buildExecutionGraph() });

        const nestedPrevStepId = getStepId(nestedWorkflow, snapshot.activePaths);
        const nestedPrevResult = restartParams.stepResults[nestedPrevStepId ?? 'input'];
        const nestedLifecycleExecution = {
          executionGeneration: createNestedWorkflowExecutionGeneration({
            ...nestedRunCoordinate,
            parentExecutionGeneration: executionGeneration,
            nestedRunId,
          }),
          lifecycleResumeAttempt: 0,
          lifecycleStepStates: {},
        };

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.start',
          runId,
          data: {
            ...nestedLifecycleExecution,
            workflowId: leafId,
            parentWorkflow: {
              stepId: leafId,
              workflowId,
              runId,
              ...lifecycleExecution,
              stepGraph,
              executionPath,
              resumeSteps,
              stepResults,
              restart,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
              resume: false,
              recoveryAncestry: parentWorkflow?.recoveryAncestry ?? [],
              shouldPersistSnapshot: parentShouldPersistSnapshot,
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
        // The dispatch run id must stay stable across broker redelivery and
        // process restarts (cross-process ownership), so resolve it from the
        // retained ownership metadata / execution coordinate instead of
        // minting a random UUID per delivery.
        const nestedRunId = resolveNestedWorkflowDispatchRunId({
          ...nestedRunCoordinate,
          ownedRunId: ownedNestedRunId,
        });
        const shouldPersist =
          nestedWorkflow?.options?.shouldPersistSnapshot?.({
            stepResults: {},
            workflowStatus: 'pending',
          }) ?? true;
        const usesAtomicNestedAdmission =
          workflowsStore?.getWorkflowTerminalizationCapabilities().recoveryVersion === 1;
        const parentRun = await workflowsStore?.getWorkflowRunById({ runId, workflowName: workflow.id });
        const nestedLifecycleExecution = {
          executionGeneration: createNestedWorkflowExecutionGeneration({
            ...nestedRunCoordinate,
            parentExecutionGeneration: executionGeneration,
            nestedRunId,
          }),
          lifecycleResumeAttempt: 0,
          lifecycleStepStates: {},
        };

        // Recovery-capable stores initialize the child with its real input and
        // state atomically alongside parent ownership in processWorkflowStart.
        // Pre-writing an empty pending row makes that admission retain the stub
        // as the replay winner, permanently dropping `context.input`. Legacy
        // stores still need the established pending-row bootstrap.
        if (shouldPersist && !usesAtomicNestedAdmission) {
          const pendingSnapshot: WorkflowRunState = {
            runId: nestedRunId,
            ...nestedLifecycleExecution,
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
            snapshot: {
              ...(nestedWorkflow?.options?.pruneSnapshot
                ? nestedWorkflow.options.pruneSnapshot({ snapshot: pendingSnapshot, workflowStatus: 'pending' })
                : pendingSnapshot),
              ...nestedLifecycleExecution,
            },
          });
        }

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.start',
          runId,
          data: {
            ...nestedLifecycleExecution,
            workflowId: leafId,
            parentWorkflow: {
              stepId: leafId,
              workflowId,
              stepGraph,
              runId,
              ...lifecycleExecution,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
              activeStepsPath,
              resumeData,
              resume: false,
              recoveryAncestry: parentWorkflow?.recoveryAncestry ?? [],
              shouldPersistSnapshot: parentShouldPersistSnapshot,
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
            initializeSnapshot: shouldPersist,
            resourceId: parentRun?.resourceId,
          },
        });
      }

      return;
    }

    if (isSingleStepEntry(step)) {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-start',
          payload: {
            id: leafId,
            stepCallId: lifecycleStepState.stepCallId,
            stepAttempt: lifecycleStepState.stepAttempt,
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
        resumeData: timeTravel?.stepResults[leafId]?.status === 'suspended' ? timeTravel?.resumeData : undefined,
        step: getEntrySchemas(leaf, this.mastra),
      });

    const isTimeTravelResume = timeTravel?.stepResults[leafId]?.status === 'suspended';
    const isExplicitResume = resumeSteps?.[0] === leafId;
    let resumeDataToUse;
    if (isTimeTravelResume && !timeTravelResumeValidationError) {
      resumeDataToUse = timeTravelResumeData;
    } else if (isTimeTravelResume && timeTravelResumeValidationError) {
      this.mastra.getLogger()?.warn('Time travel resume data validation failed', {
        stepId: leafId,
        error: timeTravelResumeValidationError.message,
      });
    } else if (isExplicitResume) {
      resumeDataToUse = resumeData;
    }

    // Get the abort controller for this workflow run
    const abortController = this.getOrCreateAbortController(runId);

    let stepResult: StepResult<any, any, any, any>;

    if (this.stepExecutionStrategy) {
      stepResult = await this.stepExecutionStrategy.executeStep({
        workflowId,
        runId,
        stepId: leafId,
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
        entry: leaf,
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

    const authoritativeStateAfterExecution = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: workflowId,
      runId,
    });
    if (
      authoritativeStateAfterExecution &&
      ((authoritativeStateAfterExecution.executionGeneration !== undefined &&
        authoritativeStateAfterExecution.executionGeneration !== executionGeneration) ||
        WorkflowEventProcessor.TERMINAL_CHILD_RUN_STATUSES.has(authoritativeStateAfterExecution.status))
    ) {
      // User code can outlive a remote cancellation because abort delivery is
      // cooperative and may be owned by another process. Re-read the durable
      // tuple after the await and suppress every non-authoritative completion
      // event. A cancel worker that observed this persisted coordinate closes
      // it; PF-2013 owns atomic admission/cancel ordering and concurrent
      // same-step foreach coordinates.
      this.mastra.getLogger()?.debug?.('Evented workflow step completion lost durable terminal ownership', {
        workflowId,
        runId,
        stepId: leafId,
        currentStatus: authoritativeStateAfterExecution.status,
        currentExecutionGeneration: authoritativeStateAfterExecution.executionGeneration,
        incomingExecutionGeneration: executionGeneration,
      });
      this.cleanupRun(runId);
      return;
    }

    if (abortController?.signal?.aborted) {
      // Extract updated state from step result
      const updatedState = (stepResult as any).__state ?? currentState;
      const canceledIdentity = {
        stepId: leafId,
        stepCallId: lifecycleStepState.stepCallId,
        stepAttempt: lifecycleStepState.stepAttempt,
      };
      await publishWorkflowLifecycleEvent({
        pubsub: this.mastra.pubsub,
        workflowId,
        runId,
        executionGeneration,
        event: { type: 'step.canceled', ...canceledIdentity },
      });
      await publishWorkflowLifecycleEvent({
        pubsub: this.mastra.pubsub,
        workflowId,
        runId,
        executionGeneration,
        event: { type: 'step.finished', ...canceledIdentity, status: 'canceled' },
      });
      //cancel the workflow
      return this.mastra.pubsub.publish('workflows', {
        type: 'workflow.cancel',
        runId,
        data: {
          ...lifecycleExecution,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          timeTravel,
          stepResults: {
            ...stepResults,
            [leafId]: stepResult,
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
      const bailedIdentity = {
        stepId: leafId,
        stepCallId: lifecycleStepState.stepCallId,
        stepAttempt: lifecycleStepState.stepAttempt,
      };
      await publishWorkflowLifecycleEvent({
        pubsub: this.mastra.pubsub,
        workflowId,
        runId,
        executionGeneration,
        event: { type: 'step.completed', ...bailedIdentity, output: (stepResult as any).output },
      });
      await publishWorkflowLifecycleEvent({
        pubsub: this.mastra.pubsub,
        workflowId,
        runId,
        executionGeneration,
        event: { type: 'step.finished', ...bailedIdentity, status: 'success' },
      });
      // @ts-expect-error - bailed status not in type
      stepResult.status = 'success';

      await this.endWorkflow({
        ...lifecycleExecution,
        workflow,
        resumeData,
        parentWorkflow,
        workflowId,
        runId,
        executionPath,
        resumeSteps,
        stepResults: {
          ...stepResults,
          [leafId]: stepResult,
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
      const retries = getEntryRetries(leaf) ?? workflow.retryConfig.attempts ?? 0;
      if (retryCount >= retries || stepResult.nonRetryable) {
        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.step.end',
          runId,
          data: {
            ...lifecycleExecution,
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
          type: 'workflow.step.run',
          runId,
          data: {
            ...lifecycleExecution,
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
      const suspendedStepResult = {
        ...stepResult,
        // A suspended body has not completed the current iteration yet.
        // Preserve the number of previously completed iterations so the
        // resumed body evaluates its condition at the same count instead
        // of resetting to one (or incrementing twice). This must be present
        // on both stepResults and prevResult because the step-end processor
        // persists prevResult before it builds the suspended snapshot.
        metadata: {
          ...stepResult.metadata,
          iterationCount: stepResults[leafId]?.metadata?.iterationCount ?? 0,
        },
      };
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          ...lifecycleExecution,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          timeTravel,
          restart,
          stepResults: {
            ...stepResults,
            [leafId]: suspendedStepResult,
            __state: updatedState,
          },
          prevResult: suspendedStepResult,
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
          ...lifecycleExecution,
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
          mastra: this.mastra,
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
          ...lifecycleExecution,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          timeTravel, //timeTravel is passed in as workflow.step.end ends the step, not the workflow, the timeTravel info is passed to the next step to run.
          restart,
          stepResults: {
            ...stepResults,
            [leafId]: stepResult,
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
    executionGeneration,
    lifecycleResumeAttempt,
    lifecycleStepStates,
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
    executionGeneration: string;
    lifecycleResumeAttempt: number;
    lifecycleStepStates: Record<string, { stepCallId: string; stepAttempt: number }>;
  }) {
    const lifecycleExecution = { executionGeneration, lifecycleResumeAttempt, lifecycleStepStates };
    const baseState = resolveCurrentState({ stepResults, state });
    // Merge each branch's setState() delta key-by-key on top of the resolved
    // state so sibling branches' updates aren't lost to last-writer-wins on
    // full state snapshots (#22319).
    const currentState = { ...baseState };
    const parentIdx = branchExecutionPath[0]!;
    const finishedBranchIdx = branchExecutionPath.length > 1 ? branchExecutionPath[1]! : undefined;

    let suspendedCount = 0;
    let skippedCount = 0;
    const allResults: Record<string, any> = {};
    const suspendedPaths: Record<string, number[]> = {};
    let resumeLabels = createEventedResumeLabels();

    try {
      for (const [idx, branch] of branchEntry.steps.entries()) {
        if (!isSingleStepEntry(branch)) continue;
        const branchId = getSingleStepEntryId(branch);
        const res = stepResults?.[branchId] as any;
        if (!res || !res.status) continue; // branch not finished yet
        const stateDelta =
          idx === finishedBranchIdx && (latestBranchResult as any)?.__stateDelta
            ? (latestBranchResult as any).__stateDelta
            : res.__stateDelta;
        if (stateDelta) {
          Object.assign(currentState, stateDelta);
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
          resumeLabels = mergeEventedResumeLabels(resumeLabels, res.suspendPayload?.__workflow_meta?.resumeLabels);
        }
        // failed / canceled branches short-circuit the workflow before reaching here
      }
    } catch (error) {
      return this.errorWorkflow(
        {
          ...lifecycleExecution,
          workflowId,
          runId,
          executionPath: branchExecutionPath,
          resumeSteps,
          stepResults,
          prevResult: latestBranchResult ?? ({ status: 'failed' } as any),
          activeStepsPath,
          requestContext,
          timeTravel,
          restart,
          parentWorkflow,
          state: currentState,
          outputOptions,
        },
        getErrorFromUnknown(error),
      );
    }

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
          requestContext: getPersistedRequestContext(requestContext),
          executionGeneration: lifecycleExecution.executionGeneration,
        });
        const suspendTracingContext = this.resolveSuspendTracingContext(runId);
        await workflowsStore?.updateWorkflowState({
          workflowName: workflowId,
          runId,
          opts: {
            status: 'suspended',
            ...lifecycleExecution,
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
          ...lifecycleExecution,
          workflowId,
          runId,
          executionPath: branchExecutionPath,
          resumeSteps,
          parentWorkflow,
          stepResults: { ...stepResults, __state: currentState },
          // Preserve the complete branch-label map while bubbling a nested
          // parallel/conditional suspension to its parent workflow.
          prevResult: {
            status: 'suspended',
            suspendedAt: Date.now(),
            suspendPayload: {
              __workflow_meta: {
                resumeLabels,
              },
            },
          } as any,
          activeStepsPath,
          requestContext,
          timeTravel,
          restart,
          state: currentState,
          outputOptions,
          suspendedStepIds: Object.keys(suspendedPaths),
        },
      });
      return;
    }

    // All branches finished: drop the internal per-branch deltas and forward the
    // merged state so downstream steps resolve it from stepResults.__state.
    const cleanedStepResults: Record<string, any> = { ...stepResults, __state: currentState };
    for (const [key, res] of Object.entries(cleanedStepResults)) {
      if (res && typeof res === 'object' && '__stateDelta' in res) {
        const { __stateDelta: _removedDelta, ...cleanRes } = res;
        cleanedStepResults[key] = cleanRes;
      }
    }

    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.step.end',
      runId,
      data: {
        ...lifecycleExecution,
        parentWorkflow,
        workflowId,
        runId,
        executionPath: branchExecutionPath.slice(0, -1),
        resumeSteps,
        stepResults: cleanedStepResults,
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
    executionGeneration: suppliedExecutionGeneration,
    lifecycleResumeAttempt = 0,
    lifecycleStepStates = {},
  }: ProcessorArgs) {
    const executionGeneration = requireWorkflowExecutionGeneration(
      suppliedExecutionGeneration,
      `Evented workflow step result ${workflowId}/${runId}`,
    );
    const lifecycleExecution = { executionGeneration, lifecycleResumeAttempt, lifecycleStepStates };
    // Extract state from prevResult if it was updated by the step
    // For nested workflow completion (parentContext present), prefer the passed state
    // as it contains the nested workflow's updated state
    const currentState = parentContext
      ? (state ?? (prevResult as any)?.__state ?? stepResults?.__state ?? {})
      : ((prevResult as any)?.__state ?? stepResults?.__state ?? state ?? {});

    // Create a clean version of prevResult without __state for storing
    const { __state: _removedState, __stateDelta: extractedStateDelta, ...cleanPrevResult } = prevResult as any;

    const rawStep = workflow.stepGraph[executionPath[0]!];

    // For branches of a parallel/conditional entry, keep the setState() delta on
    // the stored branch result so aggregateBranchResults can merge sibling
    // updates key-by-key instead of last-writer-wins on full snapshots (#22319).
    // For all other steps the delta is redundant with __state and is dropped.
    const isParallelBranch =
      (rawStep?.type === 'parallel' || rawStep?.type === 'conditional') && executionPath.length > 1;
    const branchStateDelta = isParallelBranch ? (extractedStateDelta as Record<string, any> | undefined) : undefined;
    prevResult = cleanPrevResult as typeof prevResult;

    // The just-finished entry. Keep it raw (declarative agent / tool / mapping
    // entries are not materialized); we only need its id and type here.
    let step: StepFlowEntry | undefined = rawStep;

    if ((step?.type === 'parallel' || step?.type === 'conditional') && executionPath.length > 1) {
      step = step.steps[executionPath[1]!];
    }

    if (!step) {
      return this.errorWorkflow(
        {
          ...lifecycleExecution,
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

    if (isExecutableStep(step)) {
      const { state: lifecycleStepState } = getOrCreateWorkflowStepLifecycleState({
        workflowId,
        runId,
        executionGeneration,
        stepId,
        executionPath,
        foreachIndex: step.type === 'foreach' ? executionPath[1] : forEachIndex,
        iterationCount:
          step.type === 'loop'
            ? (stepResults[stepId]?.metadata?.iterationCount ?? 0)
            : stepResults[stepId]?.metadata?.iterationCount,
        states: lifecycleStepStates,
      });
      if (lifecycleStepState.stepAttempt < 1) lifecycleStepState.stepAttempt = 1;
      const identity = {
        stepId,
        stepCallId: lifecycleStepState.stepCallId,
        stepAttempt: lifecycleStepState.stepAttempt,
      };

      if (prevResult.status === 'suspended') {
        await publishWorkflowLifecycleEvent({
          pubsub: this.mastra.pubsub,
          workflowId,
          runId,
          executionGeneration,
          event: { type: 'step.suspended', ...identity, suspendPayload: prevResult.suspendPayload },
        });
      } else if (prevResult.status === 'failed') {
        await publishWorkflowLifecycleEvent({
          pubsub: this.mastra.pubsub,
          workflowId,
          runId,
          executionGeneration,
          event: { type: 'step.failed', ...identity, error: prevResult.error },
        });
        await publishWorkflowLifecycleEvent({
          pubsub: this.mastra.pubsub,
          workflowId,
          runId,
          executionGeneration,
          event: { type: 'step.finished', ...identity, status: 'failed' },
        });
      } else if (prevResult.status === 'success' || (prevResult as any).status === 'bailed') {
        await publishWorkflowLifecycleEvent({
          pubsub: this.mastra.pubsub,
          workflowId,
          runId,
          executionGeneration,
          event: { type: 'step.completed', ...identity, output: (prevResult as any).output },
        });
        await publishWorkflowLifecycleEvent({
          pubsub: this.mastra.pubsub,
          workflowId,
          runId,
          executionGeneration,
          event: { type: 'step.finished', ...identity, status: 'success' },
        });
      }
    }

    if (step.type === 'foreach') {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: workflowId,
        runId,
      });

      const currentIdx = executionPath[1];
      const snapshotContext = snapshot?.context as Record<string, ForeachStepResult> | undefined;
      const existingStepResult = snapshotContext?.[getEntryId(step.step)];
      const currentResult = existingStepResult?.output?.slice();
      // Preserve the original payload (the input array) from the existing step result
      const originalPayload = existingStepResult?.payload;

      let newResult = prevResult;
      let storageResult: StepResult<any, any, any, any> | undefined;
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
            stepId: getEntryId(step.step),
            result: bailedResult as any,
            requestContext: getPersistedRequestContext(requestContext),
            executionGeneration: lifecycleExecution.executionGeneration,
          });

          // End workflow with bail result
          return this.endWorkflow({
            ...lifecycleExecution,
            workflow,
            parentWorkflow,
            workflowId,
            runId,
            executionPath: [executionPath[0]!],
            resumeSteps,
            stepResults: { ...stepResults, [getEntryId(step.step)]: bailedResult },
            prevResult: bailedResult,
            activeStepsPath,
            requestContext,
            perStep,
            state: currentState,
            outputOptions,
          });
        }

        // For foreach, store the full suspended result so its resume state is preserved.
        // Completed iterations keep the public output array shape.
        const iterationResult =
          prevResult.status === 'suspended' || prevResult.status === 'failed' ? prevResult : (prevResult as any).output;
        const existingSuspendPayload = existingStepResult?.suspendPayload as any;
        const iterationSuspendPayload = prevResult.suspendPayload as any;
        // Fork recovery stores only suspended entries in a sparse object while
        // the upstream foreach runner uses an array for ordinary progress. Keep
        // whichever representation is already authoritative and seed a first
        // failure from the iteration payload, which contains all progress made
        // before the failure. Spreading a sparse recovery object as an array
        // throws, while ignoring the iteration payload re-executes completed
        // side effects during time travel.
        const persistedForeachOutput =
          existingSuspendPayload?.__workflow_meta?.foreachOutput ??
          iterationSuspendPayload?.__workflow_meta?.foreachOutput;
        const foreachOutput = Array.isArray(persistedForeachOutput)
          ? [...persistedForeachOutput]
          : persistedForeachOutput && typeof persistedForeachOutput === 'object'
            ? { ...persistedForeachOutput }
            : [];
        if (!Array.isArray(foreachOutput) && Array.isArray(currentResult)) {
          for (let index = 0; index < currentResult.length; index++) {
            if (index === currentIdx || Object.hasOwn(foreachOutput, index) || !(index in currentResult)) continue;
            const output = currentResult[index];
            if (output === null || isEventedForeachSuspensionResult(output)) continue;
            foreachOutput[index] = { status: 'success', output, suspendPayload: {} };
          }
        }
        foreachOutput[currentIdx] =
          prevResult.status === 'suspended' ? prevResult : { ...prevResult, suspendPayload: {} };
        const suspendPayload = {
          ...(existingSuspendPayload ?? iterationSuspendPayload),
          __workflow_meta: {
            ...(existingSuspendPayload?.__workflow_meta ?? iterationSuspendPayload?.__workflow_meta),
            foreachOutput,
          },
        };

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
            suspendPayload,
            suspendedAt: existingStepResult?.suspendedAt ?? (prevResult as any).suspendedAt,
            // Update resume metadata to most recent resume (new iteration takes precedence)
            resumePayload: (prevResult as any).resumePayload ?? existingStepResult?.resumePayload,
            resumedAt: (prevResult as any).resumedAt ?? existingStepResult?.resumedAt,
          } as any;
        } else {
          newResult = { ...prevResult, output: [iterationResult], payload: originalPayload, suspendPayload } as any;
        }

        const existingForeachOutput = existingSuspendPayload?.__workflow_meta?.foreachOutput;
        if (existingForeachOutput && typeof existingForeachOutput === 'object') {
          // Only this coordinate completed in this event. The storage merge
          // retains its siblings atomically; copying their earlier results
          // could overwrite a success from a concurrent retry with an old failure.
          // Keep the full result above for the no-storage fallback and first seed.
          const completionOutput = Array.from({ length: currentIdx + 1 }, () => null as unknown);
          completionOutput[currentIdx] = iterationResult;
          storageResult = {
            ...newResult,
            output: completionOutput,
            suspendPayload: {
              ...suspendPayload,
              __workflow_meta: {
                ...suspendPayload.__workflow_meta,
                foreachOutput: { [currentIdx]: foreachOutput[currentIdx] },
              },
            },
          } as any;
        }
      }
      const newStepResults = await workflowsStore?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId: getEntryId(step.step),
        result: storageResult ?? newResult,
        requestContext: getPersistedRequestContext(requestContext),
        executionGeneration: lifecycleExecution.executionGeneration,
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
          requestContext: getPersistedRequestContext(requestContext),
          executionGeneration: lifecycleExecution.executionGeneration,
        });
      }

      // Same fallback as the regular step path: when no run record was
      // persisted (shouldPersistSnapshot opted out of running) the store
      // returns `{}`, and when there's no storage at all newStepResults is
      // undefined. In both cases preserve the inline stepResults instead of
      // discarding everything but the foreach step's result.
      const mergedForeachStepResults =
        !newStepResults || Object.keys(newStepResults).length === 0
          ? { ...(stepResults ?? {}), [getEntryId(step.step)]: newResult }
          : newStepResults;
      stepResults = { ...mergedForeachStepResults, __state: currentState };

      // For foreach iterations, check if all iterations are complete before emitting events
      // This prevents emitting workflow.suspend when only some concurrent iterations have finished
      if (currentIdx !== undefined) {
        const foreachResult = readForeachResult(stepResults, getEntryId(step.step));
        const iterationResults: ForeachIterationResult[] = foreachResult?.output ?? [];
        const targetLen = foreachResult?.payload?.length ?? 0;
        let durableIterationResults: unknown[];

        try {
          assertValidEventedForeachSuspensionResults(iterationResults);
          durableIterationResults = restoreEventedForeachSuspensionPayloads(
            iterationResults,
            (foreachResult?.suspendPayload as { __workflow_meta?: { foreachOutput?: unknown } } | undefined)
              ?.__workflow_meta?.foreachOutput,
            [currentIdx],
          );
        } catch (error) {
          return this.errorWorkflow(
            {
              ...lifecycleExecution,
              workflowId,
              runId,
              executionPath,
              resumeSteps,
              stepResults,
              prevResult,
              activeStepsPath,
              requestContext,
              timeTravel,
              restart,
              parentWorkflow,
              perStep,
              state: currentState,
              outputOptions,
              forEachIndex,
              nestedRunId,
            },
            getErrorFromUnknown(error),
          );
        }

        // Count iterations by status - pending iterations appear as null in stepResults after
        // storage merge (pending markers are converted to null by the storage layer).
        const pendingCount = iterationResults.filter((r: any) => r === null).length;
        const suspendedCount = iterationResults.filter(isEventedForeachSuspensionResult).length;
        const iterationsStarted = iterationResults.length;

        // Emit per-iteration progress event
        const completedCount = iterationResults.filter(
          (r: any) => r !== null && !isEventedForeachSuspensionResult(r),
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
              id: getEntryId(step.step),
              completedCount,
              totalCount: targetLen,
              currentIndex: currentIdx,
              iterationStatus,
              ...(prevResult.status === 'success' ? { iterationOutput: (prevResult as any).output } : {}),
            },
          },
        });

        const persistedForeachOutput = (
          foreachResult?.suspendPayload as { __workflow_meta?: { foreachOutput?: unknown } } | undefined
        )?.__workflow_meta?.foreachOutput;
        // A queued retry retains its previous attempt's failure until it runs.
        // Only failures from admitted coordinates can fail the current attempt.
        const failedIteration = Object.entries(
          persistedForeachOutput && typeof persistedForeachOutput === 'object' ? persistedForeachOutput : {},
        ).find(
          ([index, result]) =>
            result?.status === 'failed' && !isQueuedForeachIteration(iterationResults[Number(index)]),
        )?.[1] as StepResult<any, any, any, any> | undefined;

        // Once any iteration fails, do not start another coordinate. Already
        // admitted siblings still own real side effects, so wait for all of
        // them to settle and persist their progress before terminalizing. The
        // durable failure envelope then remains available to time travel.
        if (failedIteration) {
          if (pendingCount > 0) return;
          await this.mastra.pubsub.publish('workflows', {
            type: 'workflow.fail',
            runId,
            data: {
              ...lifecycleExecution,
              workflowId,
              runId,
              executionPath,
              resumeSteps,
              parentWorkflow,
              stepResults,
              timeTravel,
              restart,
              prevResult: failedIteration,
              activeStepsPath,
              requestContext,
              state: currentState,
              outputOptions,
            },
          });
          return;
        }

        if (pendingCount > 0) {
          // There are still pending (null) iterations - concurrent execution in progress
          // Wait for them to complete
          return;
        }

        // Check if there are more iterations to start before deciding to suspend
        // This handles partial concurrency: don't suspend until all iterations have been started
        const foreachConcurrency = resolveForeachConcurrency(step.opts, {
          inputData: foreachResult!.payload,
          getInitData: () => (stepResults as any)?.input,
          requestContext: new RequestContext(Object.entries(requestContext ?? {}) as any),
        });
        if (iterationsStarted < targetLen && suspendedCount < foreachConcurrency) {
          // More iterations need to be started - call processWorkflowForEach to continue
          await processWorkflowForEach(
            {
              ...lifecycleExecution,
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
          // suspendedPaths maps stepId -> executionPath, using the step ID (not stepId[index])
          const suspendedPaths: Record<string, number[]> = {
            [getEntryId(step.step)]: [executionPath[0]!],
          };

          // Materialize all per-iteration payloads for targeted resume while
          // retaining the first suspension as the user-facing step payload.
          let suspension: ReturnType<typeof aggregateEventedForeachSuspensions>;
          try {
            suspension = aggregateEventedForeachSuspensions(durableIterationResults);
          } catch (error) {
            return this.errorWorkflow(
              {
                ...lifecycleExecution,
                workflowId,
                runId,
                executionPath,
                resumeSteps,
                stepResults,
                prevResult,
                activeStepsPath,
                requestContext,
                timeTravel,
                restart,
                parentWorkflow,
                perStep,
                state: currentState,
                outputOptions,
                forEachIndex,
                nestedRunId,
              },
              getErrorFromUnknown(error),
            );
          }
          if (!suspension) return;

          const aggregateExecutionPath = [executionPath[0]!, suspension.firstSuspendedIndex];

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
              ...suspension.firstSuspendPayload,
              __workflow_meta: {
                ...(suspension.firstSuspendPayload?.__workflow_meta ?? {}),
                foreachIndex: suspension.firstSuspendedIndex,
                resumeLabels: suspension.resumeLabels,
                foreachOutput: suspension.foreachOutput,
              },
            },
          };

          // Update the step result with aggregated suspend status
          await workflowsStore?.updateWorkflowResults({
            workflowName: workflow.id,
            runId,
            stepId: getEntryId(step.step),
            result: foreachSuspendResult as any,
            requestContext: getPersistedRequestContext(requestContext),
            executionGeneration: lifecycleExecution.executionGeneration,
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
              requestContext: getPersistedRequestContext(requestContext),
              executionGeneration: lifecycleExecution.executionGeneration,
            });

            const suspendTracingContext = this.resolveSuspendTracingContext(runId);
            await workflowsStore?.updateWorkflowState({
              workflowName: workflowId,
              runId,
              opts: {
                status: 'suspended',
                ...lifecycleExecution,
                result: foreachSuspendResult,
                suspendedPaths,
                resumeLabels: suspension.resumeLabels,
                activePaths: aggregateExecutionPath,
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
              ...lifecycleExecution,
              workflowId,
              runId,
              executionPath: [executionPath[0]!],
              resumeSteps,
              parentWorkflow,
              stepResults: { ...stepResults, [getEntryId(step.step)]: foreachSuspendResult },
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
            ...lifecycleExecution,
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
        const priorMetadata = stepResults[stepId]?.metadata ?? {};
        prevResult = stepResults[stepId] = {
          ...prevResult,
          payload: parentContext.input?.output ?? {},
          // Store nestedRunId in metadata for getWorkflowRunById retrieval
          ...(nestedRunId && {
            metadata: {
              ...priorMetadata,
              ...(prevResult as any).metadata,
              nestedRunId,
            },
          }),
        };
      }

      // For branches of a parallel/conditional entry, persist the setState()
      // delta on the stored branch result so aggregateBranchResults can merge
      // sibling updates key-by-key instead of last-writer-wins on full state
      // snapshots (#22319). The delta is stripped again before results are
      // surfaced to users.
      const storedResult = branchStateDelta ? { ...prevResult, __stateDelta: branchStateDelta } : prevResult;

      const newStepResults = await workflowsStore?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId,
        result: storedResult,
        requestContext: getPersistedRequestContext(requestContext),
        executionGeneration: lifecycleExecution.executionGeneration,
      });

      // When the Mastra has no storage configured, workflowsStore is undefined
      // and updateWorkflowResults returns undefined. When it has storage but no
      // run record yet (shouldPersistSnapshot skipped the initial running
      // snapshot), it returns `{}`. In both cases the event payload is the
      // source of truth — merge prevResult into the inline stepResults instead
      // of treating it as a hard early-return.
      if (!newStepResults || Object.keys(newStepResults).length === 0) {
        stepResults = { ...(stepResults ?? {}), [stepId]: storedResult };
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
          ...lifecycleExecution,
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
            // Strip completion fields of the step's *previous* run (a stale
            // `output` would otherwise re-publish state blobs), then re-add
            // the fields describing the current suspension.
            ...omitPriorCompletionFields(prevResult),
            suspendedAt: Date.now(),
            suspendPayload: prevResult.suspendPayload,
            ...(prevResult.suspendOutput !== undefined ? { suspendOutput: prevResult.suspendOutput } : {}),
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
          ...lifecycleExecution,
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
      const suspendedStepId = getStepId(workflow, executionPath);
      if (suspendedStepId) {
        suspendedPaths[suspendedStepId] = executionPath;
      }

      // Extract resume labels from suspend payload metadata
      let resumeLabels;
      try {
        resumeLabels = normalizeEventedResumeLabels(prevResult.suspendPayload?.__workflow_meta?.resumeLabels ?? {});
      } catch (error) {
        return this.errorWorkflow(
          {
            ...lifecycleExecution,
            workflowId,
            runId,
            executionPath,
            resumeSteps,
            stepResults,
            prevResult,
            activeStepsPath,
            requestContext,
            timeTravel,
            restart,
            parentWorkflow,
            perStep,
            state: currentState,
            outputOptions,
            forEachIndex,
            nestedRunId,
          },
          getErrorFromUnknown(error),
        );
      }

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
          requestContext: getPersistedRequestContext(requestContext),
          executionGeneration: lifecycleExecution.executionGeneration,
        });

        const suspendTracingContext = this.resolveSuspendTracingContext(runId);
        await workflowsStore?.updateWorkflowState({
          workflowName: workflowId,
          runId,
          opts: {
            status: 'suspended',
            ...lifecycleExecution,
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
          ...lifecycleExecution,
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
            // Strip completion fields of the step's *previous* run (stale
            // suspend state, errors), then re-add this run's own result.
            ...omitPriorCompletionFields(prevResult),
            ...('output' in prevResult ? { output: prevResult.output } : {}),
            ...('endedAt' in prevResult && prevResult.endedAt !== undefined ? { endedAt: prevResult.endedAt } : {}),
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
          ...lifecycleExecution,
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
          ...lifecycleExecution,
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
        ...lifecycleExecution,
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
      const foreachStepResult = readForeachResult(stepResults, getEntryId(step.step));
      const originalArray = foreachStepResult?.payload;
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          ...lifecycleExecution,
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
        ...lifecycleExecution,
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
        type: 'workflow.step.run',
        runId,
        data: {
          ...lifecycleExecution,
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
   *   should acknowledge the event without redelivery.
   */
  async handle(event: Event): Promise<{ ok: true } | { ok: false; retry: boolean }> {
    const data = event.data as { workflowId?: unknown; runId?: unknown; executionGeneration?: unknown } | undefined;
    const workflowId = typeof data?.workflowId === 'string' ? data.workflowId : undefined;
    const runId = typeof data?.runId === 'string' ? data.runId : undefined;
    const internalEventGeneration =
      workflowId !== undefined && runId !== undefined
        ? this.mastra.__beginInternalWorkflowEvent(workflowId, runId)
        : undefined;
    let terminalEventHandled = false;
    const deliveryAttempt = this.#getDeliveryAttempt(event);
    try {
      if (typeof data?.executionGeneration !== 'string' || data.executionGeneration.length === 0) {
        this.mastra.getLogger()?.error('WorkflowEventProcessor.handle: dropping event without execution generation', {
          type: event.type,
          runId: event.runId,
          deliveryAttempt,
        });
        return { ok: false, retry: false };
      }

      // Once the transport-owned source budget is exhausted, later deliveries
      // may retry terminal failure publication only. This remains true when a
      // different worker or a new process receives the event because the broker
      // carries `deliveryAttempt` with the logical event.
      if (event.type !== 'workflow.fail' && deliveryAttempt > WorkflowEventProcessor.MAX_DELIVERY_ATTEMPTS) {
        return await this.#publishTerminalFailure(
          event,
          deliveryAttempt,
          new MastraError({
            id: 'MASTRA_WORKFLOW_EVENT_DELIVERY_EXHAUSTED',
            text: `Workflow event delivery budget exhausted for ${event.type}`,
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          }),
        );
      }

      terminalEventHandled = await this.#dispatch(event, internalEventGeneration);
      return { ok: true };
    } catch (err) {
      const exhausted = deliveryAttempt >= WorkflowEventProcessor.MAX_DELIVERY_ATTEMPTS;
      this.mastra.getLogger()?.error('WorkflowEventProcessor.handle: error processing event', {
        type: event.type,
        runId: event.runId,
        deliveryAttempt,
        maxDeliveryAttempts: WorkflowEventProcessor.MAX_DELIVERY_ATTEMPTS,
        phase: exhausted ? 'terminalizing' : 'source-retry',
        error: err,
      });

      // A terminal event must never recursively publish another
      // `workflow.fail`. Keep asking the transport to redeliver the existing
      // event so terminalization can recover when its dependency does.
      if (event.type === 'workflow.fail') {
        return { ok: false, retry: true };
      }

      if (!exhausted) {
        return { ok: false, retry: true };
      }

      return await this.#publishTerminalFailure(event, deliveryAttempt, getErrorFromUnknown(err));
    } finally {
      if (internalEventGeneration !== undefined) {
        this.mastra.__endInternalWorkflowEvent(workflowId!, runId!, internalEventGeneration, terminalEventHandled);
      }
    }
  }

  /**
   * Normalize transport delivery metadata without letting malformed values
   * reset the source-execution budget. Missing metadata and Google Pub/Sub's
   * documented `0` sentinel mean "not tracked" and use the first-delivery
   * fallback; other invalid metadata fails closed as exhausted.
   */
  #getDeliveryAttempt(event: Event): number {
    if (event.deliveryAttempt === undefined || event.deliveryAttempt === 0) return 1;
    if (Number.isSafeInteger(event.deliveryAttempt) && event.deliveryAttempt >= 1) {
      return event.deliveryAttempt;
    }

    this.mastra.getLogger()?.warn('WorkflowEventProcessor.handle: invalid deliveryAttempt', {
      type: event.type,
      runId: event.runId,
      deliveryAttempt: event.deliveryAttempt,
      fallback: 'exhausted',
    });
    return WorkflowEventProcessor.MAX_DELIVERY_ATTEMPTS + 1;
  }

  /**
   * Publish the terminal workflow failure. A publication error remains
   * retryable so the broker retains the source event; later deliveries enter
   * this method directly and never re-run source workflow dispatch.
   */
  async #publishTerminalFailure(
    event: Event,
    deliveryAttempt: number,
    error: Error,
  ): Promise<{ ok: false; retry: boolean }> {
    const workflowData = event.data as Omit<ProcessorArgs, 'workflow'> | undefined;
    if (!workflowData?.workflowId || !workflowData.runId) {
      this.mastra
        .getLogger()
        ?.error('WorkflowEventProcessor.handle: cannot terminalize event without workflow identity', {
          type: event.type,
          runId: event.runId,
          deliveryAttempt,
        });
      return { ok: false, retry: false };
    }

    let currentState: WorkflowRunState | null | undefined;
    let hasWorkflowsStore = false;
    try {
      const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
      if (workflowsStore) {
        hasWorkflowsStore = true;
        currentState = await workflowsStore.loadWorkflowSnapshot({
          workflowName: workflowData.workflowId,
          runId: workflowData.runId,
        });
      }
    } catch (stateError) {
      this.mastra.getLogger()?.error('WorkflowEventProcessor.handle: failed to verify run before terminalization', {
        type: event.type,
        runId: event.runId,
        deliveryAttempt,
        phase: 'terminalization-state-check',
        error: stateError,
      });
      return { ok: false, retry: true };
    }

    // A missing snapshot is not evidence that the delivery is stale. Preserve
    // the broker delivery so a later attempt can observe the snapshot or a
    // downstream durable journal can admit the event. Acknowledging here would
    // discard the only retained copy before either recovery path exists.
    if (hasWorkflowsStore && !currentState) {
      this.mastra.getLogger()?.warn('WorkflowEventProcessor.handle: run snapshot missing before terminalization', {
        type: event.type,
        runId: event.runId,
        deliveryAttempt,
        phase: 'terminalization-state-check',
      });
      return { ok: false, retry: true };
    }

    if (!workflowData.executionGeneration) {
      this.mastra.getLogger()?.error('WorkflowEventProcessor.handle: dropping terminal event without generation', {
        type: event.type,
        runId: event.runId,
        deliveryAttempt,
      });
      return { ok: false, retry: false };
    }

    if (currentState?.executionGeneration && currentState.executionGeneration !== workflowData.executionGeneration) {
      this.mastra.getLogger()?.debug?.('WorkflowEventProcessor.handle: skipping stale terminal generation', {
        type: event.type,
        runId: event.runId,
        deliveryAttempt,
        currentExecutionGeneration: currentState.executionGeneration,
        incomingExecutionGeneration: workflowData.executionGeneration,
      });
      return { ok: false, retry: false };
    }

    // A delayed exhausted delivery must not overwrite a run that completed,
    // failed, or was canceled through a newer event.
    if (currentState && !WorkflowEventProcessor.TERMINALIZABLE_RUN_STATUSES.has(currentState.status)) {
      this.mastra.getLogger()?.debug?.('WorkflowEventProcessor.handle: skipping stale terminal failure', {
        type: event.type,
        runId: event.runId,
        deliveryAttempt,
        runStatus: currentState.status,
      });
      return { ok: false, retry: false };
    }

    try {
      const executionGeneration = requireWorkflowExecutionGeneration(
        workflowData.executionGeneration,
        `Evented workflow terminal failure ${workflowData.workflowId}/${workflowData.runId}`,
      );
      await this.errorWorkflow(
        {
          ...workflowData,
          executionGeneration,
          lifecycleResumeAttempt: workflowData.lifecycleResumeAttempt ?? currentState?.lifecycleResumeAttempt ?? 0,
          lifecycleStepStates: mergeWorkflowStepLifecycleStates(
            workflowData.lifecycleStepStates,
            currentState?.executionGeneration === executionGeneration ? currentState.lifecycleStepStates : undefined,
          ),
        },
        error,
      );
      return { ok: false, retry: false };
    } catch (terminalError) {
      this.mastra
        .getLogger()
        ?.error('WorkflowEventProcessor.handle: failed to publish workflow.fail after retry exhaustion', {
          type: event.type,
          runId: event.runId,
          deliveryAttempt,
          phase: 'terminalization-pending',
          error: terminalError,
        });
      return { ok: false, retry: true };
    }
  }

  /**
   * @deprecated prefer {@link WorkflowEventProcessor.handle}, which returns a
   * structured result instead of relying on an ack callback. Kept as a thin
   * wrapper so existing pull-mode call sites continue to work.
   */
  async process(event: Event, ack?: () => Promise<void>) {
    const result = await this.handle(event);
    if (result.ok || !result.retry) {
      try {
        await ack?.();
      } catch (e) {
        this.mastra.getLogger()?.error('Error acking event', e);
      }
    }
  }

  async #dispatch(event: Event, internalWorkflowRegistrationGeneration?: number): Promise<boolean> {
    const { type, data } = event;

    const incomingWorkflowData = data as Omit<ProcessorArgs, 'workflow'>;

    const currentState = await this.loadData({
      workflowId: incomingWorkflowData.workflowId,
      runId: incomingWorkflowData.runId,
    });
    const executionGeneration = requireWorkflowExecutionGeneration(
      incomingWorkflowData.executionGeneration,
      `Evented workflow dispatch ${incomingWorkflowData.workflowId}/${incomingWorkflowData.runId}`,
    );
    if (currentState?.executionGeneration && currentState.executionGeneration !== executionGeneration) {
      this.mastra.getLogger()?.debug?.('WorkflowEventProcessor.handle: skipping stale execution generation', {
        type,
        runId: incomingWorkflowData.runId,
        currentExecutionGeneration: currentState.executionGeneration,
        incomingExecutionGeneration: executionGeneration,
      });
      return false;
    }
    const workflowData: Omit<ProcessorArgs, 'workflow'> = {
      ...incomingWorkflowData,
      executionGeneration,
      lifecycleIncomingStepStates: mergeWorkflowStepLifecycleStates(
        incomingWorkflowData.lifecycleStepStates,
        undefined,
      ),
      lifecycleAttemptBaselineCaptured: true,
      lifecycleResumeAttempt: incomingWorkflowData.lifecycleResumeAttempt ?? currentState?.lifecycleResumeAttempt ?? 0,
      lifecycleStepStates: mergeWorkflowStepLifecycleStates(
        incomingWorkflowData.lifecycleStepStates,
        currentState?.executionGeneration === executionGeneration ? currentState.lifecycleStepStates : undefined,
      ),
    };

    // Cancellation is monotonic. A delayed or duplicated cancel delivery must
    // never rewrite a success/failure outcome (or emit a contradictory
    // terminal lifecycle event) after the run has already completed.
    if (
      type === 'workflow.cancel' &&
      currentState &&
      WorkflowEventProcessor.TERMINAL_CHILD_RUN_STATUSES.has(currentState.status)
    ) {
      return false;
    }

    if (currentState?.status === 'canceled' && type !== 'workflow.end' && type !== 'workflow.cancel') {
      return false;
    }

    if (type.startsWith('workflow.user-event.')) {
      const userEventWorkflow = this.#tryResolveWorkflow(workflowData.workflowId);
      if (!userEventWorkflow) {
        // Workflow no longer registered (e.g. deleted from code). Treat as a
        // terminal failure rather than throwing — otherwise the transport
        // would redeliver this event indefinitely.
        await this.errorWorkflow(
          workflowData,
          new MastraError({
            id: 'MASTRA_WORKFLOW',
            text: `Workflow not found: ${workflowData.workflowId}`,
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          }),
        );
        return false;
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
      return false;
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
        await this.errorWorkflow(
          workflowData,
          new MastraError({
            id: 'MASTRA_WORKFLOW',
            text: `Workflow not found: ${workflowData.workflowId}`,
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          }),
        );
        return false;
      }
    }

    if (type === 'workflow.start' && workflow && !(await this.#ensureScheduledDefinitionMatches(data, workflow))) {
      return false;
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
          lifecycleStartKind: 'start',
        });
        break;
      case 'workflow.resume':
        await this.processWorkflowStart({
          workflow: workflowArg,
          ...workflowData,
          lifecycleStartKind: 'resume',
        });
        break;
      case 'workflow.end':
        await this.processWorkflowEnd({
          workflow: workflowArg,
          ...workflowData,
          internalWorkflowRegistrationGeneration,
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
          internalWorkflowRegistrationGeneration,
        });
        break;
      default:
        break;
    }
    return type === 'workflow.end' || type === 'workflow.fail';
  }
}
