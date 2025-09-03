import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import { ErrorCategory, ErrorDomain, MastraError } from '../../../error';
import { EventProcessor } from '../../../events/processor';
import type { Event } from '../../../events/types';
import type { Mastra } from '../../../mastra';
import { RuntimeContext } from '../../../runtime-context/';
import type { StepFlowEntry, StepResult, WorkflowRunState } from '../../../workflows/types';
import type { Workflow } from '../../../workflows/workflow';
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
  runtimeContext: Record<string, any>;
  resumeData?: any;
  parentWorkflow?: ParentWorkflow;
  parentContext?: {
    workflowId: string;
    input: any;
  };
  runCount?: number;
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

  constructor({ mastra }: { mastra: Mastra }) {
    super({ mastra });
    this.stepExecutor = new StepExecutor({ mastra });
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
      runtimeContext,
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
        prevResult: { status: 'failed', error: e.stack ?? e.message },
        runtimeContext,
        resumeData,
        activeSteps: {},
        parentWorkflow: parentWorkflow,
      },
    });
  }

  protected async processWorkflowCancel({ workflowId, runId }: ProcessorArgs) {
    const currentState = await this.mastra.getStorage()?.updateWorkflowState({
      workflowName: workflowId,
      runId,
      opts: {
        status: 'canceled',
      },
    });

    await this.endWorkflow({
      workflow: undefined as any,
      workflowId,
      runId,
      stepResults: currentState?.context as any,
      prevResult: { status: 'canceled' } as any,
      runtimeContext: currentState?.runtimeContext as any,
      executionPath: [],
      activeSteps: {},
      resumeSteps: [],
      resumeData: undefined,
      parentWorkflow: undefined,
    });
  }

  protected async processWorkflowStart({
    workflow,
    parentWorkflow,
    workflowId,
    runId,
    resumeSteps,
    prevResult,
    resumeData,
    executionPath,
    stepResults,
    runtimeContext,
  }: ProcessorArgs) {
    await this.mastra.getStorage()?.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId,
      snapshot: {
        activePaths: [],
        suspendedPaths: {},
        waitingPaths: {},
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
        runId,
        status: 'running',
        context: stepResults ?? {
          input: prevResult?.status === 'success' ? prevResult.output : undefined,
        },
        value: {},
      },
    });

    await this.mastra.pubsub.publish('workflows', {
      type: 'workflow.step.run',
      runId,
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionPath: executionPath ?? [0],
        resumeSteps,
        stepResults: stepResults ?? {
          input: prevResult?.status === 'success' ? prevResult.output : undefined,
        },
        prevResult,
        runtimeContext,
        resumeData,
        activeSteps: {},
      },
    });
  }

  protected async endWorkflow(args: ProcessorArgs) {
    const { stepResults, workflowId, runId, prevResult } = args;
    await this.mastra.getStorage()?.updateWorkflowState({
      workflowName: workflowId,
      runId,
      opts: {
        status: 'success',
        result: prevResult,
      },
    });

    await this.mastra.pubsub.publish(`workflow.events.${runId}`, {
      type: 'watch',
      runId,
      data: {
        type: 'watch',
        payload: {
          currentStep: undefined,
          workflowState: {
            status: prevResult.status,
            steps: stepResults,
            result: prevResult.status === 'success' ? prevResult.output : null,
            error: (prevResult as any).error ?? null,
          },
        },
        eventTimestamp: Date.now(),
      },
    });

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
    const { resumeSteps, prevResult, resumeData, parentWorkflow, activeSteps, runtimeContext, runId } = args;

    // handle nested workflow
    if (parentWorkflow) {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
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
          runtimeContext,
        },
      });
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.end',
      runId,
      data: { ...args, workflow: undefined },
    });
  }

  protected async processWorkflowSuspend(args: ProcessorArgs) {
    const { resumeSteps, prevResult, resumeData, parentWorkflow, activeSteps, runId, runtimeContext } = args;

    // TODO: if there are still active paths don't end the workflow yet
    // handle nested workflow
    if (parentWorkflow) {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
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
          resumeData,
          activeSteps,
          runtimeContext,
          parentWorkflow: parentWorkflow.parentWorkflow,
          parentContext: parentWorkflow,
        },
      });
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.suspend',
      runId,
      data: { ...args, workflow: undefined },
    });
  }

  protected async processWorkflowFail(args: ProcessorArgs) {
    const { workflowId, runId, resumeSteps, prevResult, resumeData, parentWorkflow, activeSteps, runtimeContext } =
      args;

    await this.mastra.getStorage()?.updateWorkflowState({
      workflowName: workflowId,
      runId,
      opts: {
        status: 'failed',
        error: (prevResult as any).error,
      },
    });

    // handle nested workflow
    if (parentWorkflow) {
      await this.mastra.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        runId,
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          executionPath: parentWorkflow.executionPath,
          resumeSteps,
          stepResults: parentWorkflow.stepResults,
          prevResult,
          resumeData,
          activeSteps,
          runtimeContext,
          parentWorkflow: parentWorkflow.parentWorkflow,
          parentContext: parentWorkflow,
        },
      });
    }

    await this.mastra.pubsub.publish('workflows-finish', {
      type: 'workflow.fail',
      runId,
      data: { ...args, workflow: undefined },
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
    prevResult,
    resumeData,
    parentWorkflow,
    runtimeContext,
    runCount = 0,
  }: ProcessorArgs) {
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
          runtimeContext,
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
          runtimeContext,
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
          prevResult,
          resumeData,
          parentWorkflow,
          runtimeContext,
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
          prevResult,
          resumeData,
          parentWorkflow,
          runtimeContext,
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
          prevResult,
          resumeData,
          parentWorkflow,
          runtimeContext,
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
          prevResult,
          resumeData,
          parentWorkflow,
          runtimeContext,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
        },
      );
    } else if (step?.type === 'waitForEvent' && !resumeData) {
      // wait for event to arrive externally (with resumeData)
      await this.mastra.getStorage()?.updateWorkflowResults({
        workflowName: workflowId,
        runId,
        stepId: step.step.id,
        result: {
          startedAt: Date.now(),
          status: 'waiting',
          payload: prevResult.status === 'success' ? prevResult.output : undefined,
        },
        runtimeContext,
      });
      await this.mastra.getStorage()?.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: 'waiting',
          waitingPaths: {
            [step.event]: executionPath,
          },
        },
      });

      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'workflow-step-waiting',
          payload: {
            id: step.step.id,
            status: 'waiting',
            payload: prevResult.status === 'success' ? prevResult.output : undefined,
            startedAt: Date.now(),
          },
        },
      });

      return;
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
          prevResult,
          resumeData,
          parentWorkflow,
          runtimeContext,
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
          runtimeContext,
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

    // Run nested workflow
    if (step.step instanceof EventedWorkflow) {
      if (resumeSteps?.length > 1) {
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
              runtimeContext,
            },
            new MastraError({
              id: 'MASTRA_WORKFLOW',
              text: `Nested workflow run id not found: ${JSON.stringify(stepResults)}`,
              domain: ErrorDomain.MASTRA_WORKFLOW,
              category: ErrorCategory.SYSTEM,
            }),
          );
        }

        const snapshot = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
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
            runtimeContext,
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
            runtimeContext,
          },
        });
      }

      return;
    }

    if (step.type === 'step' || step.type === 'waitForEvent') {
      await this.mastra.pubsub.publish(`workflow.events.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'watch',
          payload: {
            currentStep: { id: step.step.id, status: 'running' },
            workflowState: {
              status: 'running',
              steps: stepResults,
              error: null,
              result: null,
            },
          },
          eventTimestamp: Date.now(),
        },
      });

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
    ee.on('watch-v2', async (event: any) => {
      await this.mastra.pubsub.publish(`workflow.events.v2.${runId}`, {
        type: 'watch',
        runId,
        data: event,
      });
    });
    const rc = new RuntimeContext();
    for (const [key, value] of Object.entries(runtimeContext)) {
      rc.set(key, value);
    }
    const stepResult = await this.stepExecutor.execute({
      workflowId,
      step: step.step,
      runId,
      stepResults,
      emitter: ee,
      runtimeContext: rc,
      input: (prevResult as any)?.output,
      resumeData:
        step.type === 'waitForEvent' || (resumeSteps?.length === 1 && resumeSteps?.[0] === step.step.id)
          ? resumeData
          : undefined,
      runCount,
      foreachIdx: step.type === 'foreach' ? executionPath[1] : undefined,
    });
    runtimeContext = Object.fromEntries(rc.entries());

    // @ts-ignore
    if (stepResult.status === 'bailed') {
      // @ts-ignore
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
        runtimeContext,
      });
      return;
    }

    if (stepResult.status === 'failed') {
      if (runCount >= (workflow.retryConfig.attempts ?? 0)) {
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
            runtimeContext,
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
            prevResult,
            activeSteps,
            runtimeContext,
            runCount: runCount + 1,
          },
        });
      }
    }

    if (step.type === 'loop') {
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
          runtimeContext,
          runCount: runCount + 1,
        },
        {
          pubsub: this.mastra.pubsub,
          stepExecutor: this.stepExecutor,
          step,
          stepResult,
        },
      );
    } else {
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
          runtimeContext,
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
    prevResult,
    parentWorkflow,
    stepResults,
    activeSteps,
    parentContext,
    runtimeContext,
  }: ProcessorArgs) {
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
          runtimeContext,
        },
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step not found: ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    if (step.type === 'foreach') {
      const snapshot = await this.mastra.getStorage()?.loadWorkflowSnapshot({
        workflowName: workflowId,
        runId,
      });

      const currentIdx = executionPath[1];
      const currentResult = (snapshot?.context?.[step.step.id] as any)?.output;

      let newResult = prevResult;
      if (currentIdx !== undefined) {
        if (currentResult) {
          currentResult[currentIdx] = (prevResult as any).output;
          newResult = { ...prevResult, output: currentResult } as any;
        } else {
          newResult = { ...prevResult, output: [(prevResult as any).output] } as any;
        }
      }
      const newStepResults = await this.mastra.getStorage()?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId: step.step.id,
        result: newResult,
        runtimeContext,
      });

      if (!newStepResults) {
        return;
      }

      stepResults = newStepResults;
    } else if (isExecutableStep(step)) {
      // clear from activeSteps
      delete activeSteps[step.step.id];

      // handle nested workflow
      if (parentContext) {
        prevResult = stepResults[step.step.id] = {
          ...prevResult,
          payload: parentContext.input?.output ?? {},
        };
      }

      const newStepResults = await this.mastra.getStorage()?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId: step.step.id,
        result: prevResult,
        runtimeContext,
      });

      if (!newStepResults) {
        return;
      }

      stepResults = newStepResults;
    }

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
          prevResult,
          activeSteps,
          runtimeContext,
        },
      });

      return;
    } else if (prevResult.status === 'suspended') {
      const suspendedPaths: Record<string, number[]> = {};
      const suspendedStep = getStep(workflow, executionPath);
      if (suspendedStep) {
        suspendedPaths[suspendedStep.id] = executionPath;
      }

      await this.mastra.getStorage()?.updateWorkflowState({
        workflowName: workflowId,
        runId,
        opts: {
          status: 'suspended',
          result: prevResult,
          suspendedPaths,
        },
      });

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
          runtimeContext,
        },
      });

      await this.mastra.pubsub.publish(`workflow.events.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'watch',
          payload: {
            currentStep: { ...prevResult, id: (step as any)?.step?.id },
            workflowState: {
              status: 'suspended',
              steps: stepResults,
              suspendPayload: prevResult.suspendPayload,
            },
          },
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

    if (step?.type === 'step' || step?.type === 'waitForEvent') {
      await this.mastra.pubsub.publish(`workflow.events.${runId}`, {
        type: 'watch',
        runId,
        data: {
          type: 'watch',
          payload: {
            currentStep: { ...prevResult, id: step.step.id },
            workflowState: {
              status: 'running',
              steps: stepResults,
              error: null,
              result: null,
            },
          },
          eventTimestamp: Date.now(),
        },
      });

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
    if ((step?.type === 'parallel' || step?.type === 'conditional') && executionPath.length > 1) {
      let skippedCount = 0;
      const allResults: Record<string, any> = step.steps.reduce(
        (acc, step) => {
          if (isExecutableStep(step)) {
            const res = stepResults?.[step.step.id];
            if (res && res.status === 'success') {
              acc[step.step.id] = res?.output;
              // @ts-ignore
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
          runtimeContext,
        },
      });
    } else if (step?.type === 'foreach') {
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
          prevResult: { ...prevResult, output: prevResult?.payload },
          activeSteps,
          runtimeContext,
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
        runtimeContext,
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
          runtimeContext,
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
    const snapshot = await this.mastra.getStorage()?.loadWorkflowSnapshot({
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

    if (currentState?.status === 'canceled' && type !== 'workflow.end') {
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

    const workflow = workflowData.parentWorkflow
      ? getNestedWorkflow(this.mastra, workflowData.parentWorkflow)
      : this.mastra.getWorkflow(workflowData.workflowId);

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
      console.error('Error acking event', e);
    }
  }
}
