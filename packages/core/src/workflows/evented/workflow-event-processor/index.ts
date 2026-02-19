import { randomUUID } from 'node:crypto';
import EventEmitter from 'node:events';
import { ErrorCategory, ErrorDomain, MastraError, getErrorFromUnknown } from '../../../error';
import { EventProcessor } from '../../../events/processor';
import type { Event } from '../../../events/types';
import type { Mastra } from '../../../mastra';
import { RequestContext } from '../../../request-context/';
import type {
  StepFlowEntry,
  StepResult,
  StepSuccess,
  TimeTravelExecutionParams,
  WorkflowRunState,
} from '../../../workflows/types';
import type { Workflow } from '../../../workflows/workflow';
import { createTimeTravelExecutionParams, validateStepResumeData } from '../../utils';
import { resolveCurrentState } from '../helpers';
import { StepExecutor } from '../step-executor';
import { EventedWorkflow } from '../workflow';
import { processWorkflowForEach, processWorkflowLoop } from './loop';
import { processWorkflowConditional, processWorkflowParallel } from './parallel';
import { processWorkflowSleep, processWorkflowSleepUntil, processWorkflowWaitForEvent } from './sleep';
import { getNestedWorkflow, getStep, isExecutableStep } from './utils';

export type ProcessorArgs = {
  activeSteps: Record<string, boolean>;
  workflow: Workflow;
  workflowId: string;
  runId: string;
  executionPath: number[];
  stepResults: Record<string, StepResult<any, any, any, any>>;
  resumeSteps: string[];
  prevResult: StepResult<any, any, any, any>;
  requestContext: Record<string, any>;
  timeTravel?: TimeTravelExecutionParams;
  resumeData?: any;
  parentWorkflow?: ParentWorkflow;
  parentContext?: {
    workflowId: string;
    input: any;
  };
  retryCount?: number;
  perStep?: boolean;
  state?: Record<string, any>;
  outputOptions?: {
    includeState?: boolean;
    includeResumeLabels?: boolean;
  };
  forEachIndex?: number;
  nestedRunId?: string; // runId of nested workflow when reporting back to parent
};

export type ParentWorkflow = {
  workflowId: string;
  runId: string;
  executionPath: number[];
  resume: boolean;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  parentWorkflow?: ParentWorkflow;
  stepId: string;
};

export class WorkflowEventProcessor extends EventProcessor {
  private stepExecutor: StepExecutor;
  // Map of runId -> AbortController for active workflow runs
  private abortControllers: Map<string, AbortController> = new Map();
  // Map of child runId -> parent runId for tracking nested workflows
  private parentChildRelationships: Map<string, string> = new Map();

  constructor({ mastra }: { mastra: Mastra }) {
    super({ mastra });
    this.stepExecutor = new StepExecutor({ mastra });
  }

  /**
   * Get or create an AbortController for a workflow run
   */
  private getOrCreateAbortController(runId: string): AbortController {
    let controller = this.abortControllers.get(runId);
    if (!controller) {
      controller = new AbortController();
      this.abortControllers.set(runId, controller);
    }
    return controller;
  }

  /**
   * Cancel a workflow run and all its nested child workflows
   */
  private cancelRunAndChildren(runId: string): void {
    // Abort the controller for this run
    const controller = this.abortControllers.get(runId);
    if (controller) {
      controller.abort();
    }

    // Find and cancel all child workflows
    for (const [childRunId, parentRunId] of this.parentChildRelationships.entries()) {
      if (parentRunId === runId) {
        this.cancelRunAndChildren(childRunId);
      }
    }
  }

  /**
   * Clean up abort controller and relationships when a workflow completes.
   * Also cleans up any orphaned child entries that reference this run as parent.
   */
  private cleanupRun(runId: string): void {
    this.abortControllers.delete(runId);
    this.parentChildRelationships.delete(runId);

    // Clean up any orphaned child entries pointing to this run as their parent
    for (const [childRunId, parentRunId] of this.parentChildRelationships.entries()) {
      if (parentRunId === runId) {
        this.parentChildRelationships.delete(childRunId);
      }
    }
  }

  __registerMastra(mastra: Mastra) {
    super.__registerMastra(mastra);
    this.stepExecutor.__registerMastra(mastra);
  }

  private async errorWorkflow(
    {
      parentWorkflow,
      workflowId,
      runId,
      resumeSteps,
      stepResults,
      resumeData,
      requestContext,
    }: Omit<ProcessorArgs, 'workflow'>,
    e: Error,
  ) {
    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.fail',
      runId,
      data: {
        workflowId,
        runId,
        executionPath: [],
        resumeSteps,
        stepResults,
        prevResult: { status: 'failed', error: getErrorFromUnknown(e).toJSON() },
        requestContext,
        resumeData,
        activeSteps: {},
        parentWorkflow: parentWorkflow,
      },
    });
  }

  protected async processWorkflowCancel({ workflowId, runId }: ProcessorArgs) {
    // Cancel this workflow and all nested child workflows
    this.cancelRunAndChildren(runId);

    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const currentState = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: workflowId,
      runId,
    });

    if (!currentState) {
      this.mastra.getLogger()?.warn('Canceling workflow without loaded state', { workflowId, runId });
    }

    await this.endWorkflow(
      {
        workflow: undefined as any,
        workflowId,
        runId,
        stepResults: (currentState?.context ?? {}) as any,
        prevResult: { status: 'canceled' } as any,
        requestContext: (currentState?.requestContext ?? {}) as any,
        executionPath: [],
        activeSteps: {},
        resumeSteps: [],
        resumeData: undefined,
        parentWorkflow: undefined,
      },
      'canceled',
    );
  }

  protected async processWorkflowStart({
    workflow,
    parentWorkflow,
    workflowId,
    runId,
    resumeSteps,
    prevResult,
    resumeData,
    timeTravel,
    executionPath,
    stepResults,
    requestContext,
    perStep,
    state,
    outputOptions,
    forEachIndex,
  }: ProcessorArgs & { initialState?: Record<string, any> }) {
    // Use initialState from event data if provided, otherwise use state from ProcessorArgs
    const initialState = (arguments[0] as any).initialState ?? state ?? {};
    // Create abort controller for this workflow run
    this.getOrCreateAbortController(runId);

    // Track parent-child relationship if this is a nested workflow
    if (parentWorkflow?.runId) {
      this.parentChildRelationships.set(runId, parentWorkflow.runId);
    }
    // Preserve resourceId from existing snapshot if present
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const existingRun = await workflowsStore?.getWorkflowRunById({ runId, workflowName: workflow.id });
    const resourceId = existingRun?.resourceId;

    // Check shouldPersistSnapshot option - default to true if not specified
    // This is particularly important for resume: if shouldPersist returns false for 'running',
    // we shouldn't overwrite the existing 'suspended' status with 'running'
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: 'running',
      }) ?? true;

    if (shouldPersist) {
      await workflowsStore?.persistWorkflowSnapshot({
        workflowName: workflow.id,
        runId,
        resourceId,
        snapshot: {
          activePaths: [],
          suspendedPaths: {},
          resumeLabels: {},
          waitingPaths: {},
          activeStepsPath: {},
          serializedStepGraph: workflow.serializedStepGraph,
          timestamp: Date.now(),
          runId,
          context: {
            ...(stepResults ?? {
              input: prevResult?.status === 'success' ? prevResult.output : undefined,
            }),
            __state: initialState,
          },
          status: 'running',
          value: initialState,
        },
      });
    }

    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.step.run',
      runId,
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionPath: executionPath ?? [0],
        resumeSteps,
        stepResults: {
          ...(stepResults ?? {
            input: prevResult?.status === 'success' ? prevResult.output : undefined,
          }),
          __state: initialState,
        },
        prevResult,
        timeTravel,
        requestContext,
        resumeData,
        activeSteps: {},
        perStep,
        state: initialState,
        outputOptions,
        forEachIndex,
      },
    });
  }

  protected async endWorkflow(args: ProcessorArgs, status: 'success' | 'failed' | 'canceled' | 'paused' = 'success') {
    const { workflowId, runId, prevResult, perStep, workflow, stepResults } = args;
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');

    // Check shouldPersistSnapshot option - default to true if not specified
    const finalStatus = perStep && status === 'success' ? 'paused' : status;
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: finalStatus,
      }) ?? true;

    if (shouldPersist) {
      await workflowsStore?.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: finalStatus,
          result: prevResult,
        },
      });
    }

    if (perStep) {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-paused',
          payload: {},
        },
      });
    }

    await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'workflow-finish',
        payload: {
          runId,
        },
      },
    });

    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.end',
      runId,
      data: { ...args, workflow: undefined },
    });
  }

  protected async processWorkflowEnd(args: ProcessorArgs) {
    const {
      resumeSteps,
      prevResult,
      resumeData,
      parentWorkflow,
      activeSteps,
      requestContext,
      runId,
      timeTravel,
      perStep,
      stepResults,
      state,
      workflowId: _workflowId,
    } = args;

    // Extract final state from stepResults or args
    const finalState = resolveCurrentState({ stepResults, state });

    // Clean up abort controller and parent-child tracking
    this.cleanupRun(runId);

    // handle nested workflow
    if (parentWorkflow) {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId: parentWorkflow.runId, // Use parent's runId for event routing
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          executionPath: parentWorkflow.executionPath,
          resumeSteps,
          stepResults: parentWorkflow.stepResults,
          prevResult,
          resumeData,
          activeSteps,
          parentWorkflow: parentWorkflow.parentWorkflow,
          parentContext: parentWorkflow,
          requestContext,
          timeTravel,
          perStep,
          state: finalState,
          nestedRunId: runId, // Pass nested workflow's runId for step retrieval
        },
      });
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.end',
      runId,
      data: { ...args, workflow: undefined, state: finalState },
    });
  }

  protected async processWorkflowSuspend(args: ProcessorArgs) {
    const {
      resumeSteps,
      prevResult,
      resumeData,
      parentWorkflow,
      activeSteps,
      runId,
      requestContext,
      timeTravel,
      stepResults,
      state,
      outputOptions,
    } = args;

    // Extract final state from stepResults or args
    const finalState = resolveCurrentState({ stepResults, state });

    // TODO: if there are still active paths don't end the workflow yet
    // handle nested workflow
    if (parentWorkflow) {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId: parentWorkflow.runId, // Use parent's runId for event routing
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          executionPath: parentWorkflow.executionPath,
          resumeSteps,
          stepResults: parentWorkflow.stepResults,
          prevResult: {
            ...prevResult,
            suspendPayload: {
              ...prevResult.suspendPayload,
              __workflow_meta: {
                runId: runId,
                path: parentWorkflow?.stepId
                  ? [parentWorkflow.stepId].concat(prevResult.suspendPayload?.__workflow_meta?.path ?? [])
                  : (prevResult.suspendPayload?.__workflow_meta?.path ?? []),
              },
            },
          },
          timeTravel,
          resumeData,
          activeSteps,
          requestContext,
          parentWorkflow: parentWorkflow.parentWorkflow,
          parentContext: parentWorkflow,
          state: finalState,
          outputOptions,
          nestedRunId: runId, // Pass nested workflow's runId for step retrieval
        },
      });
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.suspend',
      runId,
      data: { ...args, workflow: undefined, state: finalState },
    });
  }

  protected async processWorkflowFail(args: ProcessorArgs) {
    const {
      workflowId,
      runId,
      resumeSteps,
      prevResult,
      resumeData,
      parentWorkflow,
      activeSteps,
      requestContext,
      timeTravel,
      stepResults,
      state,
      outputOptions,
      workflow,
    } = args;

    // Extract final state from stepResults or args
    const finalState = resolveCurrentState({ stepResults, state });

    // Clean up abort controller and parent-child tracking
    this.cleanupRun(runId);

    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');

    // Check shouldPersistSnapshot option - default to true if not specified
    const shouldPersist =
      workflow?.options?.shouldPersistSnapshot?.({
        stepResults: stepResults ?? {},
        workflowStatus: 'failed',
      }) ?? true;

    if (shouldPersist) {
      await workflowsStore?.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: 'failed',
          error: (prevResult as any).error,
        },
      });
    }

    // handle nested workflow
    if (parentWorkflow) {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId: parentWorkflow.runId, // Use parent's runId for event routing
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          executionPath: parentWorkflow.executionPath,
          resumeSteps,
          stepResults: parentWorkflow.stepResults,
          prevResult,
          timeTravel,
          resumeData,
          activeSteps,
          requestContext,
          parentWorkflow: parentWorkflow.parentWorkflow,
          parentContext: parentWorkflow,
          state: finalState,
          outputOptions,
          nestedRunId: runId, // Pass nested workflow's runId for step retrieval
        },
      });
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.fail',
      runId,
      data: { ...args, workflow: undefined, state: finalState },
    });
  }

  protected async processWorkflowStepRun({
    workflow,
    workflowId,
    runId,
    executionPath,
    stepResults,
    activeSteps,
    resumeSteps,
    timeTravel,
    prevResult,
    resumeData,
    parentWorkflow,
    requestContext,
    retryCount = 0,
    perStep,
    state,
    outputOptions,
    forEachIndex,
  }: ProcessorArgs) {
    // Get current state from stepResults.__state or from passed state
    const currentState = resolveCurrentState({ stepResults, state });
    let stepGraph: StepFlowEntry[] = workflow.stepGraph;

    if (!executionPath?.length) {
      return this.errorWorkflow(
        {
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Execution path is empty: ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    let step: StepFlowEntry | undefined = stepGraph[executionPath[0]!];

    if (!step) {
      // If we're past the last step, end the workflow successfully
      if (executionPath[0]! >= stepGraph.length) {
        return this.endWorkflow({
          workflow,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult,
          activeSteps,
          requestContext,
          // Use currentState (resolved from stepResults.__state and state) instead of
          // the possibly-undefined state parameter, to ensure final state is preserved
          state: currentState,
          outputOptions,
        });
      }
      return this.errorWorkflow(
        {
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step not found in step graph: ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    if ((step.type === 'parallel' || step.type === 'conditional') && executionPath.length > 1) {
      step = step.steps[executionPath[1]!] as StepFlowEntry;
    } else if (step.type === 'parallel') {
      return processWorkflowParallel(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          timeTravel,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
        {
          pubsub: this.mastra.pubsub,
          step,
        },
      );
    } else if (step?.type === 'conditional') {
      return processWorkflowConditional(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          timeTravel,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
        },
      );
    } else if (step?.type === 'sleep') {
      return processWorkflowSleep(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          timeTravel,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
        },
      );
    } else if (step?.type === 'sleepUntil') {
      return processWorkflowSleepUntil(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          timeTravel,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
        },
      );
    } else if (step?.type === 'foreach' && executionPath.length === 1) {
      return processWorkflowForEach(
        {
          workflow,
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          timeTravel,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
          perStep,
          state: currentState,
          outputOptions,
          forEachIndex,
        },
        {
          pubsub: this.mastra.pubsub,
          mastra: this.mastra,
          step,
        },
      );
    }

    if (!isExecutableStep(step)) {
      return this.errorWorkflow(
        {
          workflowId,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          prevResult,
          resumeData,
          parentWorkflow,
          requestContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step is not executable: ${step?.type} -- ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    activeSteps[step.step.id] = true;

    const workflowsStore = await this.mastra?.getStorage()?.getStore('workflows');

    // Run nested workflow - check for both EventedWorkflow and regular Workflow
    if (step.step instanceof EventedWorkflow || (step.step as any).component === 'WORKFLOW') {
      // Handle resume with only nested workflow ID specified (auto-detect suspended inner step)
      if (resumeSteps?.length === 1 && resumeSteps[0] === step.step.id) {
        const stepData = stepResults[step.step.id];
        const nestedRunId = stepData?.suspendPayload?.__workflow_meta?.runId;
        if (!nestedRunId) {
          return this.errorWorkflow(
            {
              workflowId,
              runId,
              executionPath,
              stepResults,
              activeSteps,
              resumeSteps,
              prevResult,
              resumeData,
              parentWorkflow,
              requestContext,
            },
            new MastraError({
              id: 'MASTRA_WORKFLOW',
              text: `Nested workflow run id not found for auto-detection: ${JSON.stringify(stepResults)}`,
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }

        const snapshot = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: step.step.id,
          runId: nestedRunId,
        });

        // Auto-detect the suspended step within the nested workflow
        const suspendedStepId = Object.keys(snapshot?.suspendedPaths ?? {})?.[0];
        if (!suspendedStepId) {
          return this.errorWorkflow(
            {
              workflowId,
              runId,
              executionPath,
              stepResults,
              activeSteps,
              resumeSteps,
              prevResult,
              resumeData,
              parentWorkflow,
              requestContext,
            },
            new MastraError({
              id: 'MASTRA_WORKFLOW',
              text: `No suspended step found in nested workflow: ${step.step.id}`,
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }

        const nestedExecutionPath = snapshot?.suspendedPaths?.[suspendedStepId];
        const nestedStepResults = snapshot?.context;

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.resume',
          runId,
          data: {
            workflowId: step.step.id,
            parentWorkflow: {
              stepId: step.step.id,
              workflowId,
              runId,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
            },
            executionPath: nestedExecutionPath as any,
            runId: nestedRunId,
            resumeSteps: [suspendedStepId], // Resume the auto-detected inner step
            stepResults: nestedStepResults,
            prevResult,
            resumeData,
            activeSteps,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      } else if (resumeSteps?.length > 1) {
        const stepData = stepResults[step.step.id];
        const nestedRunId = stepData?.suspendPayload?.__workflow_meta?.runId;
        if (!nestedRunId) {
          return this.errorWorkflow(
            {
              workflowId,
              runId,
              executionPath,
              stepResults,
              activeSteps,
              resumeSteps,
              prevResult,
              resumeData,
              parentWorkflow,
              requestContext,
            },
            new MastraError({
              id: 'MASTRA_WORKFLOW',
              text: `Nested workflow run id not found: ${JSON.stringify(stepResults)}`,
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }

        const snapshot = await workflowsStore?.loadWorkflowSnapshot({
          workflowName: step.step.id,
          runId: nestedRunId,
        });

        const nestedStepResults = snapshot?.context;
        const nestedSteps = resumeSteps.slice(1);

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.resume',
          runId,
          data: {
            workflowId: step.step.id,
            parentWorkflow: {
              stepId: step.step.id,
              workflowId,
              runId,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
            },
            executionPath: snapshot?.suspendedPaths?.[nestedSteps[0]!] as any,
            runId: nestedRunId,
            resumeSteps: nestedSteps,
            stepResults: nestedStepResults,
            prevResult,
            resumeData,
            activeSteps,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      } else if (timeTravel && timeTravel.steps?.length > 1 && timeTravel.steps[0] === step.step.id) {
        const snapshot =
          (await workflowsStore?.loadWorkflowSnapshot({
            workflowName: step.step.id,
            runId,
          })) ?? ({ context: {} } as WorkflowRunState);

        // Cast to Workflow since we know this is a nested workflow at this point
        const nestedWorkflow = step.step as any;
        const timeTravelParams = createTimeTravelExecutionParams({
          steps: timeTravel.steps.slice(1),
          inputData: timeTravel.inputData,
          resumeData: timeTravel.resumeData,
          context: (timeTravel.nestedStepResults?.[step.step.id] ?? {}) as any,
          nestedStepsContext: (timeTravel.nestedStepResults ?? {}) as any,
          snapshot,
          graph: nestedWorkflow.buildExecutionGraph(),
          perStep,
        });

        const nestedPrevStep = getStep(nestedWorkflow, timeTravelParams.executionPath);
        const nestedPrevResult = timeTravelParams.stepResults[nestedPrevStep?.id ?? 'input'];

        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.start',
          runId,
          data: {
            workflowId: step.step.id,
            parentWorkflow: {
              stepId: step.step.id,
              workflowId,
              runId,
              executionPath,
              resumeSteps,
              stepResults,
              timeTravel,
              input: prevResult,
              parentWorkflow,
            },
            executionPath: timeTravelParams.executionPath,
            runId: randomUUID(),
            stepResults: timeTravelParams.stepResults,
            prevResult: { status: 'success', output: nestedPrevResult?.payload },
            timeTravel: timeTravelParams,
            activeSteps,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      } else {
        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.start',
          runId,
          data: {
            workflowId: step.step.id,
            parentWorkflow: {
              stepId: step.step.id,
              workflowId,
              runId,
              executionPath,
              resumeSteps,
              stepResults,
              input: prevResult,
              parentWorkflow,
            },
            executionPath: [0],
            runId: randomUUID(),
            resumeSteps,
            prevResult,
            resumeData,
            activeSteps,
            requestContext,
            perStep,
            initialState: currentState,
            state: currentState,
            outputOptions,
          },
        });
      }

      return;
    }

    if (step.type === 'step') {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-start',
          payload: {
            id: step.step.id,
            startedAt: Date.now(),
            payload: prevResult.status === 'success' ? prevResult.output : undefined,
            status: 'running',
          },
        },
      });
    }

    const ee = new EventEmitter();
    ee.on('watch', async (event: any) => {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: event,
      });
    });
    const rc = new RequestContext();
    for (const [key, value] of Object.entries(requestContext)) {
      rc.set(key, value);
    }
    const { resumeData: timeTravelResumeData, validationError: timeTravelResumeValidationError } =
      await validateStepResumeData({
        resumeData: timeTravel?.stepResults[step.step.id]?.status === 'suspended' ? timeTravel?.resumeData : undefined,
        step: step.step,
      });

    let resumeDataToUse;
    if (timeTravelResumeData && !timeTravelResumeValidationError) {
      resumeDataToUse = timeTravelResumeData;
    } else if (timeTravelResumeData && timeTravelResumeValidationError) {
      this.mastra.getLogger()?.warn('Time travel resume data validation failed', {
        stepId: step.step.id,
        error: timeTravelResumeValidationError.message,
      });
    } else if (resumeSteps?.length > 0 && resumeSteps?.[0] === step.step.id) {
      resumeDataToUse = resumeData;
    }

    // Get the abort controller for this workflow run
    const abortController = this.getOrCreateAbortController(runId);

    const stepResult = await this.stepExecutor.execute({
      workflowId,
      step: step.step,
      runId,
      stepResults,
      state: currentState,
      requestContext: rc,
      input: (prevResult as any)?.output,
      resumeData: resumeDataToUse,
      retryCount,
      foreachIdx: step.type === 'foreach' ? executionPath[1] : undefined,
      validateInputs: workflow.options.validateInputs,
      abortController,
      perStep,
    });
    requestContext = Object.fromEntries(rc.entries());

    // @ts-expect-error - bailed status not in type
    if (stepResult.status === 'bailed') {
      // @ts-expect-error - bailed status not in type
      stepResult.status = 'success';

      await this.endWorkflow({
        workflow,
        resumeData,
        parentWorkflow,
        workflowId,
        runId,
        executionPath,
        resumeSteps,
        stepResults: {
          ...stepResults,
          [step.step.id]: stepResult,
        },
        prevResult: stepResult,
        activeSteps,
        requestContext,
        perStep,
        state: currentState,
        outputOptions,
      });
      return;
    }

    if (stepResult.status === 'failed') {
      const retries = step.step.retries ?? workflow.retryConfig.attempts ?? 0;
      if (retryCount >= retries) {
        await this.mastra.pubsub.publish('workflows', {
          type: 'workflow.step.end',
          runId,
          data: {
            parentWorkflow,
            workflowId,
            runId,
            executionPath,
            resumeSteps,
            stepResults,
            prevResult: stepResult,
            activeSteps,
            requestContext,
            state: currentState,
            outputOptions,
          },
        });
      } else {
        return this.mastra.pubsub.publish('workflows', {
          type: 'workflow.step.run',
          runId,
          data: {
            parentWorkflow,
            workflowId,
            runId,
            executionPath,
            resumeSteps,
            stepResults,
            timeTravel,
            prevResult,
            activeSteps,
            requestContext,
            retryCount: retryCount + 1,
            state: currentState,
            outputOptions,
          },
        });
      }
    }

    if (step.type === 'loop') {
      //timeTravel is not passed to the processWorkflowLoop function becuase the step already ran the first time
      // with whatever information it needs from timeTravel, subsequent loop runs use the previous loop run result as it's input.
      await processWorkflowLoop(
        {
          workflow,
          workflowId,
          prevResult: stepResult,
          runId,
          executionPath,
          stepResults,
          activeSteps,
          resumeSteps,
          resumeData,
          parentWorkflow,
          requestContext,
          retryCount: retryCount + 1,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
          stepResult,
        },
      );
    } else {
      // Extract updated state from step result
      const updatedState = (stepResult as any).__state ?? currentState;

      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          timeTravel, //timeTravel is passed in as workflow.step.end ends the step, not the workflow, the timeTravel info is passed to the next step to run.
          stepResults: {
            ...stepResults,
            [step.step.id]: stepResult,
            __state: updatedState,
          },
          prevResult: stepResult,
          activeSteps,
          requestContext,
          perStep,
          state: updatedState,
          outputOptions,
          forEachIndex,
        },
      });
    }
  }

  protected async processWorkflowStepEnd({
    workflow,
    workflowId,
    runId,
    executionPath,
    resumeSteps,
    timeTravel,
    prevResult,
    parentWorkflow,
    stepResults,
    activeSteps,
    parentContext,
    requestContext,
    perStep,
    state,
    outputOptions,
    forEachIndex,
    nestedRunId,
  }: ProcessorArgs) {
    // Extract state from prevResult if it was updated by the step
    // For nested workflow completion (parentContext present), prefer the passed state
    // as it contains the nested workflow's updated state
    const currentState = parentContext
      ? (state ?? (prevResult as any)?.__state ?? stepResults?.__state ?? {})
      : ((prevResult as any)?.__state ?? stepResults?.__state ?? state ?? {});

    // Create a clean version of prevResult without __state for storing
    const { __state: _removedState, ...cleanPrevResult } = prevResult as any;
    prevResult = cleanPrevResult as typeof prevResult;

    let step = workflow.stepGraph[executionPath[0]!];

    if ((step?.type === 'parallel' || step?.type === 'conditional') && executionPath.length > 1) {
      step = step.steps[executionPath[1]!];
    }

    if (!step) {
      return this.errorWorkflow(
        {
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          prevResult,
          stepResults,
          activeSteps,
          requestContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step not found: ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    // Cache workflows store to avoid redundant async calls
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');

    if (step.type === 'foreach') {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: workflowId,
        runId,
      });

      const currentIdx = executionPath[1];
      const existingStepResult = snapshot?.context?.[step.step.id] as any;
      const currentResult = existingStepResult?.output;
      // Preserve the original payload (the input array) from the existing step result
      const originalPayload = existingStepResult?.payload;

      let newResult = prevResult;
      if (currentIdx !== undefined) {
        // Check for bail - short circuit foreach execution
        // @ts-expect-error - bailed status not in type
        if (prevResult.status === 'bailed') {
          const bailedResult = {
            status: 'success' as const,
            output: (prevResult as any).output,
            startedAt: existingStepResult?.startedAt ?? Date.now(),
            endedAt: Date.now(),
            payload: originalPayload,
          };

          // Store final result
          await workflowsStore?.updateWorkflowResults({
            workflowName: workflow.id,
            runId,
            stepId: step.step.id,
            result: bailedResult as any,
            requestContext,
          });

          // End workflow with bail result
          return this.endWorkflow({
            workflow,
            parentWorkflow,
            workflowId,
            runId,
            executionPath: [executionPath[0]!],
            resumeSteps,
            stepResults: { ...stepResults, [step.step.id]: bailedResult },
            prevResult: bailedResult,
            activeSteps,
            requestContext,
            perStep,
            state: currentState,
            outputOptions,
          });
        }

        // For foreach, store the full iteration result (including status, suspendPayload, etc.)
        // not just the output, so suspend state is preserved
        const iterationResult =
          prevResult.status === 'suspended'
            ? prevResult // Keep full result for suspended iterations
            : (prevResult as any).output; // Just output for completed iterations

        if (currentResult) {
          currentResult[currentIdx] = iterationResult;
          // Merge foreach step-level properties (suspendPayload, resumePayload, suspendedAt, resumedAt)
          // New iteration's resume properties take precedence for resumePayload/resumedAt (most recent resume)
          // Existing step's suspend properties are preserved (first suspend)
          newResult = {
            ...existingStepResult, // Preserve step-level properties
            ...prevResult, // Get iteration timing info
            output: currentResult,
            payload: originalPayload,
            // Preserve suspend metadata from first suspension
            suspendPayload: existingStepResult?.suspendPayload ?? prevResult.suspendPayload,
            suspendedAt: existingStepResult?.suspendedAt ?? (prevResult as any).suspendedAt,
            // Update resume metadata to most recent resume (new iteration takes precedence)
            resumePayload: (prevResult as any).resumePayload ?? existingStepResult?.resumePayload,
            resumedAt: (prevResult as any).resumedAt ?? existingStepResult?.resumedAt,
          } as any;
        } else {
          newResult = { ...prevResult, output: [iterationResult], payload: originalPayload } as any;
        }
      }
      const newStepResults = await workflowsStore?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId: step.step.id,
        result: newResult,
        requestContext,
      });

      if (!newStepResults) {
        return;
      }

      stepResults = newStepResults;

      // For foreach iterations, check if all iterations are complete before emitting events
      // This prevents emitting workflow.suspend when only some concurrent iterations have finished
      if (currentIdx !== undefined) {
        const foreachResult = stepResults[step.step.id] as any;
        const iterationResults = foreachResult?.output ?? [];
        const targetLen = foreachResult?.payload?.length ?? 0;

        // Count iterations by status - pending iterations appear as null in stepResults after
        // storage merge (pending markers are converted to null by the storage layer).
        const pendingCount = iterationResults.filter((r: any) => r === null).length;
        const suspendedCount = iterationResults.filter(
          (r: any) => r && typeof r === 'object' && r.status === 'suspended',
        ).length;
        const iterationsStarted = iterationResults.length;

        // Emit per-iteration progress event
        const completedCount = iterationResults.filter(
          (r: any) => r !== null && !(typeof r === 'object' && r.status === 'suspended'),
        ).length;
        const iterationStatus =
          prevResult.status === 'suspended'
            ? ('suspended' as const)
            : prevResult.status === 'success'
              ? ('success' as const)
              : ('failed' as const);

        await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-progress',
            payload: {
              id: step.step.id,
              completedCount,
              totalCount: targetLen,
              currentIndex: currentIdx,
              iterationStatus,
              ...(prevResult.status === 'success' ? { iterationOutput: (prevResult as any).output } : {}),
            },
          },
        });

        if (pendingCount > 0) {
          // There are still pending (null) iterations - concurrent execution in progress
          // Wait for them to complete
          return;
        }

        // Check if there are more iterations to start before deciding to suspend
        // This handles partial concurrency: don't suspend until all iterations have been started
        if (iterationsStarted < targetLen) {
          // More iterations need to be started - call processWorkflowForEach to continue
          await processWorkflowForEach(
            {
              workflow,
              workflowId,
              prevResult: { status: 'success', output: foreachResult.payload } as any,
              runId,
              executionPath: [executionPath[0]!],
              stepResults,
              activeSteps,
              resumeSteps,
              timeTravel,
              resumeData: undefined, // Don't pass resumeData when starting new iterations
              parentWorkflow,
              requestContext,
              perStep,
              state: currentState,
              outputOptions,
            },
            {
              pubsub: this.mastra.pubsub,
              mastra: this.mastra,
              step,
            },
          );
          return;
        }

        if (suspendedCount > 0) {
          // Some iterations are suspended - emit workflow suspend
          // Build aggregated suspend metadata from all suspended iterations
          const collectedResumeLabels: Record<string, { stepId: string; foreachIndex?: number }> = {};
          // suspendedPaths maps stepId -> executionPath, using the step ID (not stepId[index])
          const suspendedPaths: Record<string, number[]> = {
            [step.step.id]: [executionPath[0]!],
          };

          for (let i = 0; i < iterationResults.length; i++) {
            const iterResult = iterationResults[i];
            if (iterResult && typeof iterResult === 'object' && iterResult.status === 'suspended') {
              // Collect resume labels
              if (iterResult.suspendPayload?.__workflow_meta?.resumeLabels) {
                Object.assign(collectedResumeLabels, iterResult.suspendPayload.__workflow_meta.resumeLabels);
              }
            }
          }

          // Create the aggregated foreach step suspend result
          const foreachSuspendResult = {
            status: 'suspended' as const,
            output: iterationResults,
            payload: foreachResult.payload,
            suspendedAt: Date.now(),
            startedAt: foreachResult.startedAt,
            suspendPayload: {
              __workflow_meta: {
                path: executionPath,
                resumeLabels: collectedResumeLabels,
              },
            },
          };

          // Update the step result with aggregated suspend status
          await workflowsStore?.updateWorkflowResults({
            workflowName: workflow.id,
            runId,
            stepId: step.step.id,
            result: foreachSuspendResult as any,
            requestContext,
          });

          // Check shouldPersistSnapshot option - default to true if not specified
          const shouldPersist =
            workflow?.options?.shouldPersistSnapshot?.({
              stepResults: stepResults ?? {},
              workflowStatus: 'suspended',
            }) ?? true;

          if (shouldPersist) {
            // Persist state to snapshot context before suspending
            await workflowsStore?.updateWorkflowResults({
              workflowName: workflow.id,
              runId,
              stepId: '__state',
              result: currentState as any,
              requestContext,
            });

            await workflowsStore?.updateWorkflowState({
              workflowName: workflowId,
              runId,
              opts: {
                status: 'suspended',
                result: foreachSuspendResult,
                suspendedPaths,
                resumeLabels: collectedResumeLabels,
              },
            });
          }

          await this.mastra.pubsub.publish('workflows', {
            type: 'workflow.suspend',
            runId,
            data: {
              workflowId,
              runId,
              executionPath: [executionPath[0]!],
              resumeSteps,
              parentWorkflow,
              stepResults: { ...stepResults, [step.step.id]: foreachSuspendResult },
              prevResult: foreachSuspendResult,
              activeSteps,
              requestContext,
              timeTravel,
              state: currentState,
              outputOptions,
            },
          });

          return;
        }

        // All iterations succeeded - call processWorkflowForEach to advance to next step
        await processWorkflowForEach(
          {
            workflow,
            workflowId,
            prevResult: { status: 'success', output: foreachResult.payload } as any,
            runId,
            executionPath: [executionPath[0]!],
            stepResults,
            activeSteps,
            resumeSteps,
            timeTravel,
            resumeData: undefined,
            parentWorkflow,
            requestContext,
            perStep,
            state: currentState,
            outputOptions,
          },
          {
            pubsub: this.mastra.pubsub,
            mastra: this.mastra,
            step,
          },
        );
        return;
      }
    } else if (isExecutableStep(step)) {
      // clear from activeSteps
      delete activeSteps[step.step.id];

      // handle nested workflow
      if (parentContext) {
        prevResult = stepResults[step.step.id] = {
          ...prevResult,
          payload: parentContext.input?.output ?? {},
          // Store nestedRunId in metadata for getWorkflowRunById retrieval
          ...(nestedRunId && {
            metadata: {
              ...(prevResult as any).metadata,
              nestedRunId,
            },
          }),
        };
      }

      const newStepResults = await workflowsStore?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId: step.step.id,
        result: prevResult,
        requestContext,
      });

      if (!newStepResults) {
        return;
      }

      stepResults = newStepResults;
    }

    // Update stepResults with current state
    stepResults = { ...stepResults, __state: currentState };

    if (!prevResult?.status || prevResult.status === 'failed') {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.fail',
        runId,
        data: {
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          parentWorkflow,
          stepResults,
          timeTravel,
          prevResult,
          activeSteps,
          requestContext,
          state: currentState,
          outputOptions,
        },
      });

      return;
    } else if (prevResult.status === 'suspended') {
      const suspendedPaths: Record<string, number[]> = {};
      const suspendedStep = getStep(workflow, executionPath);
      if (suspendedStep) {
        suspendedPaths[suspendedStep.id] = executionPath;
      }

      // Extract resume labels from suspend payload metadata
      const resumeLabels: Record<string, { stepId: string; foreachIndex?: number }> =
        prevResult.suspendPayload?.__workflow_meta?.resumeLabels ?? {};

      // Check shouldPersistSnapshot option - default to true if not specified
      const shouldPersist =
        workflow?.options?.shouldPersistSnapshot?.({
          stepResults: stepResults ?? {},
          workflowStatus: 'suspended',
        }) ?? true;

      if (shouldPersist) {
        // Persist state to snapshot context before suspending
        // We use a special '__state' key to store state at the context level
        await workflowsStore?.updateWorkflowResults({
          workflowName: workflow.id,
          runId,
          stepId: '__state',
          result: currentState as any,
          requestContext,
        });

        await workflowsStore?.updateWorkflowState({
          workflowName: workflowId,
          runId,
          opts: {
            status: 'suspended',
            result: prevResult,
            suspendedPaths,
            resumeLabels,
          },
        });
      }

      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.suspend',
        runId,
        data: {
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          parentWorkflow,
          stepResults,
          prevResult,
          activeSteps,
          requestContext,
          timeTravel,
          state: currentState,
          outputOptions,
        },
      });

      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-suspended',
          payload: {
            id: (step as any)?.step?.id,
            ...prevResult,
            suspendedAt: Date.now(),
            suspendPayload: prevResult.suspendPayload,
          },
        },
      });

      return;
    }

    if (step?.type === 'step') {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-result',
          payload: {
            id: step.step.id,
            ...prevResult,
          },
        },
      });

      if (prevResult.status === 'success') {
        await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
          type: 'watch',
          runId,
          data: {
            type: 'workflow-step-finish',
            payload: {
              id: step.step.id,
              metadata: {},
            },
          },
        });
      }
    }

    step = workflow.stepGraph[executionPath[0]!];
    if (perStep) {
      if (parentWorkflow && executionPath[0]! < workflow.stepGraph.length - 1) {
        const { endedAt, output, status, ...nestedPrevResult } = prevResult as StepSuccess<any, any, any, any>;
        await this.endWorkflow({
          workflow,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult: { ...nestedPrevResult, status: 'paused' },
          activeSteps,
          requestContext,
          perStep,
        });
      } else {
        await this.endWorkflow({
          workflow,
          parentWorkflow,
          workflowId,
          runId,
          executionPath,
          resumeSteps,
          stepResults,
          prevResult,
          activeSteps,
          requestContext,
          perStep,
        });
      }
    } else if ((step?.type === 'parallel' || step?.type === 'conditional') && executionPath.length > 1) {
      let skippedCount = 0;
      const allResults: Record<string, any> = step.steps.reduce(
        (acc, step) => {
          if (isExecutableStep(step)) {
            const res = stepResults?.[step.step.id];
            if (res && res.status === 'success') {
              acc[step.step.id] = res?.output;
              // @ts-expect-error - skipped status not in type
            } else if (res?.status === 'skipped') {
              skippedCount++;
            }
          }

          return acc;
        },
        {} as Record<string, StepResult<any, any, any, any>>,
      );

      const keys = Object.keys(allResults);
      if (keys.length + skippedCount < step.steps.length) {
        return;
      }

      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1),
          resumeSteps,
          stepResults,
          prevResult: { status: 'success', output: allResults },
          activeSteps,
          requestContext,
          timeTravel,
          state: currentState,
          outputOptions,
        },
      });
    } else if (step?.type === 'foreach') {
      // Get the original array from the foreach step's stored payload
      const foreachStepResult = stepResults[step.step.id] as any;
      const originalArray = foreachStepResult?.payload;
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1),
          resumeSteps,
          parentWorkflow,
          stepResults,
          prevResult: { ...prevResult, output: originalArray },
          activeSteps,
          requestContext,
          timeTravel,
          state: currentState,
          outputOptions,
          forEachIndex,
        },
      });
    } else if (executionPath[0]! >= workflow.stepGraph.length - 1) {
      await this.endWorkflow({
        workflow,
        parentWorkflow,
        workflowId,
        runId,
        executionPath,
        resumeSteps,
        stepResults,
        prevResult,
        activeSteps,
        requestContext,
        state: currentState,
        outputOptions,
      });
    } else {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.run',
        runId,
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
          resumeSteps,
          parentWorkflow,
          stepResults,
          prevResult,
          activeSteps,
          requestContext,
          timeTravel,
          state: currentState,
          outputOptions,
        },
      });
    }
  }

  async loadData({
    workflowId,
    runId,
  }: {
    workflowId: string;
    runId: string;
  }): Promise<WorkflowRunState | null | undefined> {
    const workflowsStore = await this.mastra.getStorage()?.getStore('workflows');
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: workflowId,
      runId,
    });

    return snapshot;
  }

  async process(event: Event, ack?: () => Promise<void>) {
    const { type, data } = event;

    const workflowData = data as Omit<ProcessorArgs, 'workflow'>;

    const currentState = await this.loadData({
      workflowId: workflowData.workflowId,
      runId: workflowData.runId,
    });

    if (currentState?.status === 'canceled' && type !== 'workflow.end' && type !== 'workflow.cancel') {
      return;
    }

    if (type.startsWith('workflow.user-event.')) {
      await processWorkflowWaitForEvent(
        {
          ...workflowData,
          workflow: this.mastra.getWorkflow(workflowData.workflowId),
        },
        {
          pubsub: this.mastra.pubsub,
          eventName: type.split('.').slice(2).join('.'),
          currentState: currentState!,
        },
      );
      return;
    }

    let workflow;
    if (this.mastra.__hasInternalWorkflow(workflowData.workflowId)) {
      workflow = this.mastra.__getInternalWorkflow(workflowData.workflowId);
    } else if (workflowData.parentWorkflow) {
      workflow = getNestedWorkflow(this.mastra, workflowData.parentWorkflow);
    } else {
      workflow = this.mastra.getWorkflow(workflowData.workflowId);
    }

    if (!workflow) {
      return this.errorWorkflow(
        workflowData,
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Workflow not found: ${workflowData.workflowId}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    if (type === 'workflow.start' || type === 'workflow.resume') {
      const { runId } = workflowData;
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-start',
          payload: {
            runId,
          },
        },
      });
    }

    switch (type) {
      case 'workflow.cancel':
        await this.processWorkflowCancel({
          workflow,
          ...workflowData,
        });
        break;
      case 'workflow.start':
        await this.processWorkflowStart({
          workflow,
          ...workflowData,
        });
        break;
      case 'workflow.resume':
        await this.processWorkflowStart({
          workflow,
          ...workflowData,
        });
        break;
      case 'workflow.end':
        await this.processWorkflowEnd({
          workflow,
          ...workflowData,
        });
        break;
      case 'workflow.step.end':
        await this.processWorkflowStepEnd({
          workflow,
          ...workflowData,
        });
        break;
      case 'workflow.step.run':
        await this.processWorkflowStepRun({
          workflow,
          ...workflowData,
        });
        break;
      case 'workflow.suspend':
        await this.processWorkflowSuspend({
          workflow,
          ...workflowData,
        });
        break;
      case 'workflow.fail':
        await this.processWorkflowFail({
          workflow,
          ...workflowData,
        });
        break;
      default:
        break;
    }

    try {
      await ack?.();
    } catch (e) {
      this.mastra.getLogger()?.error('Error acking event', e);
    }
  }
}
