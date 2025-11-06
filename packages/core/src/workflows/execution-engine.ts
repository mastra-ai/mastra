import type { WritableStream } from 'node:stream/web';
import { MastraBase } from '../base';
import type { RequestContext } from '../di';
import { RegisteredLogger } from '../logger';
import type { Mastra } from '../mastra';
import type { Span, SpanType, TracingPolicy } from '../observability';
import type { ChunkType } from '../stream/types';
import type { Emitter, SerializedStepFlowEntry, StepResult, WorkflowRunStatus } from './types';
import type { StepFlowEntry } from '.';

/**
 * Represents an execution graph for a workflow
 */
export interface ExecutionGraph<TEngineType = any> {
  id: string;
  steps: StepFlowEntry<TEngineType>[];
  // Additional properties will be added in future implementations
}

export interface ExecutionEngineOptions {
  tracingPolicy?: TracingPolicy;
  validateInputs: boolean;
  shouldPersistSnapshot: (params: {
    stepResults: Record<string, StepResult<any, any, any, any>>;
    workflowStatus: WorkflowRunStatus;
  }) => boolean;
}
/**
 * Execution engine abstract class for building and executing workflow graphs
 * Providers will implement this class to provide their own execution logic
 */
export abstract class ExecutionEngine extends MastraBase {
  protected mastra?: Mastra;
  public options: ExecutionEngineOptions;
  constructor({ mastra, options }: { mastra?: Mastra; options: ExecutionEngineOptions }) {
    super({ name: 'ExecutionEngine', component: RegisteredLogger.WORKFLOW });
    this.mastra = mastra;
    this.options = options;
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
  abstract execute<TState, TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    disableScorers?: boolean;
    graph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    input?: TInput;
    initialState?: TState;
    resume?: {
      steps: string[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resumePayload: any;
      resumePath: number[];
      forEachIndex?: number;
      label?: string;
    };
    emitter: Emitter;
    requestContext: RequestContext;
    workflowSpan?: Span<SpanType.WORKFLOW_RUN>;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    abortController: AbortController;
    writableStream?: WritableStream<ChunkType>;
    format?: 'legacy' | 'vnext' | undefined;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  }): Promise<TOutput>;
}
