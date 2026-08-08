import type {
  DurableAgentEngineContext,
  DurableAgentEngineRecoverContext,
  DurableAgentEngineResult,
  DurableAgentEngineResumeContext,
  DurableAgentEngineStartContext,
  DurableAgentEngineStatus,
  DurableAgentExecutionEngine,
} from '@mastra/core/agent/durable';
import type { MastraServerCache } from '@mastra/core/cache';
import { CachingPubSub } from '@mastra/core/events';
import type { Mastra } from '@mastra/core/mastra';
import type { Workflow } from '@mastra/core/workflows';
import type { Inngest } from 'inngest';

import type { InngestWorkflow } from '../workflow';
import { createInngestDurableAgenticWorkflow, InngestDurableStepIds } from './create-inngest-agentic-workflow';

/**
 * Maps the shared Mastra durable-agent lifecycle to Inngest operations.
 * Agent-loop behavior remains in `@mastra/core`.
 */
export class InngestDurableAgentExecutionEngine implements DurableAgentExecutionEngine {
  readonly #inngest: Inngest;
  readonly #getCache?: () => MastraServerCache | null | undefined;
  #mastra?: Mastra;

  constructor(inngest: Inngest, options: { getCache?: () => MastraServerCache | null | undefined } = {}) {
    this.#inngest = inngest;
    this.#getCache = options.getCache;
  }

  registerMastra(mastra: Mastra): void {
    this.#mastra = mastra;
  }

  createWorkflow(options: { maxSteps?: number }): Workflow<any, any, any, any, any, any, any> {
    const workflow = createInngestDurableAgenticWorkflow({
      inngest: this.#inngest,
      maxSteps: options.maxSteps,
    });
    (workflow as unknown as InngestWorkflow).__setPubsubFactory(defaultPubsub => {
      const cache = this.#getCache?.();
      return cache ? new CachingPubSub(defaultPubsub, cache) : defaultPubsub;
    });
    return workflow;
  }

  async start(context: DurableAgentEngineStartContext): Promise<DurableAgentEngineResult> {
    await this.#inngest.send({
      name: `workflow.${InngestDurableStepIds.AGENTIC_LOOP}`,
      data: {
        inputData: context.input,
        runId: context.runId,
        resourceId: context.input.state?.resourceId,
        requestContext: context.requestContext
          ? Object.fromEntries(context.requestContext.entries())
          : (context.input.requestContextEntries ?? {}),
        actor: context.actor,
        tracingOptions: context.input.options?.tracingOptions,
      },
    });
    return { status: 'running' };
  }

  async resume(context: DurableAgentEngineResumeContext): Promise<DurableAgentEngineResult> {
    const workflowsStore = await this.#mastra?.getStorage()?.getStore('workflows');
    if (!workflowsStore) {
      throw new Error(`Workflow storage is required to resume run ${context.runId}`);
    }
    const snapshot = await workflowsStore.loadWorkflowSnapshot({
      workflowName: InngestDurableStepIds.AGENTIC_LOOP,
      runId: context.runId,
    });
    if (!snapshot) {
      throw new Error(`Cannot resume run ${context.runId}: snapshot not found`);
    }

    const labelledStep = context.label ? snapshot.resumeLabels?.[context.label]?.stepId : undefined;
    const steps = labelledStep ? labelledStep.split('.') : Object.keys(snapshot.suspendedPaths ?? {});
    const requestContext = {
      ...((snapshot as { requestContext?: Record<string, unknown> }).requestContext ?? {}),
      ...(context.requestContext ? Object.fromEntries(context.requestContext.entries()) : {}),
    };

    await this.#inngest.send({
      name: `workflow.${InngestDurableStepIds.AGENTIC_LOOP}`,
      data: {
        inputData: context.resumeData,
        initialState: snapshot.value ?? {},
        runId: context.runId,
        stepResults: snapshot.context,
        resume: {
          steps,
          stepResults: snapshot.context,
          resumePayload: context.resumeData,
          resumePath: steps[0] ? snapshot.suspendedPaths?.[steps[0]] : undefined,
        },
        requestContext,
        actor: context.actor,
      },
    });
    return { status: 'running' };
  }

  async recover(context: DurableAgentEngineRecoverContext): Promise<DurableAgentEngineResult> {
    return { status: await this.status(context) };
  }

  async abort(context: DurableAgentEngineContext): Promise<void> {
    await this.#inngest.send({
      name: `cancel.workflow.${InngestDurableStepIds.AGENTIC_LOOP}`,
      data: {
        runId: context.runId,
      },
    });
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
