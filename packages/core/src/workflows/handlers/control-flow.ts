import { randomUUID } from 'node:crypto';
import fastq from 'fastq';
import type { done as DoneCallback } from 'fastq';
import type { ActorSignal } from '../../auth/ee';
import type { RequestContext } from '../../di';
import { MastraError, ErrorDomain, ErrorCategory, getErrorFromUnknown } from '../../error';
import type { PubSub } from '../../events/pubsub';
import { SpanType, createObservabilityContext, resolveObservabilityContext } from '../../observability';
import type { ObservabilityContext } from '../../observability';
import { ToolStream } from '../../tools/stream';
import { selectFields } from '../../utils';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import type { DefaultExecutionEngine } from '../default';
import type { ConditionFunction, InnerOutput, LoopConditionFunction } from '../step';
import { getStepResult } from '../step';
import { getEntryId } from '../step-entry';
import type {
  DefaultEngineType,
  ExecutionContext,
  ForeachOptions,
  OutputWriter,
  RestartExecutionParams,
  SerializedStepFlowEntry,
  SingleStepEntry,
  StepFailure,
  StepFlowEntry,
  StepResult,
  StepSuccess,
  StepSuspended,
  TimeTravelExecutionParams,
} from '../types';
import {
  createDeprecationProxy,
  runCountDeprecationMessage,
  getResumeLabelsByStepId,
  getSingleStepEntryId,
  resolveForeachConcurrency,
} from '../utils';
import type { ExecuteStepParams } from './step';

/**
 * Runs one child of a parallel/conditional block by dispatching on its step type
 * to the matching engine execute method - the same per-type dispatch the engine
 * uses for top-level entries.
 */
function executeChildEntry(
  engine: DefaultExecutionEngine,
  child: SingleStepEntry,
  params: Omit<ExecuteStepParams, 'step'>,
) {
  switch (child.type) {
    case 'step':
      return engine.executeStep({ ...params, step: child.step });
    case 'agent':
      return engine.executeAgent({ ...params, entry: child });
    case 'tool':
      return engine.executeTool({ ...params, entry: child });
    case 'mapping':
      return engine.executeMapping({ ...params, entry: child });
  }
}

export interface ExecuteParallelParams extends ObservabilityContext {
  workflowId: string;
  runId: string;
  resourceId?: string;
  entry: {
    type: 'parallel';
    steps: SingleStepEntry[];
  };
  serializedStepGraph: SerializedStepFlowEntry[];
  prevStep: StepFlowEntry;
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
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
  actor?: ActorSignal;
  outputWriter?: OutputWriter;
  disableScorers?: boolean;
  perStep?: boolean;
}

export async function executeParallel(
  engine: DefaultExecutionEngine,
  params: ExecuteParallelParams,
): Promise<StepResult<any, any, any, any>> {
  const {
    workflowId,
    runId,
    resourceId,
    entry,
    prevStep,
    serializedStepGraph,
    stepResults,
    resume,
    restart,
    timeTravel,
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

  const steps = entry.steps;

  const parallelSpan = await engine.createChildSpan({
    parentSpan: observabilityContext.tracingContext.currentSpan,
    operationId: `workflow.${workflowId}.run.${runId}.parallel.${executionContext.executionPath.join('-')}.span.start`,
    options: {
      type: SpanType.WORKFLOW_PARALLEL,
      name: `parallel: '${steps.length} branches'`,
      input: engine.getStepOutput(stepResults, prevStep),
      attributes: {
        branchCount: steps.length,
        parallelSteps: steps.map(s => getSingleStepEntryId(s)),
      },
      tracingPolicy: engine.options?.tracingPolicy,
    },
    executionContext,
  });

  const prevOutput = engine.getStepOutput(stepResults, prevStep);
  for (const [stepIndex, step] of steps.entries()) {
    const stepId = getSingleStepEntryId(step);
    let makeStepRunning = true;
    if (restart) {
      makeStepRunning = !!restart.activeStepsPath[stepId];
    }
    if (timeTravel && timeTravel.executionPath.length > 0) {
      makeStepRunning = timeTravel.steps[0] === stepId;
    }
    if (!makeStepRunning) {
      break;
    }
    const startTime = resume?.steps[0] === stepId ? undefined : Date.now();
    const resumeTime = resume?.steps[0] === stepId ? Date.now() : undefined;
    stepResults[stepId] = {
      ...stepResults[stepId],
      status: 'running',
      ...(resumeTime ? { resumePayload: resume?.resumePayload } : { payload: prevOutput }),
      ...(startTime ? { startedAt: startTime } : {}),
      ...(resumeTime ? { resumedAt: resumeTime } : {}),
    } as StepResult<any, any, any, any>;
    executionContext.activeStepsPath[stepId] = [...executionContext.executionPath, stepIndex];
    if (perStep) {
      break;
    }
  }

  if (timeTravel && timeTravel.executionPath.length > 0) {
    timeTravel.executionPath.shift();
  }

  let execResults: any;
  const results: StepResult<any, any, any, any>[] = await Promise.all(
    steps.map(async (step, i) => {
      const stepId = getSingleStepEntryId(step);
      const currStepResult = stepResults[stepId];
      if (currStepResult && currStepResult.status !== 'running') {
        return currStepResult;
      }
      if (!currStepResult && (perStep || timeTravel)) {
        return {} as StepResult<any, any, any, any>;
      }
      const stepExecResult = await executeChildEntry(engine, step, {
        workflowId,
        runId,
        resourceId,
        prevOutput,
        stepResults,
        serializedStepGraph,
        restart,
        timeTravel,
        resume,
        executionContext: {
          activeStepsPath: executionContext.activeStepsPath,
          workflowId,
          runId,
          executionPath: [...executionContext.executionPath, i],
          stepExecutionPath: executionContext.stepExecutionPath,
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,
          state: executionContext.state,
          tracingIds: executionContext.tracingIds,
        },
        ...createObservabilityContext({ currentSpan: parallelSpan }),
        pubsub,
        abortController,
        requestContext,
        actor,
        outputWriter,
        disableScorers,
        perStep,
      });
      // Apply context changes from parallel step execution
      engine.applyMutableContext(executionContext, stepExecResult.mutableContext);
      Object.assign(stepResults, stepExecResult.stepResults);
      return stepExecResult.result;
    }),
  );
  const hasFailed = results.find(result => result.status === 'failed') as StepFailure<any, any, any, any>;

  const hasSuspended = results.find(result => result.status === 'suspended');
  if (hasFailed) {
    // Preserve tripwire property for proper status conversion in fmtReturnValue
    execResults = {
      status: 'failed',
      error: hasFailed.error,
      tripwire: (hasFailed as any).tripwire,
    };
  } else if (hasSuspended) {
    execResults = {
      status: 'suspended',
      suspendPayload: hasSuspended.suspendPayload,
      ...(hasSuspended.suspendOutput ? { suspendOutput: hasSuspended.suspendOutput } : {}),
    };
  } else if (abortController?.signal?.aborted) {
    execResults = { status: 'canceled' };
  } else {
    execResults = {
      status: 'success',
      output: results.reduce((acc: Record<string, any>, result, index) => {
        if (result.status === 'success') {
          acc[getSingleStepEntryId(steps[index]!)] = result.output;
        }

        return acc;
      }, {}),
    };
  }

  if (execResults.status === 'failed') {
    await engine.errorChildSpan({
      span: parallelSpan,
      operationId: `workflow.${workflowId}.run.${runId}.parallel.${executionContext.executionPath.join('-')}.span.error`,
      errorOptions: { error: execResults.error },
    });
  } else {
    await engine.endChildSpan({
      span: parallelSpan,
      operationId: `workflow.${workflowId}.run.${runId}.parallel.${executionContext.executionPath.join('-')}.span.end`,
      endOptions: { output: execResults.output || execResults },
    });
  }

  return execResults;
}

export interface ExecuteConditionalParams extends ObservabilityContext {
  workflowId: string;
  runId: string;
  resourceId?: string;
  serializedStepGraph: SerializedStepFlowEntry[];
  entry: {
    type: 'conditional';
    steps: SingleStepEntry[];
    conditions: ConditionFunction<any, any, any, any, any, DefaultEngineType>[];
  };
  prevOutput: any;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  resume?: {
    steps: string[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resumePayload: any;
    resumePath: number[];
  };
  restart?: RestartExecutionParams;
  timeTravel?: TimeTravelExecutionParams;
  executionContext: ExecutionContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
  actor?: ActorSignal;
  outputWriter?: OutputWriter;
  disableScorers?: boolean;
  perStep?: boolean;
}

export async function executeConditional(
  engine: DefaultExecutionEngine,
  params: ExecuteConditionalParams,
): Promise<StepResult<any, any, any, any>> {
  const {
    workflowId,
    runId,
    resourceId,
    entry,
    prevOutput,
    serializedStepGraph,
    stepResults,
    resume,
    restart,
    timeTravel,
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

  const steps = entry.steps;

  const conditionalSpan = await engine.createChildSpan({
    parentSpan: observabilityContext.tracingContext.currentSpan,
    operationId: `workflow.${workflowId}.run.${runId}.conditional.${executionContext.executionPath.join('-')}.span.start`,
    options: {
      type: SpanType.WORKFLOW_CONDITIONAL,
      name: `conditional: '${entry.conditions.length} conditions'`,
      input: prevOutput,
      attributes: {
        conditionCount: entry.conditions.length,
      },
      tracingPolicy: engine.options?.tracingPolicy,
    },
    executionContext,
  });

  let execResults: any;
  const truthyIndexes = (
    await Promise.all(
      entry.conditions.map(async (cond, index) => {
        const evalSpan = await engine.createChildSpan({
          parentSpan: conditionalSpan,
          operationId: `workflow.${workflowId}.run.${runId}.conditional.${executionContext.executionPath.join('-')}.eval.${index}.span.start`,
          options: {
            type: SpanType.WORKFLOW_CONDITIONAL_EVAL,
            name: `condition '${index}'`,
            input: prevOutput,
            attributes: {
              conditionIndex: index,
            },
            tracingPolicy: engine.options?.tracingPolicy,
          },
          executionContext,
        });

        const operationId = `workflow.${workflowId}.conditional.${index}`;
        const context = createDeprecationProxy(
          {
            runId,
            workflowId,
            mastra: engine.mastra!,
            requestContext,
            actor,
            inputData: prevOutput,
            state: executionContext.state,
            retryCount: -1,
            ...createObservabilityContext({ currentSpan: evalSpan }),
            getInitData: () => stepResults?.input as any,
            getStepResult: getStepResult.bind(null, stepResults),
            bail: (() => {}) as () => InnerOutput,
            abort: () => {
              abortController?.abort();
            },
            [PUBSUB_SYMBOL]: pubsub,
            [STREAM_FORMAT_SYMBOL]: executionContext.format,
            engine: engine.getEngineContext(),
            abortSignal: abortController?.signal,
            writer: new ToolStream(
              {
                prefix: 'workflow-step',
                callId: randomUUID(),
                name: 'conditional',
                runId,
              },
              outputWriter,
            ),
          },
          {
            paramName: 'runCount',
            deprecationMessage: runCountDeprecationMessage,
            logger: engine.getLogger(),
          },
        );

        try {
          const result = await engine.evaluateCondition(cond, index, context, operationId);

          await engine.endChildSpan({
            span: evalSpan,
            operationId: `workflow.${workflowId}.run.${runId}.conditional.${executionContext.executionPath.join('-')}.eval.${index}.span.end`,
            endOptions: {
              output: result !== null,
              attributes: {
                result: result !== null,
              },
            },
          });

          return result;
        } catch (e: unknown) {
          const errorInstance = getErrorFromUnknown(e, { serializeStack: false });
          const mastraError = new MastraError(
            {
              id: 'WORKFLOW_CONDITION_EVALUATION_FAILED',
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.USER,
              details: { workflowId, runId },
            },
            errorInstance,
          );
          engine.getLogger()?.trackException(mastraError);
          engine.getLogger()?.error('Error evaluating condition: ' + errorInstance.stack);

          await engine.errorChildSpan({
            span: evalSpan,
            operationId: `workflow.${workflowId}.run.${runId}.conditional.${executionContext.executionPath.join('-')}.eval.${index}.span.error`,
            errorOptions: {
              error: mastraError,
              attributes: {
                result: false,
              },
            },
          });

          return null;
        }
      }),
    )
  ).filter((index): index is number => index !== null);

  let stepsToRun = steps.filter((_, index) => truthyIndexes.includes(index));
  if (perStep || (timeTravel && timeTravel.executionPath.length > 0)) {
    const possibleStepsToRun = stepsToRun.filter(s => {
      const currStepResult = stepResults[getSingleStepEntryId(s)];
      if (timeTravel && timeTravel.executionPath.length > 0) {
        return timeTravel.steps[0] === getSingleStepEntryId(s);
      }
      return !currStepResult;
    });
    const possibleStepToRun = possibleStepsToRun?.[0];
    stepsToRun = possibleStepToRun ? [possibleStepToRun] : stepsToRun;
  }

  // Arms whose condition did not evaluate truthy must never be reported as running. When time
  // travelling into a conditional, the reconstructed stepResults pre-mark the targeted arm as
  // 'running', but the condition can select a different arm. Reconcile here so the non-truthy
  // targeted arm is recorded as 'skipped' instead of leaving a stale 'running' status that
  // would persist and render the wrong branch as active on a rehydrated run. Scoped to
  // time-travel so normal start/resume flows are untouched.
  if (timeTravel && timeTravel.executionPath.length > 0) {
    entry.steps.forEach((armEntry, index) => {
      if (armEntry.type !== 'step') return;
      if (truthyIndexes.includes(index)) return;
      const armId = armEntry.step.id;
      const existing = stepResults[armId];
      if (existing?.status !== 'running') return;
      stepResults[armId] = {
        status: 'skipped',
        payload: existing.payload ?? {},
        startedAt: existing.startedAt ?? Date.now(),
        endedAt: Date.now(),
      };
    });
  }

  // Update conditional span with evaluation results
  conditionalSpan?.update({
    attributes: {
      truthyIndexes,
      selectedSteps: stepsToRun.map(s => getSingleStepEntryId(s)),
    },
  });

  const results: StepResult<any, any, any, any>[] = await Promise.all(
    stepsToRun.map(async step => {
      const stepId = getSingleStepEntryId(step);
      const currStepResult = stepResults[stepId];
      const isRestartStep = restart ? !!restart.activeStepsPath[stepId] : undefined;

      if (currStepResult && timeTravel && timeTravel.executionPath.length > 0) {
        if (timeTravel.steps[0] !== stepId) {
          return currStepResult;
        }
      }

      if (currStepResult && ['success', 'failed'].includes(currStepResult.status) && isRestartStep === undefined) {
        return currStepResult;
      }

      const stepExecResult = await executeChildEntry(engine, step, {
        workflowId,
        runId,
        resourceId,
        prevOutput,
        stepResults,
        serializedStepGraph,
        resume,
        restart,
        timeTravel,
        executionContext: {
          workflowId,
          runId,
          executionPath: [...executionContext.executionPath, steps.indexOf(step)],
          stepExecutionPath: executionContext.stepExecutionPath,
          activeStepsPath: executionContext.activeStepsPath,
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,
          state: executionContext.state,
          tracingIds: executionContext.tracingIds,
        },
        ...createObservabilityContext({ currentSpan: conditionalSpan }),
        pubsub,
        abortController,
        requestContext,
        actor,
        outputWriter,
        disableScorers,
        perStep,
      });

      // Apply context changes from conditional step execution
      engine.applyMutableContext(executionContext, stepExecResult.mutableContext);
      Object.assign(stepResults, stepExecResult.stepResults);

      return stepExecResult.result;
    }),
  );

  const hasFailed = results.find(result => result.status === 'failed') as StepFailure<any, any, any, any>;
  const hasSuspended = results.find(result => result.status === 'suspended');
  if (hasFailed) {
    // Preserve tripwire property for proper status conversion in fmtReturnValue
    execResults = {
      status: 'failed',
      error: hasFailed.error,
      tripwire: (hasFailed as any).tripwire,
    };
  } else if (hasSuspended) {
    execResults = {
      status: 'suspended',
      suspendPayload: hasSuspended.suspendPayload,
      ...(hasSuspended.suspendOutput ? { suspendOutput: hasSuspended.suspendOutput } : {}),
      suspendedAt: hasSuspended.suspendedAt,
    };
  } else if (abortController?.signal?.aborted) {
    execResults = { status: 'canceled' };
  } else {
    execResults = {
      status: 'success',
      output: results.reduce((acc: Record<string, any>, result, index) => {
        if (result.status === 'success') {
          acc[getSingleStepEntryId(stepsToRun[index]!)] = result.output;
        }

        return acc;
      }, {}),
    };
  }

  if (execResults.status === 'failed') {
    await engine.errorChildSpan({
      span: conditionalSpan,
      operationId: `workflow.${workflowId}.run.${runId}.conditional.${executionContext.executionPath.join('-')}.span.error`,
      errorOptions: { error: execResults.error },
    });
  } else {
    await engine.endChildSpan({
      span: conditionalSpan,
      operationId: `workflow.${workflowId}.run.${runId}.conditional.${executionContext.executionPath.join('-')}.span.end`,
      endOptions: { output: execResults.output || execResults },
    });
  }

  return execResults;
}

export interface ExecuteLoopParams extends ObservabilityContext {
  workflowId: string;
  runId: string;
  resourceId?: string;
  entry: {
    type: 'loop';
    step: SingleStepEntry;
    condition: LoopConditionFunction<any, any, any, any, any, DefaultEngineType>;
    loopType: 'dowhile' | 'dountil';
  };
  prevStep: StepFlowEntry;
  prevOutput: any;
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
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
  actor?: ActorSignal;
  outputWriter?: OutputWriter;
  disableScorers?: boolean;
  serializedStepGraph: SerializedStepFlowEntry[];
  perStep?: boolean;
}

export async function executeLoop(
  engine: DefaultExecutionEngine,
  params: ExecuteLoopParams,
): Promise<StepResult<any, any, any, any>> {
  const {
    workflowId,
    runId,
    resourceId,
    entry,
    prevOutput,
    stepResults,
    resume,
    restart,
    timeTravel,
    executionContext,
    pubsub,
    abortController,
    requestContext,
    actor,
    outputWriter,
    disableScorers,
    serializedStepGraph,
    perStep,
    ...rest
  } = params;

  const observabilityContext = resolveObservabilityContext(rest);

  const { step, condition } = entry;
  const stepId = getEntryId(step);

  const loopSpan = await engine.createChildSpan({
    parentSpan: observabilityContext.tracingContext.currentSpan,
    operationId: `workflow.${workflowId}.run.${runId}.loop.${executionContext.executionPath.join('-')}.span.start`,
    options: {
      type: SpanType.WORKFLOW_LOOP,
      name: `loop: '${entry.loopType}'`,
      input: prevOutput,
      attributes: {
        loopType: entry.loopType,
      },
      tracingPolicy: engine.options?.tracingPolicy,
    },
    executionContext,
  });

  let isTrue = true;
  const prevIterationCount = stepResults[stepId]?.metadata?.iterationCount;
  let iteration = prevIterationCount ? prevIterationCount - 1 : 0;
  const prevStepResult = stepResults[stepId];
  const loopInput =
    prevStepResult && Object.prototype.hasOwnProperty.call(prevStepResult, 'payload')
      ? prevStepResult.payload
      : prevOutput;
  let result = { status: 'success', output: loopInput } as unknown as StepResult<any, any, any, any>;
  let currentResume = resume;
  let currentRestart = restart;
  let currentTimeTravel = timeTravel;

  do {
    // Honor cancellation between iterations so long-running loops (e.g. dountil
    // with delays inside the step) terminate when the run is cancelled.
    if (abortController?.signal?.aborted) {
      await engine.endChildSpan({
        span: loopSpan,
        operationId: `workflow.${workflowId}.run.${runId}.loop.${executionContext.executionPath.join('-')}.span.end.early`,
        endOptions: {
          attributes: {
            totalIterations: iteration,
          },
        },
      });
      return { status: 'canceled' } as unknown as StepResult<any, any, any, any>;
    }

    const stepExecResult = await executeChildEntry(engine, step, {
      workflowId,
      runId,
      resourceId,
      stepResults,
      executionContext,
      restart: currentRestart,
      resume: currentResume,
      timeTravel: currentTimeTravel,
      prevOutput: (result as { output: any }).output,
      ...createObservabilityContext({ currentSpan: loopSpan }),
      pubsub,
      abortController,
      requestContext,
      actor,
      outputWriter,
      disableScorers,
      serializedStepGraph,
      iterationCount: iteration + 1,
      perStep,
    });

    // Apply context changes from loop step execution
    engine.applyMutableContext(executionContext, stepExecResult.mutableContext);
    Object.assign(stepResults, stepExecResult.stepResults);
    result = stepExecResult.result;

    //Clear restart & time travel for next iteration
    currentRestart = undefined;
    currentTimeTravel = undefined;
    // Clear resume for next iteration only if the step has completed resuming
    // This prevents the same resume data from being used multiple times
    if (currentResume && result.status !== 'suspended') {
      currentResume = undefined;
    }

    if (result.status !== 'success') {
      await engine.endChildSpan({
        span: loopSpan,
        operationId: `workflow.${workflowId}.run.${runId}.loop.${executionContext.executionPath.join('-')}.span.end.early`,
        endOptions: {
          attributes: {
            totalIterations: iteration,
          },
        },
      });
      return result;
    }

    // If the step finished but the run was cancelled while it was running
    // (e.g. user step ignored abortSignal), surface cancellation now instead
    // of evaluating the loop condition and starting another iteration.
    if (abortController?.signal?.aborted) {
      await engine.endChildSpan({
        span: loopSpan,
        operationId: `workflow.${workflowId}.run.${runId}.loop.${executionContext.executionPath.join('-')}.span.end.early`,
        endOptions: {
          attributes: {
            totalIterations: iteration + 1,
          },
        },
      });
      return { status: 'canceled' } as unknown as StepResult<any, any, any, any>;
    }

    const evalSpan = await engine.createChildSpan({
      parentSpan: loopSpan,
      operationId: `workflow.${workflowId}.run.${runId}.loop.${executionContext.executionPath.join('-')}.eval.${iteration}.span.start`,
      options: {
        type: SpanType.WORKFLOW_CONDITIONAL_EVAL,
        name: `condition: '${entry.loopType}'`,
        input: selectFields(result.output, ['stepResult', 'output.text', 'output.object', 'messages']),
        attributes: {
          conditionIndex: iteration,
        },
        tracingPolicy: engine.options?.tracingPolicy,
      },
      executionContext,
    });

    isTrue = await condition(
      createDeprecationProxy(
        {
          workflowId,
          runId,
          mastra: engine.mastra!,
          requestContext,
          actor,
          inputData: result.output,
          state: executionContext.state,
          retryCount: -1,
          ...createObservabilityContext({ currentSpan: evalSpan }),
          iterationCount: iteration + 1,
          getInitData: () => stepResults?.input as any,
          getStepResult: getStepResult.bind(null, stepResults),
          bail: (() => {}) as () => InnerOutput,
          abort: () => {
            abortController?.abort();
          },
          [PUBSUB_SYMBOL]: pubsub,
          [STREAM_FORMAT_SYMBOL]: executionContext.format,
          engine: engine.getEngineContext(),
          abortSignal: abortController?.signal,
          writer: new ToolStream(
            {
              prefix: 'workflow-step',
              callId: randomUUID(),
              name: 'loop',
              runId,
            },
            outputWriter,
          ),
        },
        {
          paramName: 'runCount',
          deprecationMessage: runCountDeprecationMessage,
          logger: engine.getLogger(),
        },
      ),
    );
    await engine.endChildSpan({
      span: evalSpan,
      operationId: `workflow.${workflowId}.run.${runId}.loop.${executionContext.executionPath.join('-')}.eval.${iteration}.span.end`,
      endOptions: {
        output: isTrue,
      },
    });

    iteration++;

    // Honor cancellation triggered during condition evaluation (the condition
    // context exposes `abort()`, and the run can be cancelled externally while
    // the condition is awaiting). Without this check a condition that returns
    // a terminal value after aborting would let the loop exit as 'success'.
    if (abortController?.signal?.aborted) {
      await engine.endChildSpan({
        span: loopSpan,
        operationId: `workflow.${workflowId}.run.${runId}.loop.${executionContext.executionPath.join('-')}.span.end.early`,
        endOptions: {
          attributes: {
            totalIterations: iteration,
          },
        },
      });
      return { status: 'canceled' } as unknown as StepResult<any, any, any, any>;
    }
  } while (entry.loopType === 'dowhile' ? isTrue : !isTrue);

  await engine.endChildSpan({
    span: loopSpan,
    operationId: `workflow.${workflowId}.run.${runId}.loop.${executionContext.executionPath.join('-')}.span.end`,
    endOptions: {
      output: result.output,
      attributes: {
        totalIterations: iteration,
      },
    },
  });

  return result;
}

export interface ExecuteForeachParams extends ObservabilityContext {
  workflowId: string;
  runId: string;
  resourceId?: string;
  entry: {
    type: 'foreach';
    step: SingleStepEntry;
    opts: ForeachOptions;
  };
  prevStep: StepFlowEntry;
  prevOutput: any;
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
  serializedStepGraph: SerializedStepFlowEntry[];
  perStep?: boolean;
}

export async function executeForeach(
  engine: DefaultExecutionEngine,
  params: ExecuteForeachParams,
): Promise<StepResult<any, any, any, any>> {
  const {
    workflowId,
    runId,
    resourceId,
    entry,
    prevOutput,
    stepResults,
    restart,
    resume,
    timeTravel,
    executionContext,
    pubsub,
    abortController,
    requestContext,
    actor,
    outputWriter,
    disableScorers,
    serializedStepGraph,
    perStep,
    ...rest
  } = params;

  const observabilityContext = resolveObservabilityContext(rest);

  const { step, opts } = entry;
  const stepId = getEntryId(step);
  const results: any[] = [];
  const concurrency = resolveForeachConcurrency(opts, {
    inputData: prevOutput,
    getInitData: () => stepResults?.input,
  });
  const startTime = resume?.steps[0] === stepId ? undefined : Date.now();
  const resumeTime = resume?.steps[0] === stepId ? Date.now() : undefined;

  const stepInfo = {
    ...stepResults[stepId],
    ...(resume?.steps[0] === stepId ? { resumePayload: resume?.resumePayload } : { payload: prevOutput }),
    ...(startTime ? { startedAt: startTime } : {}),
    ...(resumeTime ? { resumedAt: resumeTime } : {}),
  };

  const loopSpan = await engine.createChildSpan({
    parentSpan: observabilityContext.tracingContext.currentSpan,
    operationId: `workflow.${workflowId}.run.${runId}.foreach.${executionContext.executionPath.join('-')}.span.start`,
    options: {
      type: SpanType.WORKFLOW_LOOP,
      name: `loop: 'foreach'`,
      input: prevOutput,
      attributes: {
        loopType: 'foreach',
        concurrency,
      },
      tracingPolicy: engine.options?.tracingPolicy,
    },
    executionContext,
  });

  await pubsub.publish(`workflow.events.v2.${runId}`, {
    type: 'watch',
    runId,
    data: {
      type: 'workflow-step-start',
      payload: {
        id: stepId,
        ...stepInfo,
        status: 'running',
      },
    },
  });

  const prevPayload = stepResults[stepId];
  const foreachIndexObj: Record<number, any> = {};
  const resumeIndex =
    prevPayload?.status === 'suspended' ? prevPayload?.suspendPayload?.__workflow_meta?.foreachIndex || 0 : 0;

  type StepBailed = {
    status: 'bailed';
    output: any;
    payload?: any;
    startedAt?: number;
    endedAt: number;
    metadata?: Record<string, any>;
  };
  type ForeachStepResult = StepResult<any, any, any, any> | StepBailed;
  type PersistedForeachStepResult = ForeachStepResult & { suspendPayload?: any };

  const prevForeachOutput = (prevPayload?.suspendPayload?.__workflow_meta?.foreachOutput ||
    []) as PersistedForeachStepResult[];
  const prevResumeLabels = prevPayload?.suspendPayload?.__workflow_meta?.resumeLabels || {};
  const resumeLabels = getResumeLabelsByStepId(prevResumeLabels, stepId);

  const totalCount = prevOutput.length;
  let completedCount = 0;

  // Use a fastq callback-based queue for fluid concurrency.
  // Unlike the previous batch approach (Promise.all on slices), this starts the
  // next item as soon as any slot frees up, keeping `concurrency` items running
  // at all times instead of waiting for an entire batch to finish.
  type ForeachTask = { item: any; k: number; resumeToUse: typeof resume };
  let errorResult: StepFailure<any, any, any, any> | null = null;
  let exitResult = null as ForeachStepResult | null;
  let canceledResult: ForeachStepResult | null = null;
  let inFlight = 0;
  let resolveCompletion: (() => void) | undefined;

  /** Publish a workflow-step-progress event for a single foreach iteration. */
  const emitIterationProgress = (
    k: number,
    iterationStatus: 'success' | 'suspended' | 'failed',
    iterationOutput?: unknown,
  ) =>
    pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'workflow-step-progress',
        payload: {
          id: stepId,
          completedCount,
          totalCount,
          currentIndex: k,
          iterationStatus,
          ...(iterationOutput !== undefined ? { iterationOutput } : {}),
        },
      },
    });

  /** Drain all queued (not yet in-flight) tasks and kill the queue. */
  const killQueue = () => {
    inFlight -= queue.length();
    queue.kill();
  };

  /** Execute a single foreach iteration and return its result. */
  const executeForeachIteration = (item: any, k: number, resumeToUse: typeof resume) =>
    executeChildEntry(engine, step, {
      workflowId,
      runId,
      resourceId,
      stepResults,
      restart,
      timeTravel,
      executionContext: { ...executionContext, foreachIndex: k },
      resume: resumeToUse,
      prevOutput: item,
      ...createObservabilityContext({ currentSpan: loopSpan }),
      pubsub,
      abortController,
      requestContext,
      actor,
      skipEmits: true,
      outputWriter,
      disableScorers,
      serializedStepGraph,
      perStep,
    });

  /** Handle a non-success result (suspended or failed). Kills the queue so remaining items are skipped. */
  const handleNonSuccessResult = async (result: ForeachStepResult, k: number) => {
    if (result.status === 'suspended') {
      if (!foreachIndexObj[k]) {
        foreachIndexObj[k] = {
          status: result.status,
          suspendPayload: result.suspendPayload,
          suspendedAt: result.suspendedAt,
        };
      }
      await emitIterationProgress(k, 'suspended');
    } else if (result.status === 'failed') {
      completedCount++;
      await emitIterationProgress(k, 'failed');
      if (!errorResult) {
        errorResult = result;
      }
    } else if (result.status !== 'success') {
      completedCount++;
      await emitIterationProgress(k, 'failed');
      if (!exitResult) {
        exitResult = result;
      }
    }

    killQueue();
  };

  /** Handle a successful iteration result. */
  const handleSuccessResult = async (result: Extract<ForeachStepResult, { status: 'success' }>, k: number) => {
    completedCount++;
    await emitIterationProgress(k, 'success', result.output);

    const indexResumeLabel = Object.keys(resumeLabels).find(key => resumeLabels[key]?.foreachIndex === k);
    if (indexResumeLabel !== undefined) {
      delete resumeLabels[indexResumeLabel];
    }
  };

  const worker = async (task: ForeachTask, cb: DoneCallback) => {
    const { item, k, resumeToUse } = task;

    try {
      // Honor cancellation before dispatching more work
      if (abortController?.signal?.aborted) {
        if (!canceledResult) {
          canceledResult = {
            ...stepInfo,
            status: 'canceled',
            output: results,
            endedAt: Date.now(),
          } as unknown as StepResult<any, any, any, any>;
        }
        killQueue();
        inFlight--;
        cb(null);
        if (inFlight === 0) resolveCompletion?.();
        return;
      }

      const stepExecResult = await executeForeachIteration(item, k, resumeToUse);

      engine.applyMutableContext(executionContext, stepExecResult.mutableContext);
      Object.assign(stepResults, stepExecResult.stepResults);

      const result = stepExecResult.result as ForeachStepResult;

      if (result.status !== 'success') {
        await handleNonSuccessResult(result, k);
      } else {
        await handleSuccessResult(result, k);
      }

      if (result.status === 'success' && result.output !== undefined) {
        results[k] = result.output;
      }

      // Preserve `suspendPayload` for iterations that are still suspended so
      // their resume context (e.g. an agent's `__streamState`) survives the
      // round-trip through the workflow snapshot. For non-suspended results we
      // clear it to keep the snapshot small.
      prevForeachOutput[k] = result.status === 'suspended' ? result : { ...result, suspendPayload: {} };
    } catch (err) {
      if (!errorResult) {
        const errorObj = err instanceof Error ? err : new Error(String(err));
        errorResult = {
          status: 'failed',
          error: errorObj,
          payload: undefined,
          startedAt: Date.now(),
          endedAt: Date.now(),
        };
      }
      killQueue();
    }

    inFlight--;
    cb(null);
    if (inFlight === 0) resolveCompletion?.();
  };

  const queue = fastq(worker, concurrency);

  // Enqueue all items, skipping already-completed ones (resume case)
  for (let k = 0; k < prevOutput.length; k++) {
    const prevItemResult = prevForeachOutput[k];
    if (
      prevItemResult?.status === 'success' ||
      (prevItemResult?.status === 'suspended' && resume?.forEachIndex !== k && resume?.forEachIndex !== undefined)
    ) {
      if (prevItemResult?.status === 'success') {
        // Already succeeded in a previous run – clean up resume label
        const indexResumeLabel = Object.keys(resumeLabels).find(key => resumeLabels[key]?.foreachIndex === k);
        if (indexResumeLabel !== undefined) {
          delete resumeLabels[indexResumeLabel];
        }
      } else {
        // Still suspended from a previous run – track it for the suspend result
        foreachIndexObj[k] = {
          status: prevItemResult.status,
          suspendPayload: prevItemResult.suspendPayload,
          suspendedAt: prevItemResult.suspendedAt,
        };
      }

      if (prevItemResult.status === 'success' && prevItemResult.output !== undefined) {
        results[k] = prevItemResult.output;
      }
      // Preserve suspendPayload for still-suspended items (same as worker logic)
      prevForeachOutput[k] =
        prevItemResult.status === 'suspended' ? prevItemResult : { ...prevItemResult, suspendPayload: {} };
      continue;
    }

    let resumeToUse = undefined;
    if (resume?.forEachIndex !== undefined) {
      resumeToUse = resume.forEachIndex === k ? resume : undefined;
    } else {
      const isIndexSuspended = prevItemResult?.status === 'suspended' || resumeIndex === k;
      if (isIndexSuspended) {
        resumeToUse = resume;
      }
    }

    inFlight++;
    queue.push({ item: prevOutput[k]!, k, resumeToUse });
  }

  // Wait for all in-flight items to complete
  if (inFlight > 0) {
    await new Promise<void>(resolve => {
      resolveCompletion = resolve;
    });
  }

  // Handle cancellation
  if (canceledResult) {
    await engine.endChildSpan({
      span: loopSpan,
      operationId: `workflow.${workflowId}.run.${runId}.foreach.${executionContext.executionPath.join('-')}.span.end.early`,
      endOptions: {
        output: results,
      },
    });
    return canceledResult;
  }

  // Honor cancellation that landed during the final items. Without this check,
  // a foreach whose steps ignore abortSignal would still emit a 'success'
  // workflow-step-result and persist a successful step result, even though the
  // run was cancelled.
  if (abortController?.signal?.aborted) {
    await engine.endChildSpan({
      span: loopSpan,
      operationId: `workflow.${workflowId}.run.${runId}.foreach.${executionContext.executionPath.join('-')}.span.end.early`,
      endOptions: {
        output: results,
      },
    });
    return { ...stepInfo, status: 'canceled', output: results, endedAt: Date.now() } as unknown as StepResult<
      any,
      any,
      any,
      any
    >;
  }

  // Handle error result first (matches previous behavior of returning on first error)
  const finalErrorResult = errorResult as StepFailure<any, any, any, any> | null;
  if (finalErrorResult) {
    const execResults = {
      status: finalErrorResult.status,
      error: finalErrorResult.error,
      suspendPayload: finalErrorResult.suspendPayload,
      suspendedAt: finalErrorResult.suspendedAt,
      endedAt: finalErrorResult.endedAt,
    };

    await engine.errorChildSpan({
      span: loopSpan,
      operationId: `workflow.${workflowId}.run.${runId}.foreach.${executionContext.executionPath.join('-')}.span.error`,
      errorOptions: { error: finalErrorResult.error },
    });

    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'workflow-step-result',
        payload: {
          id: stepId,
          ...execResults,
        },
      },
    });

    await pubsub.publish(`workflow.events.v2.${runId}`, {
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

    return finalErrorResult;
  }

  if (exitResult) {
    await engine.endChildSpan({
      span: loopSpan,
      operationId: `workflow.${workflowId}.run.${runId}.foreach.${executionContext.executionPath.join('-')}.span.end.early`,
      endOptions: {
        output: 'output' in exitResult ? exitResult.output : undefined,
      },
    });

    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'workflow-step-result',
        payload: {
          id: stepId,
          ...exitResult,
        },
      },
    });

    await pubsub.publish(`workflow.events.v2.${runId}`, {
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

    return exitResult as StepResult<any, any, any, any>;
  }

  // Handle suspended items
  if (Object.keys(foreachIndexObj).length > 0) {
    const suspendedIndices = Object.keys(foreachIndexObj).map(Number);
    const foreachIndex = suspendedIndices[0]!;

    await engine.endChildSpan({
      span: loopSpan,
      operationId: `workflow.${workflowId}.run.${runId}.foreach.${executionContext.executionPath.join('-')}.span.end`,
      endOptions: { output: foreachIndexObj[foreachIndex] },
    });

    await pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'workflow-step-suspended',
        payload: {
          id: stepId,
          ...foreachIndexObj[foreachIndex],
        },
      },
    });

    executionContext.suspendedPaths[stepId] = executionContext.executionPath;
    executionContext.resumeLabels = { ...resumeLabels, ...executionContext.resumeLabels };

    return {
      ...stepInfo,
      suspendedAt: Date.now(),
      status: 'suspended',
      ...(foreachIndexObj[foreachIndex].suspendOutput
        ? { suspendOutput: foreachIndexObj[foreachIndex].suspendOutput }
        : {}),
      suspendPayload: {
        ...foreachIndexObj[foreachIndex].suspendPayload,
        __workflow_meta: {
          ...foreachIndexObj[foreachIndex].suspendPayload?.__workflow_meta,
          foreachIndex,
          foreachOutput: prevForeachOutput,
          resumeLabels: executionContext.resumeLabels,
        },
      },
    } as StepSuspended<any, any, any>;
  }

  await pubsub.publish(`workflow.events.v2.${runId}`, {
    type: 'watch',
    runId,
    data: {
      type: 'workflow-step-result',
      payload: {
        id: stepId,
        status: 'success',
        output: results,
        endedAt: Date.now(),
      },
    },
  });

  await pubsub.publish(`workflow.events.v2.${runId}`, {
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

  await engine.endChildSpan({
    span: loopSpan,
    operationId: `workflow.${workflowId}.run.${runId}.foreach.${executionContext.executionPath.join('-')}.span.end`,
    endOptions: {
      output: results,
    },
  });

  return {
    ...stepInfo,
    status: 'success',
    output: results,
    endedAt: Date.now(),
  } as StepSuccess<any, any, any, any>;
}
