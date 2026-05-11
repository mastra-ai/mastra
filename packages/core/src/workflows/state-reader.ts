import type {
  WorkflowResumeLabel,
  WorkflowState,
  WorkflowStateSingleStepResult,
  WorkflowStateStepResult,
} from './types';

export type WorkflowSuspendedStep = {
  stepId: string;
  path: string[];
  executionPath?: number[];
  step?: WorkflowStateStepResult;
  payload?: any;
  suspendPayload?: any;
  suspendOutput?: any;
  resumeLabels: Record<string, WorkflowResumeLabel>;
};

export type WorkflowStateReader = {
  getStatus: () => WorkflowState['status'];
  getResult: () => WorkflowState['result'];
  getError: () => WorkflowState['error'];
  getStepOutput: <T = any>(stepId: string) => T | Array<T | undefined> | undefined;
  getStepPayload: <T = any>(stepId: string) => T | Array<T | undefined> | undefined;
  getSuspendedStep: () => WorkflowSuspendedStep | undefined;
  getSuspendedSteps: () => WorkflowSuspendedStep[];
  getResumeLabel: (label: string) => WorkflowResumeLabel | undefined;
  getResumeLabels: () => Record<string, WorkflowResumeLabel>;
};

const getStep = (state: WorkflowState, stepId: string) => state.steps?.[stepId];

const getFirstStepResult = (step?: WorkflowStateStepResult): WorkflowStateSingleStepResult | undefined => {
  return Array.isArray(step) ? (step.find(result => result?.status === 'suspended') ?? step[0]) : step;
};

const getNestedSuspendPath = (step?: WorkflowStateStepResult): string[] => {
  const path = getFirstStepResult(step)?.suspendPayload?.__workflow_meta?.path;
  return Array.isArray(path) ? path.filter((part): part is string => typeof part === 'string') : [];
};

export function getWorkflowStepOutput<T = any>(
  state: WorkflowState,
  stepId: string,
): T | Array<T | undefined> | undefined {
  const step = getStep(state, stepId);
  return Array.isArray(step) ? step.map(result => result?.output as T | undefined) : (step?.output as T | undefined);
}

export function getWorkflowStepPayload<T = any>(
  state: WorkflowState,
  stepId: string,
): T | Array<T | undefined> | undefined {
  const step = getStep(state, stepId);
  return Array.isArray(step) ? step.map(result => result?.payload as T | undefined) : (step?.payload as T | undefined);
}

export function getWorkflowResumeLabel(state: WorkflowState, label: string) {
  const resumeLabel = state.resumeLabels?.[label];
  return resumeLabel ? { ...resumeLabel } : undefined;
}

export function getWorkflowResumeLabels(state: WorkflowState): Record<string, WorkflowResumeLabel> {
  return Object.entries(state.resumeLabels ?? {}).reduce(
    (labels, [label, value]) => {
      labels[label] = { ...value };
      return labels;
    },
    {} as Record<string, WorkflowResumeLabel>,
  );
}

export function getWorkflowSuspendedSteps(state: WorkflowState): WorkflowSuspendedStep[] {
  return Object.entries(state.suspendedPaths ?? {}).map(([stepId, executionPath]) => {
    const step = getStep(state, stepId);
    const firstStepResult = getFirstStepResult(step);
    const nestedPath = getNestedSuspendPath(step);
    const path = nestedPath.length > 0 ? (nestedPath[0] === stepId ? nestedPath : [stepId, ...nestedPath]) : [stepId];
    const resumeLabels = Object.entries(state.resumeLabels ?? {}).reduce(
      (labels, [label, value]) => {
        if (value.stepId === stepId) {
          labels[label] = { ...value };
        }
        return labels;
      },
      {} as Record<string, WorkflowResumeLabel>,
    );

    return {
      stepId,
      path,
      executionPath,
      step,
      payload: Array.isArray(step) ? step.map(result => result?.payload) : step?.payload,
      suspendPayload: firstStepResult?.suspendPayload,
      suspendOutput: firstStepResult?.suspendOutput,
      resumeLabels,
    };
  });
}

export function getWorkflowSuspendedStep(state: WorkflowState): WorkflowSuspendedStep | undefined {
  return getWorkflowSuspendedSteps(state)[0];
}

export function createWorkflowStateReader(state: WorkflowState): WorkflowStateReader {
  return {
    getStatus: () => state.status,
    getResult: () => state.result,
    getError: () => state.error,
    getStepOutput: stepId => getWorkflowStepOutput(state, stepId),
    getStepPayload: stepId => getWorkflowStepPayload(state, stepId),
    getSuspendedStep: () => getWorkflowSuspendedStep(state),
    getSuspendedSteps: () => getWorkflowSuspendedSteps(state),
    getResumeLabel: label => getWorkflowResumeLabel(state, label),
    getResumeLabels: () => getWorkflowResumeLabels(state),
  };
}
