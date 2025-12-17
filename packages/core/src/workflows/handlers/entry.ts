import type { RequestContext } from '../../di';
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

    const requestContextObj: Record<string, any> = {};
    requestContext.forEach((value, key) => {
      requestContextObj[key] = value;
    });

    await engine.mastra?.getStorage()?.persistWorkflowSnapshot({
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
        // @ts-ignore
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
  stepThrough?: boolean;
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
    stepThrough,
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
      stepThrough,
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
      stepThrough,
    });

    // After resuming one parallel step, check if ALL parallel steps are complete
    // Apply context changes from resumed step
    engine.applyMutableContext(executionContext, resumedStepResult.mutableContext);
    Object.assign(stepResults, resumedStepResult.stepResults);

    // Check the status of all parallel steps in this block
    const allParallelStepsComplete = entry.steps.every(parallelStep => {
      if (parallelStep.type === 'step') {
        const stepResult = stepResults[parallelStep.step.id];
        return stepResult && stepResult.status === 'success';
      }
      return true; // Non-step entries are considered complete
    });

    if (allParallelStepsComplete) {
      // All parallel steps are complete, return success for the parallel block
      execResults = {
        status: 'success',
        output: entry.steps.reduce((acc: Record<string, any>, parallelStep) => {
          if (parallelStep.type === 'step') {
            const stepResult = stepResults[parallelStep.step.id];
            if (stepResult && stepResult.status === 'success') {
              acc[parallelStep.step.id] = stepResult.output;
            }
          }
          return acc;
        }, {}),
      };
    } else {
      // Some parallel steps are still suspended, keep the parallel block suspended
      const stillSuspended = entry.steps.find(parallelStep => {
        if (parallelStep.type === 'step') {
          const stepResult = stepResults[parallelStep.step.id];
          return stepResult && stepResult.status === 'suspended';
        }
        return false;
      });
      execResults = {
        status: 'suspended',
        payload:
          stillSuspended && stillSuspended.type === 'step' ? stepResults[stillSuspended.step.id]?.suspendPayload : {},
      };
    }

    // For suspended parallel blocks, maintain suspended paths for non-resumed steps
    if (execResults.status === 'suspended') {
      entry.steps.forEach((parallelStep, stepIndex) => {
        if (parallelStep.type === 'step') {
          const stepResult = stepResults[parallelStep.step.id];
          if (stepResult && stepResult.status === 'suspended') {
            // Ensure this step remains in suspendedPaths
            executionContext.suspendedPaths[parallelStep.step.id] = [...executionContext.executionPath, stepIndex];
          }
        }
      });
    }

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
      stepThrough,
    });
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
      stepThrough,
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
      stepThrough,
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
      stepThrough,
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
