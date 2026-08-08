import type { PubSub } from '../../events/pubsub';
import type { Mastra } from '../../mastra';
import type { ObservabilityContext } from '../../observability';
import type { RequestContext } from '../../request-context';
import type { Workflow } from '../../workflows';
import type { DurableAgenticWorkflowInput, DurableAgentStepLimit } from './types';

export type DurableAgentEngineStatus =
  | 'queued'
  | 'pending'
  | 'running'
  | 'waiting'
  | 'paused'
  | 'suspended'
  | 'complete'
  | 'success'
  | 'failed'
  | 'tripwire'
  | 'errored'
  | 'canceled'
  | 'bailed'
  | 'skipped'
  | 'terminated'
  | 'unknown';

export interface DurableAgentEngineResult {
  status?: DurableAgentEngineStatus;
  error?: unknown;
}

export interface DurableAgentEngineContext {
  workflow: Workflow<any, any, any, any, any, any, any>;
  runId: string;
  pubsub: PubSub;
  requestContext?: RequestContext;
  actor?: DurableAgenticWorkflowInput['options']['actor'];
}

export interface DurableAgentEngineStartContext extends DurableAgentEngineContext {
  input: DurableAgenticWorkflowInput;
  observabilityContext?: ObservabilityContext;
}

export interface DurableAgentEngineResumeContext extends DurableAgentEngineContext {
  resumeData: unknown;
  label?: string;
  observabilityContext?: ObservabilityContext;
}

export interface DurableAgentEngineRecoverContext extends DurableAgentEngineContext {
  input: DurableAgenticWorkflowInput;
  observabilityContext?: ObservabilityContext;
}

/**
 * Provider-neutral lifecycle used by durable-agent execution engines.
 *
 * Mastra owns preparation, messages, tools, memory, stream events, approval,
 * and cleanup. Provider packages only map these lifecycle operations to their
 * durable runtime.
 */
export interface DurableAgentExecutionEngine {
  createWorkflow(options: { maxSteps?: DurableAgentStepLimit }): Workflow<any, any, any, any, any, any, any>;
  start(context: DurableAgentEngineStartContext): Promise<DurableAgentEngineResult | void>;
  resume(context: DurableAgentEngineResumeContext): Promise<DurableAgentEngineResult | void>;
  recover(context: DurableAgentEngineRecoverContext): Promise<DurableAgentEngineResult | void>;
  abort(context: DurableAgentEngineContext & { reason?: unknown }): Promise<void>;
  status(context: DurableAgentEngineContext): Promise<DurableAgentEngineStatus>;
  registerMastra?(mastra: Mastra): void;
}
