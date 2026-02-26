import { RequestContext } from '../../di';
import type { SerializedError } from '../../error';
import type { PubSub } from '../../events/pubsub';
import type { TracingContext } from '../../observability';
import type { DefaultExecutionEngine } from '../default';
import type {
  EntryExecutionResult,
  ExecutionContext,
  OutputWriter,
  RestartExecutionParams,
  SerializedStepFlowEntry,
  StepFlowEntry,
  StepResult,
  TimeTravelExecutionParams,
  WorkflowRunStatus,
} from '../types';

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
    ? entrySteps.filter(s => s.type === 'step' && stepResults[s.step.id] !== undefined)
    : entrySteps;

  const allComplete = stepsToCheck.every(s => {
    if (s.type === 'step') {
      const r = stepResults[s.step.id];
      return r && r.status === 'success';
    }
    return true;
  });

  let result: any;
  if (allComplete) {
    result = {
      status: 'success',
      output: entrySteps.reduce((acc: Record<string, any>, s) => {
        if (s.type === 'step') {
          const r = stepResults[s.step.id];
          if (r && r.status === 'success') {
            acc[s.step.id] = r.output;
          }
        }
        return acc;
      }, {}),
    };
  } else {
    const stillSuspended = entrySteps.find(s => s.type === 'step' && stepResults[s.step.id]?.status === 'suspended');
    const suspendData =
      stillSuspended && stillSuspended.type === 'step' ? stepResults[stillSuspended.step.id]?.suspendPayload : {};
    result = {
      status: 'suspended',
      payload: suspendData,
      suspendPayload: suspendData,
      suspendedAt: Date.now(),
    };
  }

  if (result.status === 'suspended') {
    entrySteps.forEach((s, stepIndex) => {
      if (s.type === 'step' && stepResults[s.step.id]?.status === 'suspended') {
        executionContext.suspendedPaths[s.step.id] = [...executionContext.executionPath, stepIndex];
      }
    });
  }

  return result;
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
  } = params;

  const operationId = `workflow.${workflowId}.run.${runId}.path.${JSON.stringify(executionContext.executionPath)}.stepUpdate`;

  await engine.wrapDurableOperation(operationId, async () => {
    const shouldPersistSnapshot = engine.options?.shouldPersistSnapshot?.({ stepResults, workflowStatus });

    if (!shouldPersistSnapshot) {
      return;
    }

    const ctx = requestContext instanceof RequestContext ? requestContext : new RequestContext(requestContext);
    const requestContextObj: Record<string, any> = ctx.toJSON();

    const workflowsStore = await engine.mastra?.getStorage()?.getStore('workflows');
    await workflowsStore?.persistWorkflowSnapshot({
      workflowName: workflowId,
      runId,
      resourceId,
      snapshot: {
        runId,
        status: workflowStatus,
        value: executionContext.state,
        context: stepResults as any,
        activePaths: executionContext.executionPath,
        activeStepsPath: executionContext.activeStepsPath,
        serializedStepGraph,
        suspendedPaths: executionContext.suspendedPaths,
        waitingPaths: {},
        resumeLabels: executionContext.resumeLabels,
        result,
        error,
        requestContext: requestContextObj,
        timestamp: Date.now(),
      },
    });
  });
}

export interface ExecuteEntryParams {
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
  };
  executionContext: ExecutionContext;
  tracingContext: TracingContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
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
    entry,
    prevStep,
    serializedStepGraph,
    stepResults,
    restart,
    timeTravel,
    resume,
    executionContext,
    tracingContext,
    pubsub,
    abortController,
    requestContext,
    outputWriter,
    disableScorers,
    perStep,
  } = params;

  const prevOutput = engine.getStepOutput(stepResults, prevStep);
  let execResults: any;
  let entryRequestContext: Record<string, any> | undefined;

  if (entry.type === 'step') {
    const { step } = entry;
    const stepExecResult = await engine.executeStep({
      workflowId,
      runId,
      resourceId,
      step,
      stepResults,
      executionContext,
      timeTravel,
      restart,
      resume,
      prevOutput,
      tracingContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
      disableScorers,
      serializedStepGraph,
      perStep,
    });

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
        suspendedPaths: executionContext.suspendedPaths,
        resumeLabels: executionContext.resumeLabels,
        retryConfig: executionContext.retryConfig,
        activeStepsPath: executionContext.activeStepsPath,
        state: executionContext.state,
      },
      tracingContext,
      pubsub,
      abortController,
      requestContext,
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
      entry,
      prevStep,
      stepResults,
      serializedStepGraph,
      timeTravel,
      restart,
      resume,
      executionContext,
      tracingContext,
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
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,
          activeStepsPath: executionContext.activeStepsPath,
          state: executionContext.state,
        },
        tracingContext,
        pubsub,
        abortController,
        requestContext,
        outputWriter,
        disableScorers,
        perStep,
      });
    } else {
      // Use the step's stored payload from the snapshot as prevOutput, since the previous
      // step (e.g., a .map() step) may have a non-deterministic ID that doesn't match
      // between workflow constructions.
      const resumePrevOutput = stepResults[branchStep.step.id]?.payload ?? prevOutput;

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
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,
          activeStepsPath: executionContext.activeStepsPath,
          state: executionContext.state,
        },
        tracingContext,
        pubsub,
        abortController,
        requestContext,
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
      entry,
      prevOutput,
      stepResults,
      serializedStepGraph,
      timeTravel,
      restart,
      resume,
      executionContext,
      tracingContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
      disableScorers,
      perStep,
    });
  } else if (entry.type === 'loop') {
    execResults = await engine.executeLoop({
      workflowId,
      runId,
      entry,
      prevStep,
      prevOutput,
      stepResults,
      timeTravel,
      restart,
      resume,
      executionContext,
      tracingContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
      disableScorers,
      serializedStepGraph,
      perStep,
    });
  } else if (entry.type === 'foreach') {
    execResults = await engine.executeForeach({
      workflowId,
      runId,
      entry,
      prevStep,
      prevOutput,
      stepResults,
      timeTravel,
      restart,
      resume,
      executionContext,
      tracingContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
      disableScorers,
      serializedStepGraph,
      perStep,
    });
  } else if (entry.type === 'sleep') {
    const startedAt = Date.now();
    const sleepWaitingOperationId = `workflow.${workflowId}.run.${runId}.sleep.${entry.id}.waiting_ev`;
    await engine.wrapDurableOperation(sleepWaitingOperationId, async () => {
      await pubsub.publish(`workflow.events.v2.${runId}`, {
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
      tracingContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
    });

    delete executionContext.activeStepsPath[entry.id];

    await engine.persistStepUpdate({
      workflowId,
      runId,
      resourceId,
      serializedStepGraph,
      stepResults,
      executionContext,
      workflowStatus: 'running',
      requestContext,
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
      await pubsub.publish(`workflow.events.v2.${runId}`, {
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

      await pubsub.publish(`workflow.events.v2.${runId}`, {
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
  } else if (entry.type === 'sleepUntil') {
    const startedAt = Date.now();
    const sleepUntilWaitingOperationId = `workflow.${workflowId}.run.${runId}.sleepUntil.${entry.id}.waiting_ev`;
    await engine.wrapDurableOperation(sleepUntilWaitingOperationId, async () => {
      await pubsub.publish(`workflow.events.v2.${runId}`, {
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
      tracingContext,
      pubsub,
      abortController,
      requestContext,
      outputWriter,
    });

    delete executionContext.activeStepsPath[entry.id];

    await engine.persistStepUpdate({
      workflowId,
      runId,
      resourceId,
      serializedStepGraph,
      stepResults,
      executionContext,
      workflowStatus: 'running',
      requestContext,
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
      await pubsub.publish(`workflow.events.v2.${runId}`, {
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

      await pubsub.publish(`workflow.events.v2.${runId}`, {
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

  if (entry.type === 'step' || entry.type === 'loop' || entry.type === 'foreach') {
    stepResults[entry.step.id] = execResults;
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
  });

  if (execResults.status === 'canceled') {
    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: { type: 'workflow-canceled', payload: {} },
    });
  }

  return {
    result: execResults,
    stepResults,
    mutableContext: engine.buildMutableContext(executionContext),
    requestContext: entryRequestContext ?? engine.serializeRequestContext(requestContext),
  };
}
