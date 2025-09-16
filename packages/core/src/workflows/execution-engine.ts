import type { Mastra, SerializedStepFlowEntry } from '..';
import type { AISpan, AISpanType, TracingPolicy } from '../ai-tracing';
import { MastraBase } from '../base';
import type { RuntimeContext } from '../di';
import { RegisteredLogger } from '../logger';
import type { ChunkType } from '../stream/types';
import type { Emitter, StepResult } from './types';
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
}
/**
 * Execution engine abstract class for building and executing workflow graphs
 * Providers will implement this class to provide their own execution logic
 */
export abstract class ExecutionEngine extends MastraBase {
  protected mastra?: Mastra;
  readonly options?: ExecutionEngineOptions;
  constructor({ mastra, options }: { mastra?: Mastra; options?: ExecutionEngineOptions }) {
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
  abstract execute<TInput, TOutput>(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    disableScorers?: boolean;
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
    workflowAISpan?: AISpan<AISpanType.WORKFLOW_RUN>;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    abortController: AbortController;
    writableStream?: WritableStream<ChunkType>;
    format?: 'aisdk' | 'mastra' | undefined;
  }): Promise<TOutput>;
}
