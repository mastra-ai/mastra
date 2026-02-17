import { randomUUID } from 'node:crypto';
import type { RequestContext } from '../../di';
import { MastraError, ErrorDomain, ErrorCategory, getErrorFromUnknown } from '../../error';
import type { PubSub } from '../../events/pubsub';
import { SpanType } from '../../observability';
import type { TracingContext } from '../../observability';
import { ToolStream } from '../../tools/stream';
import { selectFields } from '../../utils';
import { PUBSUB_SYMBOL, STREAM_FORMAT_SYMBOL } from '../constants';
import type { DefaultExecutionEngine } from '../default';
import type { ConditionFunction, InnerOutput, LoopConditionFunction, Step } from '../step';
import { getStepResult } from '../step';
import type {
  DefaultEngineType,
  ExecutionContext,
  OutputWriter,
  RestartExecutionParams,
  SerializedStepFlowEntry,
  StepFailure,
  StepFlowEntry,
  StepResult,
  StepSuccess,
  StepSuspended,
  TimeTravelExecutionParams,
} from '../types';
import { createDeprecationProxy, runCountDeprecationMessage, getResumeLabelsByStepId } from '../utils';

export interface ExecuteParallelParams {
  workflowId: string;
  runId: string;
  resourceId?: string;
  entry: {
    type: 'parallel';
    steps: {
      type: 'step';
      step: Step;
    }[];
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
  tracingContext: TracingContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
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
    tracingContext,
    pubsub,
    abortController,
    requestContext,
    outputWriter,
    disableScorers,
    perStep,
  } = params;

  const parallelSpan = await engine.createChildSpan({
    parentSpan: tracingContext.currentSpan,
    operationId: `workflow.${workflowId}.run.${runId}.parallel.${executionContext.executionPath.join('-')}.span.start`,
    options: {
      type: SpanType.WORKFLOW_PARALLEL,
      name: `parallel: '${entry.steps.length} branches'`,
      input: engine.getStepOutput(stepResults, prevStep),
      attributes: {
        branchCount: entry.steps.length,
        parallelSteps: entry.steps.map(s => (s.type === 'step' ? s.step.id : `control-${s.type}`)),
      },
      tracingPolicy: engine.options?.tracingPolicy,
    },
    executionContext,
  });

  const prevOutput = engine.getStepOutput(stepResults, prevStep);
  for (const [stepIndex, step] of entry.steps.entries()) {
    let makeStepRunning = true;
    if (restart) {
      makeStepRunning = !!restart.activeStepsPath[step.step.id];
    }
    if (timeTravel && timeTravel.executionPath.length > 0) {
      makeStepRunning = timeTravel.steps[0] === step.step.id;
    }
    if (!makeStepRunning) {
      break;
    }
    const startTime = resume?.steps[0] === step.step.id ? undefined : Date.now();
    const resumeTime = resume?.steps[0] === step.step.id ? Date.now() : undefined;
    stepResults[step.step.id] = {
      ...stepResults[step.step.id],
      status: 'running',
      ...(resumeTime ? { resumePayload: resume?.resumePayload } : { payload: prevOutput }),
      ...(startTime ? { startedAt: startTime } : {}),
      ...(resumeTime ? { resumedAt: resumeTime } : {}),
    } as StepResult<any, any, any, any>;
    executionContext.activeStepsPath[step.step.id] = [...executionContext.executionPath, stepIndex];
    if (perStep) {
      break;
    }
  }

  if (timeTravel && timeTravel.executionPath.length > 0) {
    timeTravel.executionPath.shift();
  }

  let execResults: any;
  const results: StepResult<any, any, any, any>[] = await Promise.all(
    entry.steps.map(async (step, i) => {
      const currStepResult = stepResults[step.step.id];
      if (currStepResult && currStepResult.status !== 'running') {
        return currStepResult;
      }
      if (!currStepResult && (perStep || timeTravel)) {
        return {} as StepResult<any, any, any, any>;
      }
      const stepExecResult = await engine.executeStep({
        workflowId,
        runId,
        resourceId,
        step: step.step,
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
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,
          state: executionContext.state,
          tracingIds: executionContext.tracingIds,
        },
        tracingContext: {
          currentSpan: parallelSpan,
        },
        pubsub,
        abortController,
        requestContext,
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
          acc[entry.steps[index]!.step.id] = result.output;
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

export interface ExecuteConditionalParams {
  workflowId: string;
  runId: string;
  resourceId?: string;
  serializedStepGraph: SerializedStepFlowEntry[];
  entry: {
    type: 'conditional';
    steps: { type: 'step'; step: Step }[];
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
  tracingContext: TracingContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
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
    tracingContext,
    pubsub,
    abortController,
    requestContext,
    outputWriter,
    disableScorers,
    perStep,
  } = params;

  const conditionalSpan = await engine.createChildSpan({
    parentSpan: tracingContext.currentSpan,
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
            inputData: prevOutput,
            state: executionContext.state,
            retryCount: -1,
            tracingContext: {
              currentSpan: evalSpan,
            },
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

  let stepsToRun = entry.steps.filter((_, index) => truthyIndexes.includes(index));
  if (perStep || (timeTravel && timeTravel.executionPath.length > 0)) {
    const possibleStepsToRun = stepsToRun.filter(s => {
      const currStepResult = stepResults[s.step.id];
      if (timeTravel && timeTravel.executionPath.length > 0) {
        return timeTravel.steps[0] === s.step.id;
      }
      return !currStepResult;
    });
    const possibleStepToRun = possibleStepsToRun?.[0];
    stepsToRun = possibleStepToRun ? [possibleStepToRun] : stepsToRun;
  }

  // Update conditional span with evaluation results
  conditionalSpan?.update({
    attributes: {
      truthyIndexes,
      selectedSteps: stepsToRun.map(s => (s.type === 'step' ? s.step.id : `control-${s.type}`)),
    },
  });

  const results: StepResult<any, any, any, any>[] = await Promise.all(
    stepsToRun.map(async step => {
      const currStepResult = stepResults[step.step.id];
      const isRestartStep = restart ? !!restart.activeStepsPath[step.step.id] : undefined;

      if (currStepResult && timeTravel && timeTravel.executionPath.length > 0) {
        if (timeTravel.steps[0] !== step.step.id) {
          return currStepResult;
        }
      }

      if (currStepResult && ['success', 'failed'].includes(currStepResult.status) && isRestartStep === undefined) {
        return currStepResult;
      }

      const stepExecResult = await engine.executeStep({
        workflowId,
        runId,
        resourceId,
        step: step.step,
        prevOutput,
        stepResults,
        serializedStepGraph,
        resume,
        restart,
        timeTravel,
        executionContext: {
          workflowId,
          runId,
          executionPath: [...executionContext.executionPath, entry.steps.indexOf(step)],
          activeStepsPath: executionContext.activeStepsPath,
          suspendedPaths: executionContext.suspendedPaths,
          resumeLabels: executionContext.resumeLabels,
          retryConfig: executionContext.retryConfig,
          state: executionContext.state,
          tracingIds: executionContext.tracingIds,
        },
        tracingContext: {
          currentSpan: conditionalSpan,
        },
        pubsub,
        abortController,
        requestContext,
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
          acc[stepsToRun[index]!.step.id] = result.output;
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

export interface ExecuteLoopParams {
  workflowId: string;
  runId: string;
  resourceId?: string;
  entry: {
    type: 'loop';
    step: Step;
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
  tracingContext: TracingContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
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
    tracingContext,
    pubsub,
    abortController,
    requestContext,
    outputWriter,
    disableScorers,
    serializedStepGraph,
    perStep,
  } = params;

  const { step, condition } = entry;

  const loopSpan = await engine.createChildSpan({
    parentSpan: tracingContext.currentSpan,
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
  const prevIterationCount = stepResults[step.id]?.metadata?.iterationCount;
  let iteration = prevIterationCount ? prevIterationCount - 1 : 0;
  const prevPayload = stepResults[step.id]?.payload;
  let result = { status: 'success', output: prevPayload ?? prevOutput } as unknown as StepResult<any, any, any, any>;
  let currentResume = resume;
  let currentRestart = restart;
  let currentTimeTravel = timeTravel;

  do {
    const stepExecResult = await engine.executeStep({
      workflowId,
      runId,
      resourceId,
      step,
      stepResults,
      executionContext,
      restart: currentRestart,
      resume: currentResume,
      timeTravel: currentTimeTravel,
      prevOutput: (result as { output: any }).output,
      tracingContext: {
        currentSpan: loopSpan,
      },
      pubsub,
      abortController,
      requestContext,
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
          inputData: result.output,
          state: executionContext.state,
          retryCount: -1,
          tracingContext: {
            currentSpan: evalSpan,
          },
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

export interface ExecuteForeachParams {
  workflowId: string;
  runId: string;
  resourceId?: string;
  entry: {
    type: 'foreach';
    step: Step;
    opts: {
      concurrency: number;
    };
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
  tracingContext: TracingContext;
  pubsub: PubSub;
  abortController: AbortController;
  requestContext: RequestContext;
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
    tracingContext,
    pubsub,
    abortController,
    requestContext,
    outputWriter,
    disableScorers,
    serializedStepGraph,
    perStep,
  } = params;

  const { step, opts } = entry;
  const results: StepResult<any, any, any, any>[] = [];
  const concurrency = opts.concurrency;
  const startTime = resume?.steps[0] === step.id ? undefined : Date.now();
  const resumeTime = resume?.steps[0] === step.id ? Date.now() : undefined;

  const stepInfo = {
    ...stepResults[step.id],
    ...(resume?.steps[0] === step.id ? { resumePayload: resume?.resumePayload } : { payload: prevOutput }),
    ...(startTime ? { startedAt: startTime } : {}),
    ...(resumeTime ? { resumedAt: resumeTime } : {}),
  };

  const loopSpan = await engine.createChildSpan({
    parentSpan: tracingContext.currentSpan,
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
        id: step.id,
        ...stepInfo,
        status: 'running',
      },
    },
  });

  const prevPayload = stepResults[step.id];
  const foreachIndexObj: Record<number, any> = {};
  const resumeIndex =
    prevPayload?.status === 'suspended' ? prevPayload?.suspendPayload?.__workflow_meta?.foreachIndex || 0 : 0;

  const prevForeachOutput = (prevPayload?.suspendPayload?.__workflow_meta?.foreachOutput || []) as StepResult<
    any,
    any,
    any,
    any
  >[];
  const prevResumeLabels = prevPayload?.suspendPayload?.__workflow_meta?.resumeLabels || {};
  const resumeLabels = getResumeLabelsByStepId(prevResumeLabels, step.id);

  const totalCount = prevOutput.length;
  let completedCount = 0;

  for (let i = 0; i < prevOutput.length; i += concurrency) {
    const items = prevOutput.slice(i, i + concurrency);
    const itemsResults = await Promise.all(
      items.map(async (item: any, j: number) => {
        const k = i + j;
        const prevItemResult = prevForeachOutput[k];
        if (
          prevItemResult?.status === 'success' ||
          (prevItemResult?.status === 'suspended' && resume?.forEachIndex !== k && resume?.forEachIndex !== undefined)
        ) {
          return prevItemResult;
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

        const stepExecResult = await engine.executeStep({
          workflowId,
          runId,
          resourceId,
          step,
          stepResults,
          restart,
          timeTravel,
          executionContext: { ...executionContext, foreachIndex: k },
          resume: resumeToUse,
          prevOutput: item,
          tracingContext: { currentSpan: loopSpan },
          pubsub,
          abortController,
          requestContext,
          skipEmits: true,
          outputWriter,
          disableScorers,
          serializedStepGraph,
          perStep,
        });

        // Apply context changes from foreach step execution
        engine.applyMutableContext(executionContext, stepExecResult.mutableContext);
        Object.assign(stepResults, stepExecResult.stepResults);
        return stepExecResult.result;
      }),
    );

    for (const [resultIndex, result] of itemsResults.entries()) {
      if (result.status !== 'success') {
        const { status, error, suspendPayload, suspendedAt, endedAt, output } = result;
        const execResults = { status, error, suspendPayload, suspendedAt, endedAt, output };

        if (execResults.status === 'suspended') {
          foreachIndexObj[i + resultIndex] = execResults;

          await pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: {
              type: 'workflow-step-progress',
              payload: {
                id: step.id,
                completedCount,
                totalCount,
                currentIndex: i + resultIndex,
                iterationStatus: 'suspended' as const,
              },
            },
          });
        } else {
          completedCount++;

          await pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: {
              type: 'workflow-step-progress',
              payload: {
                id: step.id,
                completedCount,
                totalCount,
                currentIndex: i + resultIndex,
                iterationStatus: 'failed' as const,
              },
            },
          });

          await pubsub.publish(`workflow.events.v2.${runId}`, {
            type: 'watch',
            runId,
            data: {
              type: 'workflow-step-result',
              payload: {
                id: step.id,
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
                id: step.id,
                metadata: {},
              },
            },
          });

          return result;
        }
      } else {
        completedCount++;

        await pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-progress',
            payload: {
              id: step.id,
              completedCount,
              totalCount,
              currentIndex: i + resultIndex,
              iterationStatus: 'success' as const,
              iterationOutput: result?.output,
            },
          },
        });

        const indexResumeLabel = Object.keys(resumeLabels).find(
          key => resumeLabels[key]?.foreachIndex === i + resultIndex,
        )!;
        delete resumeLabels[indexResumeLabel];
      }

      if (result?.output) {
        results[i + resultIndex] = result?.output;
      }

      prevForeachOutput[i + resultIndex] = { ...result, suspendPayload: {} };
    }

    if (Object.keys(foreachIndexObj).length > 0) {
      const suspendedIndices = Object.keys(foreachIndexObj).map(Number);
      const foreachIndex = suspendedIndices[0]!;
      await pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-suspended',
          payload: {
            id: step.id,
            ...foreachIndexObj[foreachIndex],
          },
        },
      });

      executionContext.suspendedPaths[step.id] = executionContext.executionPath;
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
  }

  await pubsub.publish(`workflow.events.v2.${runId}`, {
    type: 'watch',
    runId,
    data: {
      type: 'workflow-step-result',
      payload: {
        id: step.id,
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
        id: step.id,
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
