import type { DurableAgenticWorkflowInput } from '@mastra/core/agent/durable';
import type { WorkflowRunStatus } from '@mastra/core/workflows';

export type CloudflareWorkflowStatus =
  | 'queued'
  | 'running'
  | 'paused'
  | 'errored'
  | 'terminated'
  | 'complete'
  | 'waiting'
  | 'waitingForPause'
  | 'unknown';

export interface CloudflareWorkflowInstanceStatus {
  status: CloudflareWorkflowStatus;
  error?: {
    name: string;
    message: string;
  };
  output?: unknown;
}

export interface CloudflareWorkflowInstance {
  readonly id: string;
  pause(): Promise<void>;
  resume(): Promise<void>;
  terminate(options?: { reason?: string }): Promise<void>;
  restart(options?: { from?: string }): Promise<void>;
  status(): Promise<CloudflareWorkflowInstanceStatus>;
  sendEvent<TPayload>(event: { type: string; payload: TPayload }): Promise<void>;
}

export interface CloudflareWorkflowBinding<TParams = CloudflareWorkflowAgentParams> {
  create(options: { id?: string; params: TParams }): Promise<CloudflareWorkflowInstance>;
  get(id: string): Promise<CloudflareWorkflowInstance>;
}

export interface CloudflareWorkflowAgentParams {
  runId: string;
  input: DurableAgenticWorkflowInput;
}

export interface CloudflareWorkflowEvent<TParams = CloudflareWorkflowAgentParams> {
  instanceId: string;
  payload: TParams;
}

export interface CloudflareWorkflowStep {
  do<T>(
    name: string,
    config: {
      retries: {
        limit: number;
        delay: string | number;
        backoff?: 'constant' | 'linear' | 'exponential';
      };
      timeout?: string | number;
    },
    callback: () => Promise<T>,
  ): Promise<T>;
  waitForEvent<TPayload>(
    name: string,
    options: { type: string; timeout: string | number },
  ): Promise<{ payload: TPayload; timestamp: Date; type: string }>;
}

export interface CloudflareWorkflowAgentResumeEvent {
  resumeData: unknown;
  label?: string;
}

export interface CloudflareWorkflowAgentStepRequest {
  operation: 'start' | 'resume';
  runId: string;
  idempotencyKey: string;
  input?: DurableAgenticWorkflowInput;
  resumeData?: unknown;
  label?: string;
}

export interface CloudflareWorkflowAgentStepResult {
  status: WorkflowRunStatus;
  error?: {
    message: string;
  };
  output?: unknown;
}

export interface CloudflareWorkflowStepExecutor {
  execute(request: CloudflareWorkflowAgentStepRequest): Promise<CloudflareWorkflowAgentStepResult>;
}
