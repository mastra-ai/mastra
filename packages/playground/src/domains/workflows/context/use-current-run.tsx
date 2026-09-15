import type { WorkflowStepStatus } from '@mastra/core/workflows';
import { useContext, useMemo } from 'react';
import { WorkflowRunContext } from './workflow-run-context';

export type TripwireData = {
  reason: string;
  retry?: boolean;
  metadata?: unknown;
  processorId?: string;
};

export type ForeachProgress = {
  completedCount: number;
  totalCount: number;
  currentIndex: number;
  iterationStatus: 'success' | 'failed' | 'suspended';
  iterationOutput?: any;
};

export type Step = {
  error?: any;
  tripwire?: TripwireData;
  startedAt: number;
  endedAt?: number;
  status: WorkflowStepStatus;
  output?: any;
  input?: any;
  resumeData?: any;
  suspendOutput?: any;
  suspendPayload?: any;
  foreachProgress?: ForeachProgress;
  duration?: number;
  date?: Date;
  isForEach?: boolean;
  mapConfig?: string;
  canSuspend?: boolean;
  isParallel?: boolean;
  stepGraph?: unknown;
};

type UseCurrentRunReturnType = {
  steps: Record<string, Step>;
  runId?: string;
};

const toRunStep = (value: any): Step => {
  const hasTripwire = 'tripwire' in value && value.tripwire;

  return {
    error: hasTripwire ? undefined : 'error' in value ? value.error : undefined,
    tripwire: hasTripwire ? value.tripwire : undefined,
    startedAt: value.startedAt,
    endedAt: 'endedAt' in value ? value.endedAt : undefined,
    status: value.status,
    output: 'output' in value ? value.output : undefined,
    input: value.payload,
    resumeData: 'resumePayload' in value ? value.resumePayload : undefined,
    suspendOutput: 'suspendOutput' in value ? value.suspendOutput : undefined,
    suspendPayload: 'suspendPayload' in value ? value.suspendPayload : undefined,
    foreachProgress: 'foreachProgress' in value ? value.foreachProgress : undefined,
    duration: 'duration' in value ? value.duration : undefined,
    date: 'date' in value ? value.date : undefined,
    isForEach: 'isForEach' in value ? value.isForEach : undefined,
    mapConfig: 'mapConfig' in value ? value.mapConfig : undefined,
    canSuspend: 'canSuspend' in value ? value.canSuspend : undefined,
    isParallel: 'isParallel' in value ? value.isParallel : undefined,
    stepGraph: 'stepGraph' in value ? value.stepGraph : undefined,
  };
};

export const useCurrentRun = (): UseCurrentRunReturnType => {
  const context = useContext(WorkflowRunContext);
  const workflowCurrentSteps = context.result?.steps;
  const steps = useMemo(
    () => Object.fromEntries(Object.entries(workflowCurrentSteps ?? {}).map(([key, value]) => [key, toRunStep(value)])),
    [workflowCurrentSteps],
  );

  return { steps, runId: context.runId };
};
