import type { Mastra } from '@mastra/core/mastra';
import type { RequestContext } from '@mastra/core/di';
import { Run } from '@mastra/core/workflows';
import type {
  ExecutionEngine,
  ExecutionGraph,
  SerializedStepFlowEntry,
  Step,
  StepWithComponent,
  WorkflowEngineType,
  WorkflowResult,
} from '@mastra/core/workflows';
import type { z } from 'zod';
import { mainWorkflow } from './runtime.workflow';
import type { VercelEngineType } from './types';

/**
 * VercelRun
 *
 * Represents a single execution of a VercelWorkflow.
 * Handles starting, resuming, and tracking workflow execution
 * using Vercel's durable execution capabilities.
 */
export class VercelRun<
  TEngineType = VercelEngineType,
  TSteps extends Step<string, any, any, any, any, any, any>[] = Step<string, any, any, any, any, any, any>[],
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
> extends Run<TEngineType, TSteps, TState, TInput, TOutput> {
  #mastra?: Mastra;
  serializedStepGraph: SerializedStepFlowEntry[];

  /**
   * Pending operations for durable execution.
   * Maps operationId -> closure that executes the operation.
   * Used by wrapDurableOperation to pass closures to runStep.
   */
  pendingOperations: Map<string, () => Promise<any>> = new Map();

  constructor(params: {
    workflowId: string;
    runId: string;
    resourceId?: string;
    executionEngine: ExecutionEngine;
    executionGraph: ExecutionGraph;
    serializedStepGraph: SerializedStepFlowEntry[];
    mastra?: Mastra;
    retryConfig?: {
      attempts?: number;
      delay?: number;
    };
    cleanup?: () => void;
    workflowSteps: Record<string, StepWithComponent>;
    workflowEngineType: WorkflowEngineType;
    validateInputs?: boolean;
  }) {
    super(params);
    this.#mastra = params.mastra;
    this.serializedStepGraph = params.serializedStepGraph;
  }

  /**
   * Serialize RequestContext to a plain object for passing to mainWorkflow.
   */
  private serializeRequestContext(requestContext?: RequestContext): Record<string, any> {
    if (!requestContext) return {};
    const obj: Record<string, any> = {};
    requestContext.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }

  /**
   * Start the workflow execution.
   */
  async start(params: {
    inputData?: z.infer<TInput>;
    requestContext?: RequestContext;
    initialState?: z.infer<TState>;
    outputOptions?: {
      includeState?: boolean;
      includeResumeLabels?: boolean;
    };
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    // Persist initial running state
    if (this.#mastra?.getStorage()) {
      await this.#mastra.getStorage()?.persistWorkflowSnapshot({
        workflowName: this.workflowId,
        runId: this.runId,
        resourceId: this.resourceId,
        snapshot: {
          runId: this.runId,
          serializedStepGraph: this.serializedStepGraph,
          status: 'running',
          value: params.initialState ?? {},
          context: { input: params.inputData } as any,
          activePaths: [],
          suspendedPaths: {},
          activeStepsPath: {},
          resumeLabels: {},
          waitingPaths: {},
          timestamp: Date.now(),
        },
      });
    }

    // Validate input if schema exists
    const inputDataToUse = await this._validateInput(params.inputData);
    const initialStateToUse = await this._validateInitialState(params.initialState ?? {});

    // Call the mainWorkflow function which has "use workflow" directive
    const result = await mainWorkflow({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      input: inputDataToUse,
      initialState: initialStateToUse,
      requestContext: this.serializeRequestContext(params.requestContext),
      retryConfig: this.retryConfig,
      validateInputs: this.validateInputs,
      outputOptions: params.outputOptions,
    });

    // Cleanup if workflow completed (not suspended)
    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    return result as WorkflowResult<TState, TInput, TOutput, TSteps>;
  }

  /**
   * Resume a suspended workflow.
   */
  async resume<TResumeSchema extends z.ZodType<any>>(params: {
    resumeData?: z.infer<TResumeSchema>;
    step:
      | Step<string, any, any, TResumeSchema, any>
      | [...Step<string, any, any, any, any>[], Step<string, any, any, TResumeSchema, any>]
      | string
      | string[];
    requestContext?: RequestContext;
    forEachIndex?: number;
    label?: string;
  }): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const storage = this.#mastra?.getStorage();

    // Parse step parameter to get step IDs
    let steps: string[] = [];
    if (typeof params.step === 'string') {
      steps = params.step.split('.');
    } else {
      steps = (Array.isArray(params.step) ? params.step : [params.step]).map(step =>
        typeof step === 'string' ? step : step?.id,
      );
    }

    // Load existing snapshot
    const snapshot = await storage?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    if (!snapshot) {
      throw new Error(`No snapshot found for workflow run ${this.runId}`);
    }

    // Validate resume data
    const suspendedStep = this.workflowSteps[steps?.[0] ?? ''];
    const resumeDataToUse = await this._validateResumeData(params.resumeData, suspendedStep);

    // Merge persisted requestContext with new values
    const persistedRequestContext = (snapshot as any)?.requestContext ?? {};
    const newRequestContext = this.serializeRequestContext(params.requestContext);
    const mergedRequestContext = { ...persistedRequestContext, ...newRequestContext };

    // Call mainWorkflow with resume params
    const result = await mainWorkflow({
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      input: snapshot.context?.input,
      initialState: snapshot.value ?? {},
      resume: {
        steps,
        stepResults: snapshot.context as any,
        resumePayload: resumeDataToUse,
        resumePath: steps?.[0] ? ((snapshot.suspendedPaths?.[steps[0]] as number[]) ?? []) : [],
        forEachIndex: params.forEachIndex,
        label: params.label,
      },
      requestContext: mergedRequestContext,
      retryConfig: this.retryConfig,
      validateInputs: this.validateInputs,
    });

    // Cleanup if workflow completed
    if (result.status !== 'suspended') {
      this.cleanup?.();
    }

    return result as WorkflowResult<TState, TInput, TOutput, TSteps>;
  }

  /**
   * Watch for workflow events.
   * TODO: Implement event watching if Vercel supports it.
   */
  watch(_cb: (event: any) => void): () => void {
    // TODO: Implement Vercel event subscription if available
    console.warn('VercelRun.watch() is not yet implemented');
    return () => {};
  }
}
