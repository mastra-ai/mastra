import { isEmpty } from 'radash';
import type z from 'zod';
import type { IMastraLogger } from '../logger';
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

export function getZodErrors(error: z.ZodError) {
  // zod v4 returns issues instead of errors
  const errors = error.issues;
  return errors;
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

  if (validateInputs) {
    const inputSchema = step.inputSchema;

    const validatedInput = await inputSchema.safeParseAsync(prevOutput);

    if (!validatedInput.success) {
      const errors = getZodErrors(validatedInput.error);
      const errorMessages = errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n');

      validationError = new Error('Step input validation failed: \n' + errorMessages);
    } else {
      inputData = isEmpty(validatedInput.data) ? prevOutput : validatedInput.data;
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
    const validatedResumeData = await resumeSchema.safeParseAsync(resumeData);
    if (!validatedResumeData.success) {
      const errors = getZodErrors(validatedResumeData.error);
      const errorMessages = errors.map((e: z.ZodIssue) => `- ${e.path?.join('.')}: ${e.message}`).join('\n');
      validationError = new Error('Step resume data validation failed: \n' + errorMessages);
    } else {
      resumeData = validatedResumeData.data;
    }
  }
  return { resumeData, validationError };
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
}) => {
  const { steps, inputData, resumeData, context, nestedStepsContext, snapshot, initialState, graph } = params;
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
    // let stepFound = false;
    // let stepInParallel = false;
    const stepIds = getStepIds(entry);
    if (stepIds.includes(firstStepId)) {
      const innerExecutionPath = stepIds?.length > 1 ? [stepIds?.findIndex(s => s === firstStepId)] : [];
      //parallel and loop steps will have more than one step id,
      // and if the step is one of those, we need the index for the execution path
      executionPath = [index, ...innerExecutionPath];
      // stepFound = true;
      // stepInParallel = stepIds?.length > 1;
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
      if (
        currentExecPathLength > 0 &&
        (!snapshotContext[stepId] || (snapshotContext[stepId] && snapshotContext[stepId].status !== 'suspended'))
      ) {
        // if the step is after the timeTravelled step in the graph
        // and it doesn't exist in the snapshot,
        // OR it exists in snapshot and is not suspended,
        // we don't need to set stepResult for it
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
