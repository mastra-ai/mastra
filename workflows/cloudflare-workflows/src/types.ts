import type { DurableAgentEngineContext, DurableAgenticWorkflowInput } from '@mastra/core/agent/durable';
import type { WorkflowRunStatus } from '@mastra/core/workflows';

/** Status values returned by a Cloudflare Workflow instance. */
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

/** Serializable status projection returned by the Cloudflare binding. */
export interface CloudflareWorkflowInstanceStatus {
  status: CloudflareWorkflowStatus;
  error?: {
    name: string;
    message: string;
  };
  output?: unknown;
}

/** Cloudflare Workflow instance methods used by the execution engine. */
export interface CloudflareWorkflowInstance {
  readonly id: string;
  pause(): Promise<void>;
  resume(): Promise<void>;
  terminate(options?: { reason?: string }): Promise<void>;
  restart(options?: { from?: string }): Promise<void>;
  status(): Promise<CloudflareWorkflowInstanceStatus>;
  sendEvent<TPayload>(event: { type: string; payload: TPayload }): Promise<void>;
}

/** Typed Cloudflare Workflow binding used to create and retrieve instances. */
export interface CloudflareWorkflowBinding<TParams = CloudflareWorkflowAgentParams> {
  create(options: { id?: string; params: TParams }): Promise<CloudflareWorkflowInstance>;
  get(id: string): Promise<CloudflareWorkflowInstance>;
}

/** JSON-safe parameters persisted on the Cloudflare Workflow event. */
export interface CloudflareWorkflowAgentParams {
  runId: string;
  input: DurableAgenticWorkflowInput;
  requestContext?: Record<string, unknown>;
  actor?: DurableAgentEngineContext['actor'];
}

/** Cloudflare Workflow event carrying the durable-agent parameters. */
export interface CloudflareWorkflowEvent<TParams = CloudflareWorkflowAgentParams> {
  instanceId: string;
  payload: TParams;
}

/** Subset of the Cloudflare Workflow step API required by this adapter. */
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

/** Resume event delivered to a suspended Cloudflare Workflow instance. */
export interface CloudflareWorkflowAgentResumeEvent {
  resumeData: unknown;
  label?: string;
  requestContext?: Record<string, unknown>;
  actor?: DurableAgentEngineContext['actor'];
}

/** JSON-safe request sent from a Cloudflare step to the Mastra executor. */
export interface CloudflareWorkflowAgentStepRequest {
  operation: 'start' | 'resume';
  runId: string;
  idempotencyKey: string;
  input?: DurableAgenticWorkflowInput;
  resumeData?: unknown;
  label?: string;
  requestContext?: Record<string, unknown>;
  actor?: DurableAgentEngineContext['actor'];
}

/** Settled Mastra workflow segment returned to Cloudflare Workflows. */
export interface CloudflareWorkflowAgentStepResult {
  status: WorkflowRunStatus;
  error?: {
    message: string;
  };
  output?: unknown;
}

/** Executes one Mastra workflow segment from a Cloudflare durable step. */
export interface CloudflareWorkflowStepExecutor {
  execute(request: CloudflareWorkflowAgentStepRequest): Promise<CloudflareWorkflowAgentStepResult>;
}
