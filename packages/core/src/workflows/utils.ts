import type { StandardSchemaV1 } from '@standard-schema/spec';
import { ErrorCategory, ErrorDomain, getErrorFromUnknown, MastraError } from '../error';
import type { IMastraLogger } from '../logger';
import type { RequestContext } from '../request-context';
import { getRequestContextInputValues } from '../request-context/input-source';
import type { StandardSchemaWithJSON } from '../schema';
import { removeUndefinedValues } from '../utils';
import type { ExecutionGraph } from './execution-engine';
import type { Step } from './step';
import { getEntryId } from './step-entry';
import type {
  ForeachConcurrencyContext,
  ForeachOptions,
  RestartExecutionParams,
  SingleStepEntry,
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
  step: Partial<Pick<Step<string, any, any>, 'inputSchema'>>;
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
      const isEmptyObject =
        validatedInput.data !== null &&
        typeof validatedInput.data === 'object' &&
        !Array.isArray(validatedInput.data) &&
        Object.keys(validatedInput.data as Record<string, unknown>).length === 0;
      inputData = isEmptyObject ? prevOutput : validatedInput.data;
    }
  }

  return { inputData, validationError };
}

export async function validateStepResumeData({
  resumeData,
  step,
}: {
  resumeData?: any;
  step: Partial<Pick<Step<string, any, any>, 'resumeSchema'>>;
}) {
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
  step: Partial<Pick<Step<string, any, any>, 'suspendSchema'>>;
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
    // Get input-form values so transformed contexts can be forwarded safely.
    const contextValues = getRequestContextInputValues(requestContext);
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

export function abortableSleep(duration: number, signal?: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal?.aborted) {
      resolve();
      return;
    }

    const onAbort = () => {
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(
      () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      },
      Math.max(0, duration),
    );

    signal?.addEventListener('abort', onAbort, { once: true });
  });
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

const SINGLE_STEP_TYPES = ['step', 'agent', 'tool', 'mapping'] as const;

/**
 * Whether an entry is a "single step-like" entry: a plain user step or one of the
 * declarative variants (agent / tool / mapping) that resolve to exactly one step.
 */
export function isSingleStepEntry(entry: StepFlowEntry): entry is SingleStepEntry {
  return (SINGLE_STEP_TYPES as readonly string[]).includes(entry.type);
}

/**
 * The id of a single step-like entry. Plain `step` entries key off the wrapped
 * step's id; declarative variants (agent / tool / mapping) carry their own `id`.
 *
 * Public alias of {@link getEntryId} from `./step-entry`.
 */
export const getSingleStepEntryId = getEntryId;

export const getStepIds = (entry: StepFlowEntry): string[] => {
  if (isSingleStepEntry(entry)) {
    return [getSingleStepEntryId(entry)];
  }
  if (entry.type === 'foreach' || entry.type === 'loop') {
    return [getSingleStepEntryId(entry.step)];
  }
  if (entry.type === 'parallel' || entry.type === 'conditional') {
    return entry.steps.map(s => getSingleStepEntryId(s));
  }
  if (entry.type === 'sleep' || entry.type === 'sleepUntil') {
    return [entry.id];
  }
  return [];
};

const MAX_REPORTED_SNAPSHOT_IDS = 10;

/**
 * Verifies that the live execution graph is consistent with the recorded snapshot
 * before a time-travel reconstruction is built. Without this check, any step id that
 * exists in the live graph but not in the recorded snapshot context silently
 * reconstructs to `{}`, and the execution engine then persists that reconstruction
 * over the original snapshot — irreversibly corrupting it (see issue #21137).
 *
 * Divergence rules:
 * - The target step id must exist in the live graph (enumerated via {@link getStepIds}).
 * - Every step that precedes the target in the live graph must have an entry in the
 *   recorded snapshot context or the caller-supplied context, EXCEPT legitimate
 *   no-entry cases: unselected branch steps of a pre-target conditional entry (the
 *   entry is healthy when at least one of its branch steps was recorded), sleep /
 *   sleepUntil entries, and foreach / loop entries (which may record no per-step
 *   entry when they ran zero iterations).
 * - When the snapshot context records no step entries at all (only the reserved
 *   `input` key, or nothing), the guard is a no-op: there is no recorded data to
 *   protect, and the evented engine legitimately fabricates an empty snapshot
 *   context for nested time travel when no nested snapshot exists.
 */
export const assertTimeTravelGraphMatchesSnapshot = (params: {
  targetStepId: string;
  graph: ExecutionGraph;
  snapshot: WorkflowRunState;
  context?: Record<string, any>;
}): void => {
  const { targetStepId, graph, snapshot, context } = params;
  const snapshotContext = (snapshot.context ?? {}) as Record<string, any>;
  const recordedStepIds = Object.keys(snapshotContext).filter(key => key !== 'input');

  // Empty snapshot context: nothing recorded, nothing to protect.
  if (recordedStepIds.length === 0) {
    return;
  }

  const targetEntryIndex = graph.steps.findIndex(entry => getStepIds(entry).includes(targetStepId));
  const reportedIds = recordedStepIds.slice(0, MAX_REPORTED_SNAPSHOT_IDS);
  const reportedIdsSuffix =
    recordedStepIds.length > MAX_REPORTED_SNAPSHOT_IDS
      ? `${reportedIds.join(', ')} (and ${recordedStepIds.length - MAX_REPORTED_SNAPSHOT_IDS} more)`
      : reportedIds.join(', ');

  if (targetEntryIndex === -1) {
    throw new Error(
      `Cannot time travel to step '${targetStepId}': the step does not exist in the current execution graph. ` +
        `The workflow definition has likely changed since the run was recorded (renamed step, or an unnamed .map() ` +
        `step whose generated id changed across processes). Steps recorded in the snapshot: ${reportedIdsSuffix}. ` +
        `The stored snapshot has not been modified.`,
    );
  }

  const hasRecordedEntry = (stepId: string) => snapshotContext[stepId] != null || context?.[stepId] != null;

  const missingStepIds: string[] = [];
  for (const [index, entry] of graph.steps.entries()) {
    if (index >= targetEntryIndex) {
      break;
    }
    // sleep / sleepUntil entries and zero-iteration foreach / loop entries may
    // legitimately have no recorded snapshot entry.
    if (entry.type === 'sleep' || entry.type === 'sleepUntil' || entry.type === 'foreach' || entry.type === 'loop') {
      continue;
    }
    const stepIds = getStepIds(entry);
    if (entry.type === 'conditional') {
      // A pre-target conditional is healthy when at least one of its branch steps
      // was recorded; unselected branches legitimately have no entry.
      if (stepIds.length > 0 && !stepIds.some(hasRecordedEntry)) {
        missingStepIds.push(...stepIds);
      }
      continue;
    }
    for (const stepId of stepIds) {
      if (!hasRecordedEntry(stepId)) {
        missingStepIds.push(stepId);
      }
    }
  }

  if (missingStepIds.length > 0) {
    throw new Error(
      `Cannot time travel to step '${targetStepId}': step(s) ${missingStepIds.map(id => `'${id}'`).join(', ')} ` +
        `precede the target in the current execution graph but were not recorded in the snapshot. Either the ` +
        `workflow definition changed since the run was recorded (renamed steps, or unnamed .map() steps whose ` +
        `generated ids changed across processes), or the recorded run never reached these steps (it failed, was ` +
        `canceled, or was suspended before them). Steps recorded in the snapshot: ${reportedIdsSuffix}. ` +
        `The stored snapshot has not been modified.`,
    );
  }
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

  assertTimeTravelGraphMatchesSnapshot({ targetStepId: firstStepId, graph, snapshot, context });

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
    const isTargetEntry = stepIds.includes(firstStepId);
    if (isTargetEntry) {
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
      // Siblings of the time-travel target inside a conditional were not selected by the
      // branch's condition, so they should be reported as skipped rather than as a fake
      // success (otherwise their empty output leaks into the conditional's aggregated result).
      const isUnselectedConditionalSibling = isTargetEntry && entry.type === 'conditional' && !steps?.includes(stepId);
      const defaultStepStatus = steps?.includes(stepId)
        ? 'running'
        : isUnselectedConditionalSibling
          ? 'skipped'
          : 'success';
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
    stepExecutionPath: snapshot?.stepExecutionPath,
  };

  return timeTravelData;
};

export const createRestartExecutionParams = ({
  snapshot,
  graph,
}: {
  snapshot: WorkflowRunState;
  graph: ExecutionGraph;
}) => {
  let nestedWorkflowPending = false;

  if (snapshot.status !== 'running' && snapshot.status !== 'waiting') {
    const hasPendingInput =
      snapshot.status === 'pending' &&
      snapshot.context &&
      Object.prototype.hasOwnProperty.call(snapshot.context, 'input');
    if (hasPendingInput) {
      //possible the server died just before the nested workflow execution started.
      //only nested workflows have input data in context when it's still pending
      nestedWorkflowPending = true;
    } else {
      throw new Error('This workflow run was not active');
    }
  }

  let nestedWorkflowActiveStepsPath: Record<string, number[]> = {};

  const firstEntry = graph.steps[0]!;

  if (isSingleStepEntry(firstEntry)) {
    nestedWorkflowActiveStepsPath = {
      [getSingleStepEntryId(firstEntry)]: [0],
    };
  } else if (firstEntry.type === 'foreach' || firstEntry.type === 'loop') {
    nestedWorkflowActiveStepsPath = {
      [getSingleStepEntryId(firstEntry.step)]: [0],
    };
  } else if (firstEntry.type === 'sleep' || firstEntry.type === 'sleepUntil') {
    nestedWorkflowActiveStepsPath = {
      [firstEntry.id]: [0],
    };
  } else if (firstEntry.type === 'conditional' || firstEntry.type === 'parallel') {
    nestedWorkflowActiveStepsPath = firstEntry.steps.reduce(
      (acc, step) => {
        acc[getSingleStepEntryId(step)] = [0];
        return acc;
      },
      {} as Record<string, number[]>,
    );
  }
  const restartData: RestartExecutionParams = {
    activePaths: nestedWorkflowPending ? [0] : snapshot.activePaths,
    activeStepsPath: nestedWorkflowPending ? nestedWorkflowActiveStepsPath : snapshot.activeStepsPath,
    stepResults: snapshot.context,
    state: snapshot.value,
    stepExecutionPath: snapshot?.stepExecutionPath,
  };

  return restartData;
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
  const { __state: _state, __stateDelta: _stateDelta, metadata, ...rest } = result;

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

/**
 * Strips fields that describe a step's *previous* completion from a step-info
 * object before it is published on a watch event.
 *
 * Step-info objects spread the step's prior result (`...stepResults[step.id]`)
 * so persisted snapshots keep resume context (original `payload`, timestamps).
 * Watch events must not re-publish those completion blobs: on a loop, the
 * previous iteration's `output` is byte-identical to the next iteration's
 * `payload`, so every `workflow-step-start` would ship the state twice
 * (megabytes per event for durable agent runs). Result/suspended events get
 * their fresh completion fields from the current execution result instead.
 */
export function omitPriorSuspensionFields<T extends Record<string, unknown>>(
  stepInfo: T,
): Omit<T, 'suspendedAt' | 'suspendPayload' | 'suspendOutput'> {
  const {
    suspendedAt: _suspendedAt,
    suspendPayload: _suspendPayload,
    suspendOutput: _suspendOutput,
    ...rest
  } = stepInfo;
  return rest;
}

export function omitPriorCompletionFields<T extends Record<string, unknown>>(
  stepInfo: T,
): Omit<
  T,
  'output' | 'error' | 'endedAt' | 'suspendedAt' | 'suspendPayload' | 'suspendOutput' | 'tripwire' | 'nonRetryable'
> {
  const {
    output: _output,
    error: _error,
    endedAt: _endedAt,
    suspendedAt: _suspendedAt,
    suspendPayload: _suspendPayload,
    suspendOutput: _suspendOutput,
    tripwire: _tripwire,
    nonRetryable: _nonRetryable,
    ...rest
  } = stepInfo;
  return rest;
}

/**
 * Resolves the effective concurrency for a foreach entry at execution time.
 *
 * Supports both a static number and a {@link ForeachConcurrencyResolver}
 * function that derives concurrency from the run's input. Invalid or
 * non-positive values fall back to 1 (sequential).
 */
export function resolveForeachConcurrency(
  opts: ForeachOptions | undefined,
  context: ForeachConcurrencyContext,
): number {
  const configured = opts?.concurrency ?? 1;
  const resolved = typeof configured === 'function' ? configured(context) : configured;
  if (typeof resolved !== 'number' || !Number.isFinite(resolved) || resolved < 1) {
    return 1;
  }
  return Math.floor(resolved);
}

const RESUME_SNAPSHOT_POLL_INTERVAL_MS = 25;
const RESUME_SNAPSHOT_POLL_TIMEOUT_MS = 2000;
const RESUME_SNAPSHOT_WAIT_STATUSES = new Set(['running', 'pending']);

export async function waitForSuspendedSnapshot(
  workflowsStore:
    | { loadWorkflowSnapshot: (args: { workflowName: string; runId: string }) => Promise<WorkflowRunState | null> }
    | undefined,
  workflowName: string,
  runId: string,
  {
    timeoutMs = RESUME_SNAPSHOT_POLL_TIMEOUT_MS,
    missingSnapshotGraceReads = 1,
  }: { timeoutMs?: number; missingSnapshotGraceReads?: number } = {},
): Promise<WorkflowRunState | null> {
  if (!workflowsStore) return null;

  const deadline = Date.now() + timeoutMs;
  let snapshot: WorkflowRunState | null = null;
  let missingReads = 0;
  let observedTransitionableSnapshot = false;

  while (Date.now() < deadline) {
    snapshot = (await workflowsStore.loadWorkflowSnapshot({ workflowName, runId })) ?? null;

    if (snapshot) {
      if (!RESUME_SNAPSHOT_WAIT_STATUSES.has(snapshot.status)) return snapshot;
      observedTransitionableSnapshot = true;
    } else if (!observedTransitionableSnapshot && ++missingReads >= missingSnapshotGraceReads) {
      return null;
    }

    await new Promise(resolve => setTimeout(resolve, RESUME_SNAPSHOT_POLL_INTERVAL_MS));
  }

  return snapshot;
}
