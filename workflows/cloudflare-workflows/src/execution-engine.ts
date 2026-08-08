import {
  createDurableAgenticWorkflow,
  type DurableAgentEngineContext,
  type DurableAgentEngineRecoverContext,
  type DurableAgentEngineResult,
  type DurableAgentEngineResumeContext,
  type DurableAgentEngineStartContext,
  type DurableAgentEngineStatus,
  type DurableAgentExecutionEngine,
} from '@mastra/core/agent/durable';
import type { Workflow } from '@mastra/core/workflows';

import { CLOUDFLARE_WORKFLOW_AGENT_RESUME_EVENT } from './constants';
import type {
  CloudflareWorkflowBinding,
  CloudflareWorkflowInstanceStatus,
  CloudflareWorkflowStatus,
} from './types';

function mapStatus(status: CloudflareWorkflowStatus): DurableAgentEngineStatus {
  if (status === 'waitingForPause') return 'paused';
  return status;
}

function mapResult(status: CloudflareWorkflowInstanceStatus): DurableAgentEngineResult {
  return {
    status: mapStatus(status.status as CloudflareWorkflowStatus),
    error: status.error ? new Error(status.error.message) : undefined,
  };
}

export interface CloudflareWorkflowExecutionEngineOptions {
  /** Cloudflare Workflows binding that owns durable instance lifecycle. */
  workflow: CloudflareWorkflowBinding;
  /** Optional mapping from a Mastra run ID to a Cloudflare instance ID. */
  instanceId?: (runId: string) => string;
}

/** Maps Mastra's durable-agent execution contract to Cloudflare Workflows. */
export class CloudflareWorkflowExecutionEngine implements DurableAgentExecutionEngine {
  readonly #binding: CloudflareWorkflowBinding;
  readonly #instanceId: (runId: string) => string;

  constructor(options: CloudflareWorkflowExecutionEngineOptions) {
    this.#binding = options.workflow;
    this.#instanceId = options.instanceId ?? (runId => runId);
  }

  createWorkflow(options: { maxSteps?: number }): Workflow<any, any, any, any, any, any, any> {
    return createDurableAgenticWorkflow(options);
  }

  async start(context: DurableAgentEngineStartContext): Promise<DurableAgentEngineResult> {
    const instanceId = this.#instanceId(context.runId);
    let instance;
    try {
      instance = await this.#binding.create({
        id: instanceId,
        params: {
          runId: context.runId,
          input: context.input,
          requestContext: context.requestContext?.toJSON(),
          actor: context.actor,
        },
      });
    } catch (createError) {
      try {
        instance = await this.#binding.get(instanceId);
        const existing = await instance.status();
        if (existing.status === 'unknown') throw createError;
      } catch {
        throw createError;
      }
    }
    return mapResult(await instance.status());
  }

  async resume(context: DurableAgentEngineResumeContext): Promise<DurableAgentEngineResult> {
    const instance = await this.#binding.get(this.#instanceId(context.runId));
    await instance.sendEvent({
      type: CLOUDFLARE_WORKFLOW_AGENT_RESUME_EVENT,
      payload: {
        resumeData: context.resumeData,
        label: context.label,
        requestContext: context.requestContext?.toJSON(),
        actor: context.actor,
      },
    });
    return mapResult(await instance.status());
  }

  async recover(context: DurableAgentEngineRecoverContext): Promise<DurableAgentEngineResult> {
    const instance = await this.#binding.get(this.#instanceId(context.runId));
    return mapResult(await instance.status());
  }

  async abort(context: DurableAgentEngineContext & { reason?: unknown }): Promise<void> {
    const instance = await this.#binding.get(this.#instanceId(context.runId));
    await instance.terminate({
      reason: context.reason instanceof Error ? context.reason.message : String(context.reason ?? 'Aborted'),
    });
  }

  async status(context: DurableAgentEngineContext): Promise<DurableAgentEngineStatus> {
    const instance = await this.#binding.get(this.#instanceId(context.runId));
    return mapStatus((await instance.status()).status);
  }
}
