// Base interfaces for common properties
interface BaseWorkflowEvent {
  runId: string;
  from: 'WORKFLOW';
}

// Workflow Start Event
interface WorkflowStartEvent extends BaseWorkflowEvent {
  type: 'workflow-start';
  payload: Record<string, never>; // Empty object
}

// Workflow Step Start Event
interface WorkflowStepStartEvent extends BaseWorkflowEvent {
  type: 'workflow-step-start';
  payload: {
    id: string;
    stepName: string;
    stepCallId: string;
    payload: Record<string, any>; // Dynamic payload based on step
    startedAt: number;
    status: string;
  };
}

// Workflow Step Result Event
interface WorkflowStepResultEvent extends BaseWorkflowEvent {
  type: 'workflow-step-result';
  payload: {
    id: string;
    stepName: string;
    stepCallId: string;
    startedAt?: number;
    status: string;
    output?: Record<string, any>; // Dynamic output based on step
    endedAt: number;
    payload?: Record<string, any>; // Dynamic payload based on step
  };
}

// Union type for all workflow output types
export type WorkflowOutputType = WorkflowStartEvent | WorkflowStepStartEvent | WorkflowStepResultEvent;

// Utility type to extract the type string from the union
export type WorkflowOutputTypeString = WorkflowOutputType['type'];
