import { useContext } from 'react';
import { WorkflowRunContext } from './workflow-run-context';

/**
 * Tripwire data from workflow steps.
 * This matches the core TripwireData schema in packages/core/src/agent/trip-wire.ts
 */
export type TripwireData = {
  /** The reason for the tripwire */
  reason: string;
  /** If true, the agent should retry with the tripwire reason as feedback */
  retry?: boolean;
  /** Strongly typed metadata from the processor */
  metadata?: unknown;
  /** The ID of the processor that triggered the tripwire */
  processorId?: string;
};

export type Step = {
  error?: any;
  tripwire?: TripwireData;
  startedAt: number;
  endedAt?: number;
  status: 'running' | 'success' | 'failed' | 'suspended' | 'waiting';
  output?: any;
  input?: any;
  resumeData?: any;
  suspendOutput?: any;
  suspendPayload?: any;
};

type UseCurrentRunReturnType = {
  steps: Record<string, Step>;
  runId?: string;
};

export const useCurrentRun = (): UseCurrentRunReturnType => {
  const context = useContext(WorkflowRunContext);

  const workflowCurrentSteps = context.result?.steps ?? {};
  const steps = Object.entries(workflowCurrentSteps).reduce((acc, [key, value]: [string, any]) => {
    // Check if this is a tripwire (failed step with tripwire property)
    const hasTripwire = 'tripwire' in value && value.tripwire;

    return {
      ...acc,
      [key]: {
        // Don't include error when tripwire is present - tripwire takes precedence
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
      },
    };
  }, {});

  return { steps, runId: context.runId };
};
