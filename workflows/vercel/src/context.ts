import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/di';
import type { Step, StepResult } from '@mastra/core/workflows';
import { EMITTER_SYMBOL, STREAM_FORMAT_SYMBOL } from '@mastra/core/workflows/_constants';
import { ToolStream } from '@mastra/core/tools';
import type { SerializedStepContext, StepExecutionOutput } from './types';

/**
 * Serialize step context for passing to the runStep function.
 * Converts non-serializable types (like Map) to plain objects.
 */
export function serializeStepContext(params: {
  runId: string;
  workflowId: string;
  resourceId?: string;
  state: Record<string, any>;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  executionPath: number[];
  retryCount: number;
  requestContext: RequestContext;
  resumeData?: unknown;
  suspendData?: unknown;
  format?: 'legacy' | 'vnext';
}): SerializedStepContext {
  // Serialize RequestContext Map to plain object
  const serializedRequestContext: Record<string, any> = {};
  params.requestContext.forEach((value, key) => {
    serializedRequestContext[key] = value;
  });

  return {
    runId: params.runId,
    workflowId: params.workflowId,
    resourceId: params.resourceId,
    state: params.state,
    stepResults: params.stepResults,
    executionPath: params.executionPath,
    retryCount: params.retryCount,
    requestContext: serializedRequestContext,
    resumeData: params.resumeData,
    suspendData: params.suspendData,
    format: params.format,
  };
}

/**
 * Deserialize RequestContext from a plain object back to a Map.
 */
export function deserializeRequestContext(obj: Record<string, any>): RequestContext {
  return new Map(Object.entries(obj)) as unknown as RequestContext;
}

/**
 * Get step result output by step ID or Step object.
 */
function getStepResultOutput(stepResults: Record<string, StepResult<any, any, any, any>>, step: any): any {
  let result;
  if (typeof step === 'string') {
    result = stepResults[step];
  } else {
    if (!step?.id) {
      return null;
    }
    result = stepResults[step.id];
  }
  return result?.status === 'success' ? result.output : null;
}

/**
 * Build ExecuteFunctionParams from serialized context.
 * Reconstructs non-serializable parts (functions, mastra reference, etc).
 */
export function buildExecutionParams(params: {
  input: unknown;
  serializedContext: SerializedStepContext;
  mastra: Mastra;
  step: Step<any, any, any>;
  emitter: { emit: (event: string, data: any) => Promise<void> };
  abortController: AbortController;
}): {
  execParams: any;
  getContextMutations: () => StepExecutionOutput['contextMutations'];
  getSuspended: () => { payload: unknown } | undefined;
  getBailed: () => { payload: unknown } | undefined;
} {
  const { input, serializedContext, mastra, step, emitter, abortController } = params;

  // Reconstruct RequestContext from serialized form
  const requestContext = deserializeRequestContext(serializedContext.requestContext);

  // State management - track mutations
  let currentState = { ...serializedContext.state };
  let stateUpdated = false;

  const setState = (newState: any) => {
    currentState = newState;
    stateUpdated = true;
  };

  // Track context mutations for return value
  const contextMutations: StepExecutionOutput['contextMutations'] = {
    suspendedPaths: {},
    resumeLabels: {},
    stateUpdate: null,
    requestContextUpdate: null,
  };

  // Suspend/bail tracking
  let suspended: { payload: unknown } | undefined;
  let bailed: { payload: unknown } | undefined;

  const execParams = {
    runId: serializedContext.runId,
    workflowId: serializedContext.workflowId,
    resourceId: serializedContext.resourceId,
    mastra,
    requestContext,
    inputData: input,
    state: currentState,
    setState,
    retryCount: serializedContext.retryCount,
    resumeData: serializedContext.resumeData,
    suspendData: serializedContext.suspendData,
    tracingContext: { currentSpan: undefined },
    getInitData: () => serializedContext.stepResults?.input as any,
    getStepResult: (stepId: any) => getStepResultOutput(serializedContext.stepResults, stepId),
    suspend: async (suspendPayload?: unknown, suspendOptions?: { resumeLabel?: string | string[] }) => {
      // Track suspended path
      contextMutations.suspendedPaths[step.id] = serializedContext.executionPath;

      // Handle resume labels
      if (suspendOptions?.resumeLabel) {
        const resumeLabels = Array.isArray(suspendOptions.resumeLabel)
          ? suspendOptions.resumeLabel
          : [suspendOptions.resumeLabel];
        for (const label of resumeLabels) {
          contextMutations.resumeLabels[label] = { stepId: step.id };
        }
      }

      suspended = { payload: suspendPayload };
    },
    bail: (result: any) => {
      bailed = { payload: result };
    },
    abort: () => {
      abortController.abort();
    },
    [EMITTER_SYMBOL]: emitter,
    [STREAM_FORMAT_SYMBOL]: serializedContext.format,
    engine: { engineType: 'vercel' },
    abortSignal: abortController.signal,
    writer: new ToolStream(
      {
        prefix: 'workflow-step',
        callId: `${serializedContext.runId}-${step.id}`,
        name: step.id,
        runId: serializedContext.runId,
      },
      undefined,
    ),
  };

  return {
    execParams,
    getContextMutations: () => {
      // Capture final state of mutations
      if (stateUpdated) {
        contextMutations.stateUpdate = currentState;
      }
      // Serialize requestContext for engines that need it
      const serializedRC: Record<string, unknown> = {};
      requestContext.forEach((value, key) => {
        serializedRC[key] = value;
      });
      contextMutations.requestContextUpdate = serializedRC;
      return contextMutations;
    },
    getSuspended: () => suspended,
    getBailed: () => bailed,
  };
}
