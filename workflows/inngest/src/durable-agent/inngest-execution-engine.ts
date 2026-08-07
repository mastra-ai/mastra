import type {
  DurableAgentEngineContext,
  DurableAgentEngineRecoverContext,
  DurableAgentEngineResult,
  DurableAgentEngineResumeContext,
  DurableAgentEngineStartContext,
  DurableAgentEngineStatus,
  DurableAgentExecutionEngine,
} from '@mastra/core/agent/durable';
import type { PubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { Workflow } from '@mastra/core/workflows';
import type { Inngest } from 'inngest';

import type { InngestWorkflow } from '../workflow';
import { createInngestDurableAgenticWorkflow, InngestDurableStepIds } from './create-inngest-agentic-workflow';

function asInngestWorkflow(workflow: Workflow<any, any, any, any, any, any, any>): InngestWorkflow {
  return workflow as unknown as InngestWorkflow;
}

/**
 * Maps the shared Mastra durable-agent lifecycle to Inngest operations.
 * Agent-loop behavior remains in `@mastra/core`.
 */
export class InngestDurableAgentExecutionEngine implements DurableAgentExecutionEngine {
  readonly #inngest: Inngest;
  #mastra?: Mastra;
  #pubsub?: PubSub;

  constructor(inngest: Inngest) {
    this.#inngest = inngest;
  }

  registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  createWorkflow(): Workflow<any, any, any, any, any, any, any> {
    const workflow = createInngestDurableAgenticWorkflow({ inngest: this.#inngest });
    (workflow as unknown as InngestWorkflow).__setPubsubFactory(defaultPubsub => this.#pubsub ?? defaultPubsub);
    return workflow;
  }

  async start(context: DurableAgentEngineStartContext): Promise<DurableAgentEngineResult> {
    this.#pubsub = context.pubsub;
    const run = await asInngestWorkflow(context.workflow).createRun({
      runId: context.runId,
      pubsub: context.pubsub,
    });
    await run.startAsync({
      inputData: context.input,
      requestContext: context.requestContext,
      actor: context.actor,
      ...context.observabilityContext,
    });
    return { status: 'running' };
  }

  async resume(context: DurableAgentEngineResumeContext): Promise<DurableAgentEngineResult> {
    this.#pubsub = context.pubsub;
    const run = await asInngestWorkflow(context.workflow).createRun({
      runId: context.runId,
      pubsub: context.pubsub,
    });
    await run.resumeAsync({
      resumeData: context.resumeData,
      label: context.label,
      requestContext: context.requestContext,
      actor: context.actor,
    });
    return { status: 'running' };
  }

  async recover(context: DurableAgentEngineRecoverContext): Promise<DurableAgentEngineResult> {
    return { status: await this.status(context) };
  }

  async abort(context: DurableAgentEngineContext): Promise<void> {
    const run = await asInngestWorkflow(context.workflow).createRun({
      runId: context.runId,
      pubsub: context.pubsub,
    });
    await run.cancel();
  }

  async status(context: DurableAgentEngineContext): Promise<DurableAgentEngineStatus> {
    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: InngestDurableStepIds.AGENTIC_LOOP,
      runId: context.runId,
    });
    return (snapshot?.status as DurableAgentEngineStatus | undefined) ?? 'unknown';
  }
}
