import type { ActorSignal } from '../../auth/ee';
import type { RequestContext } from '../../di';
import type { SerializedError } from '../../error';
import type { PubSub } from '../../events/pubsub';
import { resolveObservabilityContext } from '../../observability';
import type { ObservabilityContext } from '../../observability';
import type { DefaultExecutionEngine } from '../default';
import type {
  EntryExecutionResult,
  ExecutionContext,
  OutputWriter,
  RestartExecutionParams,
  SerializedStepFlowEntry,
  StepFailure,
  StepFlowEntry,
  StepResult,
  TimeTravelExecutionParams,
  WorkflowRunStatus,
  WorkflowRunState,
} from '../types';
import { getSingleStepEntryId, isSingleStepEntry } from '../utils';

function publishStepEvent(
  engine: DefaultExecutionEngine,
  pubsub: PubSub,
  ...args: Parameters<PubSub['publish']>
): Promise<void> {
  return engine.options.emitStepEvents === false ? Promise.resolve() : pubsub.publish(...args);
}

/**
 * After resuming a single step within a parallel or conditional block, check whether
 * all relevant branch steps are now complete and build the appropriate block-level result.
 *
 * For parallel blocks every step must complete; for conditional blocks only the steps
 * that were actually executed (have entries in stepResults) are considered.
 */
function buildResumedBlockResult(
  entrySteps: StepFlowEntry[],
  stepResults: Record<string, StepResult<any, any, any, any>>,
  executionContext: ExecutionContext,
  opts?: { onlyExecutedSteps?: boolean },
): any {
  const stepsToCheck = opts?.onlyExecutedSteps
    ? entrySteps.filter(s => isSingleStepEntry(s) && stepResults[getSingleStepEntryId(s)] !== undefined)
    : entrySteps;

  const allComplete = stepsToCheck.every(s => {
    if (isSingleStepEntry(s)) {
      const r = stepResults[getSingleStepEntryId(s)];
      return r && r.status === 'success';
    }
    return true;
  });

  let result: any;
  if (allComplete) {
    result = {
      status: 'success',
      output: entrySteps.reduce((acc: Record<string, any>, s) => {
        if (isSingleStepEntry(s)) {
          const id = getSingleStepEntryId(s);
          const r = stepResults[id];
          if (r && r.status === 'success') {
            acc[id] = r.output;
          }
        }
        return acc;
      }, {}),
    };
  } else {
    // Check for failed steps before assuming suspended
    const failedStep = stepsToCheck.find(
      s => isSingleStepEntry(s) && stepResults[getSingleStepEntryId(s)]?.status === 'failed',
    );
    if (failedStep && isSingleStepEntry(failedStep)) {
      const failedResult = stepResults[getSingleStepEntryId(failedStep)] as StepFailure<any, any, any, any> | undefined;
      result = {
        status: 'failed',
        error: failedResult?.error ?? new Error('Workflow step failed after resume'),
        tripwire: failedResult?.tripwire,
      };
    } else {
      const stillSuspended = entrySteps.find(
        s => isSingleStepEntry(s) && stepResults[getSingleStepEntryId(s)]?.status === 'suspended',
      );
      const suspendData =
        stillSuspended && isSingleStepEntry(stillSuspended)
          ? stepResults[getSingleStepEntryId(stillSuspended)]?.suspendPayload
          : {};
      result = {
        status: 'suspended',
        payload: suspendData,
        suspendPayload: suspendData,
        suspendedAt: Date.now(),
      };
    }
  }

  if (result.status === 'suspended') {
    entrySteps.forEach((s, stepIndex) => {
      if (isSingleStepEntry(s) && stepResults[getSingleStepEntryId(s)]?.status === 'suspended') {
        executionContext.suspendedPaths[getSingleStepEntryId(s)] = [...executionContext.executionPath, stepIndex];
      }
    });
  }

  return result;
}

function getResumeStepPrevOutput({
  isResumedStep,
  stepId,
  stepResults,
  prevOutput,
}: {
  isResumedStep: boolean;
  stepId: string;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  prevOutput: any;
}) {
  if (!isResumedStep) {
    return prevOutput;
  }

  const stepResult = stepResults[stepId];
  return stepResult && Object.prototype.hasOwnProperty.call(stepResult, 'payload') ? stepResult.payload : prevOutput;
}

export interface PersistStepUpdateParams {
  workflowId: string;
  runId: string;
  resourceId?: string;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  serializedStepGraph: SerializedStepFlowEntry[];
  executionContext: ExecutionContext;
  workflowStatus: WorkflowRunStatus;
  result?: Record<string, any>;
  error?: SerializedError;
  requestContext: RequestContext;
  /**
   * Tracing context for span continuity during suspend/resume.
   * When provided, this will be persisted to the snapshot for use on resume.
   */
  tracingContext?: {
    traceId?: string;
    spanId?: string;
    parentSpanId?: string;
  };
  /**
   * Phase suffix appended to the durable operation ID to prevent duplicate
   * step IDs when persistStepUpdate is called multiple times for the same
   * execution path (e.g. 'start' before execution, 'entry-end' after).
   *
   * Every call site must pass a phase that is unique among the persists that
   * can run for one execution path in a single execution; otherwise replay
   * engines (Inngest) see duplicate step IDs. Optional only for backward
   * compatibility with external callers.
   */
  phase?: string;
}

export async function persistStepUpdate(
  engine: DefaultExecutionEngine,
  params: PersistStepUpdateParams,
): Promise<void> {
  const {
    workflowId,
    runId,
    resourceId,
    stepResults,
    serializedStepGraph,
    executionContext,
    workflowStatus,
    result,
    error,
    requestContext,
    tracingContext,
    phase,
  } = params;

  const operationId = `workflow.${workflowId}.run.${runId}.path.${JSON.stringify(executionContext.executionPath)}.stepUpdate${phase ? `.${phase}` : ''}`;

  await engine.wrapDurableOperation(operationId, async () => {
    // A run-scoped override (e.g. the transient per-chunk runs of a workflow used as an
    // agent output processor, #19605) wins over the workflow-wide option.
    const persistencePredicate = engine.getRunPersistenceOverride(runId) ?? engine.options?.shouldPersistSnapshot;
    const shouldPersistSnapshot = persistencePredicate?.({ stepResults, workflowStatus });

    if (!shouldPersistSnapshot) {
      return;
    }

    // Guard: never overwrite a `suspended` / `paused` snapshot with a later
    // `running` update from the same run. During resume the loop transitions
    // suspended → running mid-execution, and any step-update write would
    // otherwise clobber the suspend record before the resume actually
    // completes. The engine tracks its own last-persisted status for this
    // run (process-local) so we don't need an extra storage read per step.
    if (workflowStatus === 'running') {
      const lastPersisted = engine.getLastPersistedStatus(runId);
      if (lastPersisted === 'suspended' || lastPersisted === 'paused') {
        return;
      }
    }

    const requestContextObj = engine.serializeRequestContext(requestContext);

    const snapshot: WorkflowRunState = {
      runId,
      status: workflowStatus,
      value: executionContext.state,
      context: stepResults as any,
      activePaths: executionContext.executionPath,
      stepExecutionPath: executionContext.stepExecutionPath,
      activeStepsPath: executionContext.activeStepsPath,
      serializedStepGraph,
      suspendedPaths: executionContext.suspendedPaths,
      waitingPaths: {},
      resumeLabels: executionContext.resumeLabels,
      result,
      error,
      requestContext: requestContextObj,
      timestamp: Date.now(),
      // Persist tracing context for span continuity on resume
      tracingContext,
    };

    const workflowsStore = await engine.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: workflowId,
      runId,
      resourceId,
      snapshot: engine.options?.pruneSnapshot ? engine.options.pruneSnapshot({ snapshot, workflowStatus }) : snapshot,
    });
    engine.setLastPersistedStatus(runId, workflowStatus);
  });
}

export interface ExecuteEntryParams extends ObservabilityContext {
  workflowId: string;
  runId: string;
  resourceId?: string;
  entry: StepFlowEntry;
  prevStep: StepFlowEntry;
  serializedStepGraph: SerializedStepFlowEntry[];
  stepResults: Record<string, StepResult<any, any, any, any>>;
  restart?: RestartExecutionParams;
  timeTravel?: TimeTravelExecutionParams;
  resume?: {
    steps: string[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resumePayload: any;
    resumePath: number[];
    forEachIndex?: number;
  };
  executionContext: ExecutionContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
  actor?: ActorSignal;
  outputWriter?: OutputWriter;
  disableScorers?: boolean;
  perStep?: boolean;
}

export async function executeEntry(
  engine: DefaultExecutionEngine,
  params: ExecuteEntryParams,
): Promise<EntryExecutionResult> {
  const {
    workflowId,
    runId,
    resourceId,
    entry: rawEntry,
    prevStep,
    serializedStepGraph,
    stepResults,
    restart,
    timeTravel,
    resume,
    executionContext,
    pubsub,
    abortController,
    requestContext,
    actor,
    outputWriter,
    disableScorers,
    perStep,
    ...rest
  } = params;
  const observabilityContext = resolveObservabilityContext(rest);

  const entry = rawEntry;

  const prevOutput = engine.getStepOutput(stepResults, prevStep);
  let execResults: any;
  let entryRequestContext: Record<string, any> | undefined;

  if (isSingleStepEntry(entry)) {
    // The engine dispatches by step type: a plain `step` runs as-is, while the
    // declarative `agent` / `tool` / `mapping` variants each have their own
    // execute method that resolves and runs the step. Resume bookkeeping keys
    // off the entry id and is shared across all single-step kinds.
    const stepId = getSingleStepEntryId(entry);
    const isResumedStep = resume?.steps?.includes(stepId) ?? false;
    if (!isResumedStep) {
      executionContext.stepExecutionPath?.push(stepId);
    }
    const stepPrevOutput = getResumeStepPrevOutput({
      isResumedStep,
      stepId,
      stepResults,
      prevOutput,
    });
    const singleStepParams = {
      workflowId,
      runId,
      resourceId,
      stepResults,
      executionContext,
      timeTravel,
      restart,
      resume,
      prevOutput: stepPrevOutput,
      ...observabilityContext,
      pubsub,
      abortController,
      requestContext,
      actor,
      outputWriter,
      disableScorers,
      serializedStepGraph,
      perStep,
    };
    const stepExecResult =
      entry.type === 'step'
        ? await engine.executeStep({ ...singleStepParams, step: entry.step })
        : entry.type === 'agent'
          ? await engine.executeAgent({ ...singleStepParams, entry })
          : entry.type === 'tool'
            ? await engine.executeTool({ ...singleStepParams, entry })
            : await engine.executeMapping({ ...singleStepParams, entry });

    // Extract result and apply context changes
    execResults = stepExecResult.result;
    engine.applyMutableContext(executionContext, stepExecResult.mutableContext);
    Object.assign(stepResults, stepExecResult.stepResults);
    entryRequestContext = stepExecResult.requestContext;
  } else if (resume?.resumePath?.length && entry.type === 'parallel') {
    const idx = resume.resumePath.shift();
    const resumedStepResult = await executeEntry(engine, {
      workflowId,
      runId,
      resourceId,
      entry: entry.steps[idx!]!,
      prevStep,
      serializedStepGraph,
      stepResults,
      resume,
      executionContext: {
        workflowId,
        runId,
        executionPath: [...executionContext.executionPath, idx!],
        stepExecutionPath: executionContext.stepExecutionPath ? [...executionContext.stepExecutionPath] : undefined,
        suspendedPaths: executionContext.suspendedPaths,
        resumeLabels: executionContext.resumeLabels,
        retryConfig: executionContext.retryConfig,
        activeStepsPath: executionContext.activeStepsPath,
        state: executionContext.state,
      },
      ...observabilityContext,
      pubsub,
      abortController,
      requestContext,
      actor,
      outputWriter,
      disableScorers,
      perStep,
    });

    // Apply context changes from resumed step
    engine.applyMutableContext(executionContext, resumedStepResult.mutableContext);
    Object.assign(stepResults, resumedStepResult.stepResults);

    execResults = buildResumedBlockResult(entry.steps, stepResults, executionContext);

    return {
      result: execResults,
      stepResults,
      mutableContext: engine.buildMutableContext(executionContext),
      requestContext: resumedStepResult.requestContext,
    };
  } else if (entry.type === 'parallel') {
    execResults = await engine.executeParallel({
      workflowId,
      runId,
      resourceId,
      entry,
      prevStep,
      stepResults,
      serializedStepGraph,
      timeTravel,
      restart,
      resume,
      executionContext,
      ...observabilityContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
      disableScorers,
      perStep,
    });
  } else if (resume?.resumePath?.length && entry.type === 'conditional') {
    // Resume-aware handling for conditional entries: skip condition re-evaluation
    // and go directly to the branch step identified by the resume path.
    // This mirrors the parallel resume handling above.
    const idx = resume.resumePath.shift();
    const branchStep = entry.steps[idx!]!;

    let branchResult: EntryExecutionResult;

    if (branchStep.type !== 'step') {
      // Recurse through executeEntry for nested block types (parallel, conditional, etc.)
      branchResult = await executeEntry(engine, {
        workflowId,
        runId,
        resourceId,
        entry: branchStep,
        prevStep,
        serializedStepGraph,
        stepResults,
        resume,
        executionContext: {
          workflowId,
          runId,
          executionPath: [...executionContext.executionPath, idx!],
          stepExecutionPath: executionContext.stepExecutionPath ? [...executionContext.stepExecutionPath] : undefined,
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,
          activeStepsPath: executionContext.activeStepsPath,
          state: executionContext.state,
        },
        ...observabilityContext,
        pubsub,
        abortController,
        requestContext,
        actor,
        outputWriter,
        disableScorers,
        perStep,
      });
    } else {
      const resumePrevOutput = getResumeStepPrevOutput({
        isResumedStep: true,
        stepId: branchStep.step.id,
        stepResults,
        prevOutput,
      });

      branchResult = await engine.executeStep({
        workflowId,
        runId,
        resourceId,
        step: branchStep.step,
        prevOutput: resumePrevOutput,
        stepResults,
        serializedStepGraph,
        resume,
        restart,
        timeTravel,
        executionContext: {
          workflowId,
          runId,
          executionPath: [...executionContext.executionPath, idx!],
          stepExecutionPath: executionContext.stepExecutionPath ? [...executionContext.stepExecutionPath] : undefined,
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,
          activeStepsPath: executionContext.activeStepsPath,
          state: executionContext.state,
        },
        ...observabilityContext,
        pubsub,
        abortController,
        requestContext,
        actor,
        outputWriter,
        disableScorers,
        perStep,
      });
    }

    // Apply context changes from resumed step
    engine.applyMutableContext(executionContext, branchResult.mutableContext);
    Object.assign(stepResults, branchResult.stepResults);

    // For conditionals, only check steps that were actually executed (have results).
    // Branches whose conditions were false during initial execution should be ignored.
    execResults = buildResumedBlockResult(entry.steps, stepResults, executionContext, { onlyExecutedSteps: true });

    return {
      result: execResults,
      stepResults,
      mutableContext: engine.buildMutableContext(executionContext),
      requestContext: branchResult.requestContext,
    };
  } else if (entry.type === 'conditional') {
    execResults = await engine.executeConditional({
      workflowId,
      runId,
      resourceId,
      entry,
      prevOutput,
      stepResults,
      serializedStepGraph,
      timeTravel,
      restart,
      resume,
      executionContext,
      ...observabilityContext,
      pubsub,
      abortController,
      requestContext,
      actor,
      outputWriter,
      disableScorers,
      perStep,
    });
  } else if (entry.type === 'loop') {
    execResults = await engine.executeLoop({
      workflowId,
      runId,
      resourceId,
      entry,
      prevStep,
      prevOutput,
      stepResults,
      timeTravel,
      restart,
      resume,
      executionContext,
      ...observabilityContext,
      pubsub,
      abortController,
      requestContext,
      actor,
      outputWriter,
      disableScorers,
      serializedStepGraph,
      perStep,
    });
  } else if (entry.type === 'foreach') {
    const foreachStepId = getSingleStepEntryId(entry.step);
    const foreachPrevOutput = getResumeStepPrevOutput({
      isResumedStep: resume?.steps?.includes(foreachStepId) ?? false,
      stepId: foreachStepId,
      stepResults,
      prevOutput,
    });

    execResults = await engine.executeForeach({
      workflowId,
      runId,
      resourceId,
      entry,
      prevStep,
      prevOutput: foreachPrevOutput,
      stepResults,
      timeTravel,
      restart,
      resume,
      executionContext,
      ...observabilityContext,
      pubsub,
      abortController,
      requestContext,
      actor,
      outputWriter,
      disableScorers,
      serializedStepGraph,
      perStep,
    });
  } else if (entry.type === 'sleep') {
    executionContext.stepExecutionPath?.push(entry.id);
    const startedAt = Date.now();
    const sleepWaitingOperationId = `workflow.${workflowId}.run.${runId}.sleep.${entry.id}.waiting_ev`;
    await engine.wrapDurableOperation(sleepWaitingOperationId, async () => {
      await publishStepEvent(engine, pubsub, `workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-waiting',
          payload: {
            id: entry.id,
            payload: prevOutput,
            startedAt,
            status: 'waiting',
          },
        },
      });
    });
    stepResults[entry.id] = {
      status: 'waiting',
      payload: prevOutput,
      startedAt,
    };
    executionContext.activeStepsPath[entry.id] = executionContext.executionPath;
    await engine.persistStepUpdate({
      workflowId,
      runId,
      resourceId,
      serializedStepGraph,
      stepResults,
      executionContext,
      workflowStatus: 'waiting',
      requestContext,
      phase: 'sleep-waiting',
    });

    await engine.executeSleep({
      workflowId,
      runId,
      entry,
      prevStep,
      prevOutput,
      stepResults,
      serializedStepGraph,
      resume,
      executionContext,
      ...observabilityContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
    });

    delete executionContext.activeStepsPath[entry.id];

    if (abortController?.signal?.aborted) {
      execResults = { status: 'canceled' };
    } else {
      await engine.persistStepUpdate({
        workflowId,
        runId,
        resourceId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'running',
        requestContext,
        phase: 'sleep-end',
      });

      const endedAt = Date.now();
      const stepInfo = {
        payload: prevOutput,
        startedAt,
        endedAt,
      };

      execResults = { ...stepInfo, status: 'success', output: prevOutput };
      stepResults[entry.id] = { ...stepInfo, status: 'success', output: prevOutput };
      const sleepResultOperationId = `workflow.${workflowId}.run.${runId}.sleep.${entry.id}.result_ev`;
      await engine.wrapDurableOperation(sleepResultOperationId, async () => {
        await publishStepEvent(engine, pubsub, `workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-result',
            payload: {
              id: entry.id,
              endedAt,
              status: 'success',
              output: prevOutput,
            },
          },
        });

        await publishStepEvent(engine, pubsub, `workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-finish',
            payload: {
              id: entry.id,
              metadata: {},
            },
          },
        });
      });
    }
  } else if (entry.type === 'sleepUntil') {
    executionContext.stepExecutionPath?.push(entry.id);
    const startedAt = Date.now();
    const sleepUntilWaitingOperationId = `workflow.${workflowId}.run.${runId}.sleepUntil.${entry.id}.waiting_ev`;
    await engine.wrapDurableOperation(sleepUntilWaitingOperationId, async () => {
      await publishStepEvent(engine, pubsub, `workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-waiting',
          payload: {
            id: entry.id,
            payload: prevOutput,
            startedAt,
            status: 'waiting',
          },
        },
      });
    });

    stepResults[entry.id] = {
      status: 'waiting',
      payload: prevOutput,
      startedAt,
    };
    executionContext.activeStepsPath[entry.id] = executionContext.executionPath;

    await engine.persistStepUpdate({
      workflowId,
      runId,
      resourceId,
      serializedStepGraph,
      stepResults,
      executionContext,
      workflowStatus: 'waiting',
      requestContext,
      phase: 'sleep-until-waiting',
    });

    await engine.executeSleepUntil({
      workflowId,
      runId,
      entry,
      prevStep,
      prevOutput,
      stepResults,
      serializedStepGraph,
      resume,
      executionContext,
      ...observabilityContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
    });

    delete executionContext.activeStepsPath[entry.id];

    if (abortController?.signal?.aborted) {
      execResults = { status: 'canceled' };
    } else {
      await engine.persistStepUpdate({
        workflowId,
        runId,
        resourceId,
        serializedStepGraph,
        stepResults,
        executionContext,
        workflowStatus: 'running',
        requestContext,
        phase: 'sleep-until-end',
      });

      const endedAt = Date.now();
      const stepInfo = {
        payload: prevOutput,
        startedAt,
        endedAt,
      };

      execResults = { ...stepInfo, status: 'success', output: prevOutput };
      stepResults[entry.id] = { ...stepInfo, status: 'success', output: prevOutput };

      const sleepUntilResultOperationId = `workflow.${workflowId}.run.${runId}.sleepUntil.${entry.id}.result_ev`;
      await engine.wrapDurableOperation(sleepUntilResultOperationId, async () => {
        await publishStepEvent(engine, pubsub, `workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-result',
            payload: {
              id: entry.id,
              endedAt,
              status: 'success',
              output: prevOutput,
            },
          },
        });

        await publishStepEvent(engine, pubsub, `workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-finish',
            payload: {
              id: entry.id,
              metadata: {},
            },
          },
        });
      });
    }
  }

  if (isSingleStepEntry(entry)) {
    stepResults[getSingleStepEntryId(entry)] = execResults;
  } else if (entry.type === 'loop' || entry.type === 'foreach') {
    stepResults[getSingleStepEntryId(entry.step)] = execResults;
  }

  if (abortController?.signal?.aborted) {
    execResults = { ...execResults, status: 'canceled' };
  }

  await engine.persistStepUpdate({
    workflowId,
    runId,
    resourceId,
    serializedStepGraph,
    stepResults,
    executionContext,
    workflowStatus: execResults.status === 'success' ? 'running' : execResults.status,
    requestContext,
    phase: 'entry-end',
  });

  if (execResults.status === 'canceled') {
    await publishStepEvent(engine, pubsub, `workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: { type: 'workflow-canceled', payload: {} },
    });
  }

  return {
    result: execResults,
    stepResults,
    mutableContext: engine.buildMutableContext(executionContext),
    // Serialize requestContext only for engines that restore it from serialized
    // results (Inngest memoization). The default engine keeps the original
    // reference and never reads this field, so serializing here would be pure
    // per-entry overhead — RequestContext.toJSON() probes every stored value
    // with JSON.stringify.
    requestContext:
      entryRequestContext ??
      (engine.requiresDurableContextSerialization() ? engine.serializeRequestContext(requestContext) : undefined),
  };
}
