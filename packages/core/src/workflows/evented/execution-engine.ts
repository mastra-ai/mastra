import type { Emitter, ExecutionGraph, SerializedStepFlowEntry, StepResult, Mastra } from '../..';
import { ExecutionEngine } from '../..';
import type { RuntimeContext } from '../../di';
import type { WorkflowEventProcessor } from './workflow-event-processor';

export class EventedExecutionEngine extends ExecutionEngine {
  protected eventProcessor: WorkflowEventProcessor;

  constructor({ mastra, eventProcessor }: { mastra?: Mastra; eventProcessor: WorkflowEventProcessor }) {
    super({ mastra });
    this.eventProcessor = eventProcessor;
  }

  __registerMastra(mastra: Mastra) {
    this.mastra = mastra;
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
    return {} as any;
  }
}
