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
import type { CloudflareWorkflowBinding, CloudflareWorkflowStatus } from './types';

function mapStatus(status: CloudflareWorkflowStatus): DurableAgentEngineStatus {
  if (status === 'waitingForPause') return 'paused';
  return status;
}

export interface CloudflareWorkflowExecutionEngineOptions {
  workflow: CloudflareWorkflowBinding;
  instanceId?: (runId: string) => string;
}

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
    return { status: mapStatus((await instance.status()).status) };
  }

  async resume(context: DurableAgentEngineResumeContext): Promise<DurableAgentEngineResult> {
    const instance = await this.#binding.get(this.#instanceId(context.runId));
    await instance.sendEvent({
      type: CLOUDFLARE_WORKFLOW_AGENT_RESUME_EVENT,
      payload: {
        resumeData: context.resumeData,
        label: context.label,
      },
    });
    return { status: mapStatus((await instance.status()).status) };
  }

  async recover(context: DurableAgentEngineRecoverContext): Promise<DurableAgentEngineResult> {
    return { status: await this.status(context) };
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
