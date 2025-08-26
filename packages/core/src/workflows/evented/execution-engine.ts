import type { Emitter, ExecutionGraph, SerializedStepFlowEntry, StepResult, Mastra } from '../..';
import type { RuntimeContext } from '../../di';
import type { Event } from '../../events/types';
import { ExecutionEngine } from '../../workflows/execution-engine';
import type { WorkflowEventProcessor } from './workflow-event-processor';
import { getStep } from './workflow-event-processor/utils';

export class EventedExecutionEngine extends ExecutionEngine {
  protected eventProcessor: WorkflowEventProcessor;

  constructor({ mastra, eventProcessor }: { mastra?: Mastra; eventProcessor: WorkflowEventProcessor }) {
    super({ mastra });
    this.eventProcessor = eventProcessor;
  }

  __registerMastra(mastra: Mastra) {
    this.mastra = mastra;
    this.eventProcessor.__registerMastra(mastra);
  }

  /**
   * Executes a workflow run with the provided execution graph and input
   * @param graph The execution graph to execute
   * @param input The input data for the workflow
   * @returns A promise that resolves to the workflow output
   */
  async execute<TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    graph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    input?: TInput;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    emitter: Emitter;
    runtimeContext: RuntimeContext;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    abortController: AbortController;
  }): Promise<TOutput> {
    const pubsub = this.mastra?.pubsub;
    if (!pubsub) {
      throw new Error('No Pubsub adapter configured on the Mastra instance');
    }

    if (params.resume) {
      const prevStep = getStep(this.mastra!.getWorkflow(params.workflowId), params.resume.resumePath);
      const prevResult = params.resume.stepResults[prevStep?.id ?? 'input'];

      await pubsub.publish('workflows', {
        type: 'workflow.resume',
        runId: params.runId,
        data: {
          workflowId: params.workflowId,
          runId: params.runId,
          executionPath: params.resume.resumePath,
          stepResults: params.resume.stepResults,
          resumeSteps: params.resume.steps,
          prevResult: { status: 'success', output: prevResult?.payload },
          resumeData: params.resume.resumePayload,
          runtimeContext: Object.fromEntries(params.runtimeContext.entries()),
        },
      });
    } else {
      await pubsub.publish('workflows', {
        type: 'workflow.start',
        runId: params.runId,
        data: {
          workflowId: params.workflowId,
          runId: params.runId,
          prevResult: { status: 'success', output: params.input },
          runtimeContext: Object.fromEntries(params.runtimeContext.entries()),
        },
      });
    }

    const resultData: any = await new Promise(resolve => {
      const finishCb = async (event: Event, ack?: () => Promise<void>) => {
        if (event.runId !== params.runId) {
          await ack?.();
          return;
        }

        if (['workflow.end', 'workflow.fail', 'workflow.suspend'].includes(event.type)) {
          await ack?.();
          await pubsub.unsubscribe('workflows-finish', finishCb);
          resolve(event.data);
          return;
        }

        await ack?.();
      };

      pubsub.subscribe('workflows-finish', finishCb).catch(() => {});
    });

    if (resultData.prevResult.status === 'failed') {
      return {
        status: 'failed',
        error: resultData.prevResult.error,
        steps: resultData.stepResults,
      } as TOutput;
    } else if (resultData.prevResult.status === 'suspended') {
      const suspendedSteps = Object.entries(resultData.stepResults)
        .map(([_stepId, stepResult]: [string, any]) => {
          if (stepResult.status === 'suspended') {
            return stepResult.suspendPayload?.__workflow_meta?.path ?? [];
          }

          return null;
        })
        .filter(Boolean);
      return {
        status: 'suspended',
        steps: resultData.stepResults,
        suspended: suspendedSteps,
      } as TOutput;
    }

    return {
      status: resultData.prevResult.status,
      result: resultData.prevResult?.output,
      steps: resultData.stepResults,
    } as TOutput;
  }
}
