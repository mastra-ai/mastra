import { trace, context as otlpContext } from '@opentelemetry/api';
import type { Span } from '@opentelemetry/api';
import type { z } from 'zod';

import type { IAction, MastraPrimitives } from '../action';
import { MastraBase } from '../base';

import type { Step } from './step';
import type {
  ActionContext,
  RetryConfig,
  StepConfig,
  StepDef,
  StepGraph,
  StepNode,
  StepVariableType,
  WorkflowOptions,
  WorkflowRunState,
} from './types';
import { isVariableReference, updateStepInHierarchy } from './utils';
import { WorkflowInstance } from './workflow-instance';
import type { WorkflowResultReturn } from './workflow-instance';

export class Workflow<
  TSteps extends Step<any, any, any>[] = any,
  TTriggerSchema extends z.ZodType<any> = any,
> extends MastraBase {
  name: string;
  triggerSchema?: TTriggerSchema;
  #retryConfig?: RetryConfig;
  #mastra?: MastraPrimitives;
  #runs: Map<string, WorkflowInstance<TSteps, TTriggerSchema>> = new Map();

  // registers stepIds on `after` calls
  #afterStepStack: string[] = [];
  #lastStepStack: string[] = [];
  #stepGraph: StepGraph = { initial: [] };
  #stepSubscriberGraph: Record<string, StepGraph> = {};
  #steps: Record<string, IAction<any, any, any, any>> = {};
  #onStepTransition: Set<(state: WorkflowRunState) => void | Promise<void>> = new Set();
  #executionSpan: Span | undefined;

  /**
   * Creates a new Workflow instance
   * @param name - Identifier for the workflow (not necessarily unique)
   * @param logger - Optional logger instance
   */
  constructor({ name, triggerSchema, retryConfig, mastra }: WorkflowOptions<TTriggerSchema>) {
    super({ component: 'WORKFLOW', name });

    this.name = name;
    this.#retryConfig = retryConfig;
    this.triggerSchema = triggerSchema;
    this.#mastra = mastra;

    if (mastra?.logger) {
      this.logger = mastra?.logger;
    }
  }

  step<
    TStep extends IAction<any, any, any, any>,
    CondStep extends StepVariableType<any, any, any, any>,
    VarStep extends StepVariableType<any, any, any, any>,
  >(step: TStep, config?: StepConfig<TStep, CondStep, VarStep, TTriggerSchema>) {
    const { variables = {} } = config || {};

    const requiredData: Record<string, any> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && isVariableReference(variable)) {
        requiredData[key] = variable;
      }
    }

    const stepKey = this.#makeStepKey(step);

    const graphEntry: StepNode = {
      step,
      config: {
        ...this.#makeStepDef(stepKey),
        ...config,
        data: requiredData,
      },
    };

    this.#steps[stepKey] = step;

    const parentStepKey = this.#afterStepStack[this.#afterStepStack.length - 1];
    const stepGraph = this.#stepSubscriberGraph[parentStepKey || ''];

    // if we are in an after chain and we have a stepGraph
    if (parentStepKey && stepGraph) {
      // if the stepGraph has an initial, but it doesn't contain the current step, add it to the initial
      if (!stepGraph.initial.some(step => step.step.id === stepKey)) {
        stepGraph.initial.push(graphEntry);
      }
      // add the current step to the stepGraph
      stepGraph[stepKey] = [];
    } else {
      // Normal step addition to main graph
      if (!this.#stepGraph[stepKey]) this.#stepGraph[stepKey] = [];
      this.#stepGraph.initial.push(graphEntry);
    }
    this.#lastStepStack.push(stepKey);

    return this;
  }

  #makeStepKey(step: Step<any, any, any>) {
    // return `${step.id}${this.#delimiter}${Object.keys(this.steps2).length}`;
    return `${step.id}`;
  }

  then<
    TStep extends IAction<any, any, any, any>,
    CondStep extends StepVariableType<any, any, any, any>,
    VarStep extends StepVariableType<any, any, any, any>,
  >(step: TStep, config?: StepConfig<TStep, CondStep, VarStep, TTriggerSchema>) {
    const { variables = {} } = config || {};

    const requiredData: Record<string, any> = {};

    // Add valid variables to requiredData
    for (const [key, variable] of Object.entries(variables)) {
      if (variable && isVariableReference(variable)) {
        requiredData[key] = variable;
      }
    }

    const lastStepKey = this.#lastStepStack[this.#lastStepStack.length - 1];
    const stepKey = this.#makeStepKey(step);

    const graphEntry: StepNode = {
      step,
      config: {
        ...this.#makeStepDef(stepKey),
        ...config,
        data: requiredData,
      },
    };

    this.#steps[stepKey] = step;
    // if then is called without a step, we are done
    if (!lastStepKey) return this;

    const parentStepKey = this.#afterStepStack[this.#afterStepStack.length - 1];
    const stepGraph = this.#stepSubscriberGraph[parentStepKey || ''];

    if (parentStepKey && stepGraph && stepGraph[lastStepKey]) {
      stepGraph[lastStepKey].push(graphEntry);
    } else {
      // add the step to the graph if not already there.. it should be there though, unless magic
      if (!this.#stepGraph[lastStepKey]) this.#stepGraph[lastStepKey] = [];

      // add the step to the graph
      this.#stepGraph[lastStepKey].push(graphEntry);
    }

    return this;
  }

  after<TStep extends IAction<any, any, any, any>>(step: TStep) {
    const stepKey = this.#makeStepKey(step);
    this.#afterStepStack.push(stepKey);

    // Initialize subscriber array for this step if it doesn't exist
    if (!this.#stepSubscriberGraph[stepKey]) {
      this.#stepSubscriberGraph[stepKey] = { initial: [] };
    }

    return this as Omit<typeof this, 'then' | 'after'>;
  }

  /**
   * Executes the workflow with the given trigger data
   * @param triggerData - Initial data to start the workflow with
   * @returns Promise resolving to workflow results or rejecting with error
   * @throws Error if trigger schema validation fails
   */

  createRun(): WorkflowResultReturn<TTriggerSchema> {
    const run = new WorkflowInstance({
      logger: this.logger,
      name: this.name,
      mastra: this.#mastra,
      retryConfig: this.#retryConfig,

      steps: this.#steps,
      stepGraph: this.#stepGraph,
      stepSubscriberGraph: this.#stepSubscriberGraph,

      onStepTransition: this.#onStepTransition,
      onFinish: () => {
        this.#runs.delete(run.runId);
      },
    });
    this.#runs.set(run.runId, run);
    return {
      start: run.start.bind(run),
      runId: run.runId,
    };
  }

  /**
   * Rebuilds the machine with the current steps configuration and validates the workflow
   *
   * This is the last step of a workflow builder method chain
   * @throws Error if validation fails
   *
   * @returns this instance for method chaining
   */
  commit() {
    // this.#validateWorkflow();
    return this;
  }

  // record all object paths that leads to a suspended state
  #getSuspendedPaths({
    value,
    path,
    suspendedPaths,
  }: {
    value: string | Record<string, string>;
    path: string;
    suspendedPaths: Set<string>;
  }) {
    if (typeof value === 'string') {
      if (value === 'suspended') {
        suspendedPaths.add(path);
      }
    } else {
      Object.keys(value).forEach(key =>
        this.#getSuspendedPaths({ value: value[key]!, path: path ? `${path}.${key}` : key, suspendedPaths }),
      );
    }
  }

  async #loadWorkflowSnapshot(runId: string) {
    if (!this.#mastra?.storage) {
      this.logger.debug('Snapshot cannot be loaded. Mastra engine is not initialized', { runId });
      return;
    }

    const activeRun = this.#runs.get(runId);
    if (activeRun) {
      await activeRun.persistWorkflowSnapshot();
    }
    return this.#mastra.storage.loadWorkflowSnapshot({ runId, workflowName: this.name });
  }

  #makeStepDef<TStepId extends TSteps[number]['id'], TSteps extends Step<any, any, any>[]>(
    stepId: TStepId,
  ): StepDef<TStepId, TSteps, any, any>[TStepId] {
    const executeStep = (
      handler: (data: any) => Promise<(data: any) => void>,
      spanName: string,
      attributes?: Record<string, string>,
    ) => {
      return async (data: any) => {
        return await otlpContext.with(trace.setSpan(otlpContext.active(), this.#executionSpan as Span), async () => {
          // @ts-ignore
          return this.#mastra.telemetry.traceMethod(handler, {
            spanName,
            attributes,
          })(data);
        });
      };
    };

    const handler = async ({ context, ...rest }: ActionContext<TSteps[number]['inputSchema']>) => {
      const targetStep = this.#steps[stepId];
      if (!targetStep) throw new Error(`Step not found`);

      const { payload = {}, execute } = targetStep;

      // Merge static payload with dynamically resolved variables
      // Variables take precedence over payload values
      const mergedData = {
        ...(payload as {}),
        ...context,
      };

      // Only trace if telemetry is available and action exists
      const finalAction = this.#mastra?.telemetry
        ? executeStep(execute, `workflow.${this.name}.action.${stepId}`, {
            componentName: this.name,
            runId: context.runId,
          })
        : execute;

      return finalAction ? await finalAction({ context: mergedData, ...rest }) : {};
    };

    // Only trace handler if telemetry is available

    const finalHandler = ({ context, ...rest }: ActionContext<TSteps[number]['inputSchema']>) => {
      if (this.#executionSpan) {
        return executeStep(handler, `workflow.${this.name}.step.${stepId}`, {
          componentName: this.name,
          runId: context.runId,
        })({ context, ...rest });
      }

      return handler({ context, ...rest });
    };

    return {
      handler: finalHandler,
      data: {},
    };
  }

  #getActivePathsAndStatus(value: Record<string, any>): Array<{
    stepPath: string[];
    stepId: string;
    status: string;
  }> {
    const paths: Array<{
      stepPath: string[];
      stepId: string;
      status: string;
    }> = [];

    const traverse = (current: Record<string, any>, path: string[] = []) => {
      for (const [key, value] of Object.entries(current)) {
        const currentPath = [...path, key];

        if (typeof value === 'string') {
          // Found a leaf state
          paths.push({
            stepPath: currentPath,
            stepId: key,
            status: value,
          });
        } else if (typeof value === 'object' && value !== null) {
          // Continue traversing
          traverse(value, currentPath);
        }
      }
    };

    traverse(value);
    return paths;
  }

  async getState(runId: string): Promise<WorkflowRunState | null> {
    // If this is the currently running workflow
    const run = this.#runs.get(runId);
    if (run) {
      return run.getState();
    }

    // If workflow is suspended/stored, get from storage
    const storedSnapshot = await this.#mastra?.storage?.loadWorkflowSnapshot({
      runId,
      workflowName: this.name,
    });

    if (storedSnapshot) {
      const parsed = storedSnapshot;

      const m = this.#getActivePathsAndStatus(parsed.value);

      return {
        runId,
        value: parsed.value,
        context: parsed.context,
        activePaths: m,
        timestamp: Date.now(),
      };
    }

    return null;
  }

  watch(onTransition: (state: WorkflowRunState) => void): () => void {
    this.#onStepTransition.add(onTransition);

    return () => {
      this.#onStepTransition.delete(onTransition);
    };
  }

  async resume({
    runId,
    stepId,
    context: resumeContext,
  }: {
    runId: string;
    stepId: string;
    context?: Record<string, any>;
  }) {
    const snapshot = await this.#loadWorkflowSnapshot(runId);

    if (!snapshot) {
      throw new Error(`No snapshot found for workflow run ${runId}`);
    }

    console.dir({ resume: { snapshot, resumeContext } }, { depth: 4 });

    let parsedSnapshot;
    try {
      parsedSnapshot = typeof snapshot === 'string' ? JSON.parse(snapshot as unknown as string) : snapshot;
    } catch (error) {
      this.logger.debug('Failed to parse workflow snapshot for resume', { error, runId });
      throw new Error('Failed to parse workflow snapshot');
    }

    console.log('parsedSnapshot', parsedSnapshot);

    const startStepId = parsedSnapshot.suspendedSteps?.[stepId];
    if (!startStepId) {
      return;
    }
    parsedSnapshot = startStepId === 'trigger' ? parsedSnapshot : parsedSnapshot?.childStates?.[startStepId];
    if (!parsedSnapshot) {
      throw new Error(`No snapshot found for step: ${stepId} starting at ${startStepId}`);
    }

    // Update context if provided

    if (resumeContext) {
      parsedSnapshot.context.steps[stepId] = {
        status: 'success',
        output: {
          ...(parsedSnapshot?.context?.steps?.[stepId]?.output || {}),
          ...resumeContext,
        },
      };
    }

    // Reattach the step handler
    // TODO: need types
    if (parsedSnapshot.children) {
      Object.entries(parsedSnapshot.children).forEach(([_childId, child]: [string, any]) => {
        if (child.snapshot?.input?.stepNode) {
          // Reattach handler
          const stepDef = this.#makeStepDef(child.snapshot.input.stepNode.step.id);
          child.snapshot.input.stepNode.config = {
            ...child.snapshot.input.stepNode.config,
            ...stepDef,
          };

          // Sync the context
          child.snapshot.input.context = parsedSnapshot.context;
        }
      });
    }

    parsedSnapshot.value = updateStepInHierarchy(parsedSnapshot.value, stepId);

    // Reset attempt count
    if (parsedSnapshot.context?.attempts) {
      parsedSnapshot.context.attempts[stepId] =
        this.#steps[stepId]?.retryConfig?.attempts || this.#retryConfig?.attempts || 3;
    }

    this.logger.debug('Resuming workflow with updated snapshot', {
      updatedSnapshot: parsedSnapshot,
      runId,
      stepId,
    });

    console.dir({ resuming: startStepId, value: parsedSnapshot?.value }, { depth: null });
    const run =
      this.#runs.get(runId) ??
      new WorkflowInstance({
        logger: this.logger,
        name: this.name,
        mastra: this.#mastra,
        retryConfig: this.#retryConfig,

        steps: this.#steps,
        stepGraph: this.#stepGraph,
        stepSubscriberGraph: this.#stepSubscriberGraph,

        onStepTransition: this.#onStepTransition,
        runId,
        onFinish: () => {
          this.#runs.delete(run.runId);
        },
      });

    return run?.execute({
      snapshot: parsedSnapshot,
      stepId: startStepId,
    });
  }
  __registerPrimitives(p: MastraPrimitives) {
    if (p.telemetry) {
      this.__setTelemetry(p.telemetry);
    }

    if (p.logger) {
      this.__setLogger(p.logger);
    }

    this.#mastra = p;
  }

  get stepGraph() {
    return this.#stepGraph;
  }

  get stepSubscriberGraph() {
    return this.#stepSubscriberGraph;
  }

  get steps() {
    return this.#steps;
  }
}
