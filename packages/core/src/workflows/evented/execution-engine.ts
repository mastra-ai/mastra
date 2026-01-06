import type { RequestContext } from '../../di';
import type { PubSub } from '../../events/pubsub';
import type { Event } from '../../events/types';
import type { Mastra } from '../../mastra';
import { ExecutionEngine } from '../../workflows/execution-engine';
import type { ExecutionEngineOptions, ExecutionGraph } from '../../workflows/execution-engine';
import type {
  SerializedStepFlowEntry,
  StepResult,
  RestartExecutionParams,
  TimeTravelExecutionParams,
  WorkflowRunStatus,
} from '../types';
import { hydrateSerializedStepErrors } from '../utils';
import type { WorkflowEventProcessor } from './workflow-event-processor';
import { getStep } from './workflow-event-processor/utils';

export class EventedExecutionEngine extends ExecutionEngine {
  protected eventProcessor: WorkflowEventProcessor;

  constructor({
    mastra,
    eventProcessor,
    options,
  }: {
    mastra?: Mastra;
    eventProcessor: WorkflowEventProcessor;
    options: ExecutionEngineOptions;
  }) {
    super({ mastra, options });
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
    restart?: RestartExecutionParams;
    timeTravel?: TimeTravelExecutionParams;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
    };
    pubsub?: PubSub; // Not used - evented engine uses this.mastra.pubsub directly
    requestContext: RequestContext;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    abortController: AbortController;
    format?: 'legacy' | 'vnext' | undefined;
    perStep?: boolean;
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
          requestContext: Object.fromEntries(params.requestContext.entries()),
          format: params.format,
          perStep: params.perStep,
        },
      });
    } else if (params.timeTravel) {
      const prevStep = getStep(this.mastra!.getWorkflow(params.workflowId), params.timeTravel.executionPath);
      const prevResult = params.timeTravel.stepResults[prevStep?.id ?? 'input'];
      await pubsub.publish('workflows', {
        type: 'workflow.start',
        runId: params.runId,
        data: {
          workflowId: params.workflowId,
          runId: params.runId,
          executionPath: params.timeTravel.executionPath,
          stepResults: params.timeTravel.stepResults,
          timeTravel: params.timeTravel,
          prevResult: { status: 'success', output: prevResult?.payload },
          requestContext: Object.fromEntries(params.requestContext.entries()),
          format: params.format,
          perStep: params.perStep,
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
          requestContext: Object.fromEntries(params.requestContext.entries()),
          format: params.format,
          perStep: params.perStep,
        },
      });
    }

    const resultData: any = await new Promise((resolve, reject) => {
      const finishCb = async (event: Event, ack?: () => Promise<void>) => {
        if (event.runId !== params.runId) {
          await ack?.();
          return;
        }

        if (['workflow.end', 'workflow.fail', 'workflow.suspend'].includes(event.type)) {
          await ack?.();
          await pubsub.unsubscribe('workflows-finish', finishCb);
          // Re-hydrate serialized errors back to Error instances when workflow fails
          if (event.type === 'workflow.fail' && event.data.stepResults) {
            event.data.stepResults = hydrateSerializedStepErrors(event.data.stepResults);
          }
          resolve(event.data);
          return;
        }

        await ack?.();
      };

      pubsub.subscribe('workflows-finish', finishCb).catch(err => {
        this.mastra?.getLogger()?.error('Failed to subscribe to workflows-finish:', err);
        reject(err);
      });
    });

    // Build the callback argument with proper typing for invokeLifecycleCallbacks
    let callbackArg: {
      status: WorkflowRunStatus;
      result?: any;
      error?: any;
      steps: Record<string, StepResult<any, any, any, any>>;
    };

    if (resultData.prevResult.status === 'failed') {
      callbackArg = {
        status: 'failed',
        error: resultData.prevResult.error,
        steps: resultData.stepResults,
      };
    } else if (resultData.prevResult.status === 'suspended') {
      callbackArg = {
        status: 'suspended',
        steps: resultData.stepResults,
      };
    } else if (resultData.prevResult.status === 'paused' || params.perStep) {
      callbackArg = {
        status: 'paused',
        steps: resultData.stepResults,
      };
    } else {
      callbackArg = {
        status: resultData.prevResult.status,
        result: resultData.prevResult?.output,
        steps: resultData.stepResults,
      };
    }

    if (callbackArg.status !== 'paused') {
      // Invoke lifecycle callbacks before returning
      await this.invokeLifecycleCallbacks(callbackArg);
    }

    // Build the final result with any additional fields needed for the return type
    let result: TOutput;
    if (resultData.prevResult.status === 'suspended') {
      const suspendedSteps = Object.entries(resultData.stepResults)
        .map(([_stepId, stepResult]: [string, any]) => {
          if (stepResult.status === 'suspended') {
            return stepResult.suspendPayload?.__workflow_meta?.path ?? [];
          }
          return null;
        })
        .filter(Boolean);
      result = {
        ...callbackArg,
        suspended: suspendedSteps,
      } as TOutput;
    } else {
      result = callbackArg as TOutput;
    }

    return result;
  }
}
