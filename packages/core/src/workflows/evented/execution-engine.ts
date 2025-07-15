import type { Emitter, ExecutionGraph, SerializedStepFlowEntry, StepResult, Mastra } from '../..';
import { ExecutionEngine } from '../..';
import type { RuntimeContext } from '../../di';
import type { PubSub, Event } from '../../events';
import type { WorkflowEventProcessor } from './workflow-event-processor';
import { getStep } from './workflow-event-processor/utils';

export class EventedExecutionEngine extends ExecutionEngine {
  protected eventProcessor: WorkflowEventProcessor;
  protected pubsub: PubSub;

  constructor({
    mastra,
    eventProcessor,
    pubsub,
  }: {
    mastra?: Mastra;
    eventProcessor: WorkflowEventProcessor;
    pubsub: PubSub;
  }) {
    super({ mastra });
    this.eventProcessor = eventProcessor;
    this.pubsub = pubsub;
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
    const tempCb = async (event: Event) => {
      console.log('event', event);
      try {
        await this.eventProcessor.process(event);
      } catch (e) {
        console.error('Error processing event', e);
      }
    };
    await this.pubsub.subscribe('workflows', tempCb);

    console.log('starting run');
    if (params.resume) {
      const prevStep = getStep(this.mastra!.getWorkflow(params.workflowId), params.resume.resumePath);
      const prevResult = params.resume.stepResults[prevStep?.id ?? 'input'];
      console.log('resuming run', {
        workflowId: params.workflowId,
        runId: params.runId,
        executionPath: params.resume.resumePath,
        stepResults: params.resume.stepResults,
        resumeSteps: params.resume.steps,
        prevResult: { status: 'success', output: prevResult?.payload },
        resumeData: params.resume.resumePayload,
      });
      await this.pubsub.publish('workflows', {
        type: 'workflow.resume',
        data: {
          workflowId: params.workflowId,
          runId: params.runId,
          executionPath: params.resume.resumePath,
          stepResults: params.resume.stepResults,
          resumeSteps: params.resume.steps,
          prevResult: { status: 'success', output: prevResult?.payload },
          resumeData: params.resume.resumePayload,
        },
      });
    } else {
      await this.pubsub.publish('workflows', {
        type: 'workflow.start',
        data: {
          workflowId: params.workflowId,
          runId: params.runId,
          prevResult: { status: 'success', output: params.input },
        },
      });
    }

    const resultData: any = await new Promise(resolve => {
      const finishCb = async (event: Event) => {
        if (event.type === 'workflow.end' && event.data.runId === params.runId) {
          resolve(event.data);
        } else if (event.type === 'workflow.fail' && event.data.runId === params.runId) {
          resolve(event.data);
        } else if (event.type === 'workflow.suspend' && event.data.runId === params.runId) {
          resolve(event.data);
        }
      };

      this.pubsub.subscribe('workflows', finishCb).catch(() => {});
    });

    await this.pubsub.unsubscribe('workflows', tempCb);

    console.log('resultData', resultData);

    if (resultData.prevResult.status === 'failed') {
      return {
        status: 'failed',
        error: resultData.prevResult.error,
        steps: resultData.stepResults,
      } as TOutput;
    } else if (resultData.prevResult.status === 'suspended') {
      return {
        status: 'suspended',
        steps: resultData.stepResults,
      } as TOutput;
    }

    return {
      status: resultData.prevResult.status,
      result: resultData.prevResult?.output,
      steps: resultData.stepResults,
    } as TOutput;
  }
}
