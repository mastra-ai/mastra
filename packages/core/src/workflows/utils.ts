import type { StandardSchemaV1 } from '@standard-schema/spec';
import { isEmpty } from 'radash';
import { ErrorCategory, ErrorDomain, getErrorFromUnknown, MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import type { RequestContext } from '../request-context';
import type { StandardSchemaWithJSON } from '../schema/schema';
import { removeUndefinedValues } from '../utils';
import type { ExecutionGraph } from './execution-engine';
import type { Step } from './step';
import type {
  StepFlowEntry,
  StepResult,
  TimeTravelContext,
  TimeTravelExecutionParams,
  WorkflowRunState,
} from './types';

/**
 * Validates data against a StandardSchema and returns the result.
 * Works with both sync and async schemas.
 */
async function validateWithStandardSchema<T>(
  schema: StandardSchemaWithJSON<T>,
  data: unknown,
): Promise<{ success: true; data: T } | { success: false; issues: { path?: (string | number)[]; message: string }[] }> {
  const result = schema['~standard'].validate(data);
  const resolvedResult = result instanceof Promise ? await result : result;

  if ('issues' in resolvedResult && resolvedResult.issues) {
    return {
      success: false,
      issues: resolvedResult.issues.map((issue: StandardSchemaV1.Issue) => ({
        path: issue.path?.map((p: PropertyKey | StandardSchemaV1.PathSegment) =>
          typeof p === 'object' && 'key' in p ? p.key : p,
        ) as (string | number)[] | undefined,
        message: issue.message,
      })),
    };
  }

  return { success: true, data: resolvedResult.value as T };
}

export async function validateStepInput({
  prevOutput,
  step,
  validateInputs,
}: {
  prevOutput: any;
  step: Step<string, any, any>;
  validateInputs: boolean;
}) {
  let inputData = prevOutput;

  let validationError: Error | undefined;

  const inputSchema = step.inputSchema;
  if (validateInputs && inputSchema) {
    const validatedInput = await validateWithStandardSchema(inputSchema, prevOutput);

    if (!validatedInput.success) {
      const errorMessages = validatedInput.issues.map(e => `- ${e.path?.join('.')}: ${e.message}`).join('\n');
      validationError = new MastraError(
        {
          id: 'WORKFLOW_STEP_INPUT_VALIDATION_FAILED',
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.USER,
          text: 'Step input validation failed: \n' + errorMessages,
        },
        { issues: validatedInput.issues },
      );
    } else {
      const isEmptyData = isEmpty(validatedInput.data);
      inputData = isEmptyData ? prevOutput : validatedInput.data;
    }
  }

  return { inputData, validationError };
}

export async function validateStepResumeData({ resumeData, step }: { resumeData?: any; step: Step<string, any, any> }) {
  if (!resumeData) {
    return { resumeData: undefined, validationError: undefined };
  }

  let validationError: Error | undefined;

  const resumeSchema = step.resumeSchema;

  if (resumeSchema) {
    const validatedResumeData = await validateWithStandardSchema(resumeSchema, resumeData);
    if (!validatedResumeData.success) {
      const errorMessages = validatedResumeData.issues.map(e => `- ${e.path?.join('.')}: ${e.message}`).join('\n');
      validationError = new MastraError({
        id: 'WORKFLOW_STEP_RESUME_DATA_VALIDATION_FAILED',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text: 'Step resume data validation failed: \n' + errorMessages,
      });
    } else {
      resumeData = validatedResumeData.data;
    }
  }
  return { resumeData, validationError };
}

export async function validateStepSuspendData({
  suspendData,
  step,
  validateInputs,
}: {
  suspendData?: any;
  step: Step<string, any, any>;
  validateInputs: boolean;
}) {
  if (!suspendData) {
    return { suspendData: undefined, validationError: undefined };
  }

  let validationError: Error | undefined;

  const suspendSchema = step.suspendSchema;

  if (suspendSchema && validateInputs) {
    const validatedSuspendData = await validateWithStandardSchema(suspendSchema, suspendData);
    if (!validatedSuspendData.success) {
      const errorMessages = validatedSuspendData.issues.map(e => `- ${e.path?.join('.')}: ${e.message}`).join('\n');
      validationError = new MastraError({
        id: 'WORKFLOW_STEP_SUSPEND_DATA_VALIDATION_FAILED',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text: 'Step suspend data validation failed: \n' + errorMessages,
      });
    } else {
      suspendData = validatedSuspendData.data;
    }
  }
  return { suspendData, validationError };
}

export async function validateStepStateData({
  stateData,
  step,
  validateInputs,
}: {
  stateData?: any;
  step: Step<string, any, any>;
  validateInputs: boolean;
}) {
  if (!stateData) {
    return { stateData: undefined, validationError: undefined };
  }

  let validationError: Error | undefined;

  const stateSchema = step.stateSchema;

  if (stateSchema && validateInputs) {
    const validatedStateData = await validateWithStandardSchema(stateSchema, stateData);
    if (!validatedStateData.success) {
      const errorMessages = validatedStateData.issues.map(e => `- ${e.path?.join('.')}: ${e.message}`).join('\n');
      validationError = new Error('Step state data validation failed: \n' + errorMessages);
    } else {
      stateData = validatedStateData.data;
    }
  }
  return { stateData, validationError };
}

export async function validateStepRequestContext({
  requestContext,
  step,
  validateInputs,
}: {
  requestContext?: RequestContext;
  step: Step<string, any, any>;
  validateInputs: boolean;
}) {
  let validationError: Error | undefined;

  const requestContextSchema = step.requestContextSchema;

  if (requestContextSchema && validateInputs) {
    // Get all values from requestContext
    const contextValues = requestContext?.all ?? {};
    const validatedRequestContext = await validateWithStandardSchema(requestContextSchema, contextValues);
    if (!validatedRequestContext.success) {
      const errorMessages = validatedRequestContext.issues.map(e => `- ${e.path?.join('.')}: ${e.message}`).join('\n');
      validationError = new MastraError({
        id: 'WORKFLOW_STEP_REQUEST_CONTEXT_VALIDATION_FAILED',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        text: `Step request context validation failed for step '${step.id}': \n` + errorMessages,
      });
    }
  }
  return { validationError };
}

export function getResumeLabelsByStepId(
  resumeLabels: Record<string, { stepId: string; foreachIndex?: number }>,
  stepId: string,
) {
  return Object.entries(resumeLabels)
    .filter(([_, value]) => value.stepId === stepId)
    .reduce(
      (acc, [key, value]) => {
        acc[key] = value;
        return acc;
      },
      {} as Record<string, { stepId: string; foreachIndex?: number }>,
    );
}

export const runCountDeprecationMessage =
  "Warning: 'runCount' is deprecated and will be removed on November 4th, 2025. Please use 'retryCount' instead.";

/**
 * Track which deprecation warnings have been shown globally to avoid spam
 */
const shownWarnings = new Set<string>();

/**
 * Creates a Proxy that wraps execute function parameters to show deprecation warnings
 * when accessing deprecated properties.
 *
 * Currently handles:
 * - `runCount`: Deprecated in favor of `retryCount`, will be removed on November 4th, 2025
 */
export function createDeprecationProxy<T extends Record<string, any>>(
  params: T,
  {
    paramName,
    deprecationMessage,
    logger,
  }: {
    paramName: string;
    deprecationMessage: string;
    logger: IMastraLogger;
  },
): T {
  return new Proxy(params, {
    get(target, prop, receiver) {
      if (prop === paramName && !shownWarnings.has(paramName)) {
        shownWarnings.add(paramName);
        if (logger) {
          logger.warn('\x1b[33m%s\x1b[0m', deprecationMessage);
        } else {
          console.warn('\x1b[33m%s\x1b[0m', deprecationMessage);
        }
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}

export const getStepIds = (entry: StepFlowEntry): string[] => {
  if (entry.type === 'step' || entry.type === 'foreach' || entry.type === 'loop') {
    return [entry.step.id];
  }
  if (entry.type === 'parallel' || entry.type === 'conditional') {
    return entry.steps.map(s => s.step.id);
  }
  if (entry.type === 'sleep' || entry.type === 'sleepUntil') {
    return [entry.id];
  }
  return [];
};

export const createTimeTravelExecutionParams = (params: {
  steps: string[];
  inputData?: any;
  resumeData?: any;
  context?: TimeTravelContext<any, any, any, any>;
  nestedStepsContext?: Record<string, TimeTravelContext<any, any, any, any>>;
  snapshot: WorkflowRunState;
  initialState?: any;
  graph: ExecutionGraph;
  perStep?: boolean;
}) => {
  const { steps, inputData, resumeData, context, nestedStepsContext, snapshot, initialState, graph, perStep } = params;
  const firstStepId = steps[0]!;

  let executionPath: number[] = [];
  const stepResults: Record<string, StepResult<any, any, any, any>> = {};
  const snapshotContext = snapshot.context as Record<string, any>;

  for (const [index, entry] of graph.steps.entries()) {
    const currentExecPathLength = executionPath.length;
    //if there is resumeData, steps down the graph until the suspended step will have stepResult info to use
    if (currentExecPathLength > 0 && !resumeData) {
      break;
    }
    const stepIds = getStepIds(entry);
    if (stepIds.includes(firstStepId)) {
      const innerExecutionPath = stepIds?.length > 1 ? [stepIds?.findIndex(s => s === firstStepId)] : [];
      //parallel and loop steps will have more than one step id,
      // and if the step is one of those, we need the index for the execution path
      executionPath = [index, ...innerExecutionPath];
    }

    const prevStep = graph.steps[index - 1]!;
    let stepPayload = undefined;
    if (prevStep) {
      const prevStepIds = getStepIds(prevStep);
      if (prevStepIds.length > 0) {
        if (prevStepIds.length === 1) {
          stepPayload = (stepResults?.[prevStepIds[0]!] as any)?.output ?? {};
        } else {
          stepPayload = prevStepIds.reduce(
            (acc, stepId) => {
              acc[stepId] = (stepResults?.[stepId] as any)?.output ?? {};
              return acc;
            },
            {} as Record<string, any>,
          );
        }
      }
    }

    //the stepResult input is basically the payload of the first step
    if (index === 0 && stepIds.includes(firstStepId)) {
      stepResults.input = (context?.[firstStepId]?.payload ?? inputData ?? snapshotContext?.input) as any;
    } else if (index === 0) {
      stepResults.input =
        stepIds?.reduce((acc, stepId) => {
          if (acc) return acc;
          return context?.[stepId]?.payload ?? snapshotContext?.[stepId]?.payload;
        }, null) ??
        snapshotContext?.input ??
        {};
    }

    let stepOutput = undefined;
    const nextStep = graph.steps[index + 1]!;
    if (nextStep) {
      const nextStepIds = getStepIds(nextStep);
      if (
        nextStepIds.length > 0 &&
        inputData &&
        nextStepIds.includes(firstStepId) &&
        steps.length === 1 //steps being greater than 1 means it's travelling to step in a nested workflow
        //if it's a nested wokrflow step, the step being resumed in the nested workflow might not be the first step in it,
        // making the inputData the output here wrong
      ) {
        stepOutput = inputData;
      }
    }

    stepIds.forEach(stepId => {
      let result;
      const stepContext = context?.[stepId] ?? snapshotContext[stepId];
      const defaultStepStatus = steps?.includes(stepId) ? 'running' : 'success';
      const status = ['failed', 'canceled'].includes(stepContext?.status)
        ? defaultStepStatus
        : (stepContext?.status ?? defaultStepStatus);
      const isCompleteStatus = ['success', 'failed', 'canceled'].includes(status);
      result = {
        status,
        payload: context?.[stepId]?.payload ?? stepPayload ?? snapshotContext[stepId]?.payload ?? {},
        output: isCompleteStatus
          ? (context?.[stepId]?.output ?? stepOutput ?? snapshotContext[stepId]?.output ?? {})
          : undefined,
        resumePayload: stepContext?.resumePayload,
        suspendPayload: stepContext?.suspendPayload,
        suspendOutput: stepContext?.suspendOutput,
        startedAt: stepContext?.startedAt ?? Date.now(),
        endedAt: isCompleteStatus ? (stepContext?.endedAt ?? Date.now()) : undefined,
        suspendedAt: stepContext?.suspendedAt,
        resumedAt: stepContext?.resumedAt,
      };
      const execPathLengthToUse = perStep ? executionPath.length : currentExecPathLength;
      if (
        execPathLengthToUse > 0 &&
        !steps?.includes(stepId) &&
        !context?.[stepId] &&
        (!snapshotContext[stepId] || (snapshotContext[stepId] && snapshotContext[stepId].status !== 'suspended'))
      ) {
        // if the step is after the timeTravelled step in the graph
        // and it doesn't exist in the snapshot,
        // OR it exists in snapshot and is not suspended,
        // we don't need to set stepResult for it
        // if perStep is true, and the step is a parallel step,
        // we want to construct result for only the timetraveled step and any step context is passed for
        result = undefined;
      }
      if (result) {
        const formattedResult = removeUndefinedValues(result);
        stepResults[stepId] = formattedResult as any;
      }
    });
  }

  if (!executionPath.length) {
    throw new Error(
      `Time travel target step not found in execution graph: '${steps?.join('.')}'. Verify the step id/path.`,
    );
  }

  const timeTravelData: TimeTravelExecutionParams = {
    inputData,
    executionPath,
    steps,
    stepResults,
    nestedStepResults: nestedStepsContext as any,
    state: initialState ?? snapshot.value ?? {},
    resumeData,
  };

  return timeTravelData;
};

/**
 * Re-hydrates serialized errors in step results back into proper Error instances.
 * This is useful when errors have been serialized through an event system (e.g., evented engine, Inngest)
 * and need to be converted back to Error instances with their custom properties preserved.
 *
 * @param steps - The workflow step results (context) that may contain serialized errors
 * @returns The same steps object with errors hydrated as Error instances
 */
export function hydrateSerializedStepErrors(steps: WorkflowRunState['context']) {
  if (steps) {
    for (const step of Object.values(steps)) {
      if (step.status === 'failed' && 'error' in step && step.error) {
        step.error = getErrorFromUnknown(step.error, { serializeStack: false });
      }
    }
  }
  return steps;
}

/**
 * Cleans a single step result object by removing internal properties.
 * This is a helper for cleanStepResult that handles one level of cleaning.
 */
function cleanSingleResult(result: Record<string, unknown>): Record<string, unknown> {
  const { __state: _state, metadata, ...rest } = result;

  // Strip nestedRunId from metadata but keep other user-defined fields
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const { nestedRunId: _nestedRunId, ...userMetadata } = metadata as Record<string, unknown>;
    if (Object.keys(userMetadata).length > 0) {
      return { ...rest, metadata: userMetadata };
    }
  }

  return rest;
}

/**
 * Cleans step result data by removing internal properties at known structural levels.
 *
 * Removes:
 * - `__state` properties (internal workflow state for state propagation)
 * - `nestedRunId` from `metadata` objects (internal tracking for nested workflow retrieval)
 *
 * ## Why targeted cleaning instead of recursive?
 *
 * Internal properties only appear at specific, known locations:
 *
 * 1. **`__state`** - Added by step-executor.ts to every step result. For forEach,
 *    suspended iterations store the full result (including __state) while completed
 *    iterations only store the output value. See workflow-event-processor/index.ts:1227-1230.
 *
 * 2. **`metadata.nestedRunId`** - Added when nested workflows complete, stored at the
 *    step result level. For forEach with nested workflows, each iteration result can
 *    have this. See workflow-event-processor/index.ts:1449-1453.
 *
 * By only cleaning at the step result level and forEach iteration level, we avoid
 * accidentally stripping user data that happens to use `__state` as a property name
 * in their actual output values.
 *
 * @param stepResult - A step result object, or an array of iteration results (forEach)
 * @returns The cleaned step result with internal properties removed
 */
export function cleanStepResult(stepResult: unknown): unknown {
  if (stepResult === null || stepResult === undefined) {
    return stepResult;
  }

  if (typeof stepResult !== 'object') {
    return stepResult;
  }

  // Handle arrays (forEach iteration results) - clean each element at the result level only
  if (Array.isArray(stepResult)) {
    return stepResult.map(item => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return cleanSingleResult(item as Record<string, unknown>);
      }
      return item;
    });
  }

  const result = stepResult as Record<string, unknown>;
  const cleaned = cleanSingleResult(result);

  // If output is an array (forEach results), clean each iteration result
  // Iteration results can have __state (for suspended) or metadata.nestedRunId (for nested workflows)
  if (Array.isArray(cleaned.output)) {
    cleaned.output = cleaned.output.map((item: unknown) => {
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        return cleanSingleResult(item as Record<string, unknown>);
      }
      return item;
    });
  }

  return cleaned;
}
