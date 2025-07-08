import { randomUUID } from 'crypto';
import EventEmitter from 'events';
import type { Mastra, Step, StepFlowEntry, StepResult, Workflow } from '../..';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { Event, PubSub } from '../../events';
import { EventProcessor } from '../../events/processor';
import { RuntimeContext } from '../../runtime-context';
import { StepExecutor } from './step-executor';
import { EventedWorkflow } from './workflow';

type ProcessorArgs = {
  activeSteps: number[][];
  workflow: Workflow;
  workflowId: string;
  runId: string;
  executionPath: number[];
  stepResults: Record<string, StepResult<any, any, any, any>>;
  resume: boolean;
  prevResult: StepResult<any, any, any, any>;
  resumeData: any;
  parentWorkflow?: ParentWorkflow;
  parentContext?: {
    workflowId: string;
    input: any;
  };
};

type ParentWorkflow = {
  workflowId: string;
  runId: string;
  executionPath: number[];
  resume: boolean;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  parentWorkflow?: ParentWorkflow;
};

export class WorkflowEventProcessor extends EventProcessor {
  protected mastra: Mastra;
  private stepExecutor: StepExecutor;

  constructor({ pubsub, mastra }: { pubsub: PubSub; mastra: Mastra }) {
    super({ pubsub });
    this.mastra = mastra;
    this.stepExecutor = new StepExecutor({ mastra });
  }

  __registerMastra(mastra: Mastra) {
    this.mastra = mastra;
    this.stepExecutor.__registerMastra(mastra);
  }

  private async errorWorkflow(workflowId: string, runId: string, e: Error) {
    await this.pubsub.publish('workflows', {
      type: 'workflow.fail',
      data: {
        workflowId,
        runId,
        error: e.stack ?? e.message,
      },
    });
  }

  protected async processWorkflowStart({
    parentWorkflow,
    workflowId,
    runId,
    resume,
    prevResult,
    resumeData,
  }: ProcessorArgs) {
    await this.pubsub.publish('workflows', {
      type: 'workflow.step.run',
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionPath: [0],
        resume,
        stepResults: {
          input: prevResult?.status === 'success' ? prevResult.output : undefined,
        },
        prevResult,
        resumeData,
        activeSteps: [],
      },
    });
  }

  protected async processWorkflowEnd({
    workflowId,
    resume,
    prevResult,
    resumeData,
    parentWorkflow,
    activeSteps,
  }: ProcessorArgs) {
    // handle nested workflow
    if (parentWorkflow) {
      console.log('ending nested', workflowId, parentWorkflow);
      await this.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        data: {
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
          executionPath: parentWorkflow.executionPath,
          resume,
          stepResults: parentWorkflow.stepResults,
          prevResult,
          resumeData,
          activeSteps,
          parentWorkflow: parentWorkflow.parentWorkflow,
          parentContext: parentWorkflow,
        },
      });
    }
  }

  protected async processWorkflowStepRun({
    workflow,
    workflowId,
    runId,
    executionPath,
    stepResults,
    activeSteps,
    resume,
    prevResult,
    resumeData,
    parentWorkflow,
  }: ProcessorArgs) {
    let stepGraph: StepFlowEntry[] = workflow.stepGraph;

    if (!executionPath?.length) {
      return this.errorWorkflow(
        workflowId,
        runId,
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
        workflowId,
        runId,
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
      for (let i = 0; i < step.steps.length; i++) {
        activeSteps.push(executionPath.concat([i]));
      }

      await Promise.all(
        step.steps.map(async (_step, idx) => {
          return this.pubsub.publish('workflows', {
            type: 'workflow.step.run',
            data: {
              workflowId,
              runId,
              executionPath: executionPath.concat([idx]),
              resume,
              stepResults,
              prevResult: undefined,
              resumeData,
              parentWorkflow,
              activeSteps,
            },
          });
        }),
      );
      return;
    } else if (step?.type === 'conditional') {
      console.log('conditional found');
      const idxs = await this.stepExecutor.evaluateConditions({
        step,
        runId,
        stepResults,
        emitter: new EventEmitter() as any, // TODO
        runtimeContext: new RuntimeContext(), // TODO
        input: prevResult?.status === 'success' ? prevResult.output : undefined,
        resumeData,
      });
      console.log('conditional idxs', idxs);

      const truthyIdxs: Record<number, boolean> = {};
      for (let i = 0; i < idxs.length; i++) {
        activeSteps.push(executionPath.concat([idxs[i]!]));
        truthyIdxs[idxs[i]!] = true;
      }

      await Promise.all(
        step.steps.map(async (_step, idx) => {
          if (truthyIdxs[idx]) {
            console.log('suhh: running conditional step', executionPath.concat([idx]));
            return this.pubsub.publish('workflows', {
              type: 'workflow.step.run',
              data: {
                workflowId,
                runId,
                executionPath: executionPath.concat([idx]),
                resume,
                stepResults,
                prevResult,
                resumeData,
                parentWorkflow,
                activeSteps,
              },
            });
          } else {
            console.log('suhh: skipping conditional step', executionPath.concat([idx]));
            return this.pubsub.publish('workflows', {
              type: 'workflow.step.end',
              data: {
                workflowId,
                runId,
                executionPath: executionPath.concat([idx]),
                resume,
                stepResults,
                prevResult: { status: 'skipped' },
                resumeData,
                parentWorkflow,
                activeSteps,
              },
            });
          }
        }),
      );

      return;
    }

    if (step?.type !== 'step') {
      return this.errorWorkflow(
        workflowId,
        runId,
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step is not executable: ${step?.type} -- ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    activeSteps.push(executionPath);

    // Run nested workflow
    if (step.step instanceof EventedWorkflow) {
      console.log('starting nested', step.step.id, prevResult);
      await this.pubsub.publish('workflows', {
        type: resume ? 'workflow.resume' : 'workflow.start',
        data: {
          workflowId: step.step.id,
          parentWorkflow: { workflowId, runId, executionPath, resume, stepResults, input: prevResult, parentWorkflow },
          executionPath: [0],
          runId: randomUUID(),
          resume,
          stepResults: {},
          prevResult,
          resumeData,
          activeSteps,
        },
      });

      return;
    }

    const stepResult = await this.stepExecutor.execute({
      step,
      runId,
      stepResults,
      emitter: new EventEmitter() as any, // TODO
      runtimeContext: new RuntimeContext(), // TODO
      input: prevResult?.status === 'success' ? prevResult.output : undefined,
      resumeData,
    });
    console.dir({ stepId: step.step.id, stepResult, stepResults }, { depth: null });

    await this.pubsub.publish('workflows', {
      type: 'workflow.step.end',
      data: {
        parentWorkflow,
        workflowId,
        runId,
        executionPath,
        resume,
        stepResults,
        prevResult: stepResult,
        resumeData,
        activeSteps,
      },
    });
  }

  protected async processWorkflowStepEnd({
    workflow,
    workflowId,
    runId,
    executionPath,
    resume,
    prevResult,
    resumeData,
    parentWorkflow,
    stepResults,
    activeSteps,
    parentContext,
  }: ProcessorArgs) {
    // clear from activeSteps
    const activeStepIndex = activeSteps.findIndex(step => step.every((idx, i) => idx === executionPath[i]));
    if (activeStepIndex !== -1) {
      activeSteps.splice(activeStepIndex, 1);
    }

    let step = workflow.stepGraph[executionPath[0]!];

    if ((step?.type === 'parallel' || step?.type === 'conditional') && executionPath.length > 1) {
      step = step.steps[executionPath[1]!];
    }

    if (step?.type === 'step') {
      // handle nested workflow
      if (parentContext) {
        console.log('YOYO', prevResult, parentContext?.input?.output, {
          ...prevResult,
          payload: parentContext.input?.output,
        });
        prevResult = stepResults[step.step.id] = {
          ...prevResult,
          payload: parentContext.input?.output,
        };
      } else {
        stepResults[step.step.id] = prevResult;
      }
      console.log('saving data', step.step.id, stepResults);
      await this.saveData({ workflow, runId, stepResults });
    }

    if (!prevResult?.status || prevResult.status === 'failed') {
      console.log('failed step', prevResult);
      await this.pubsub.publish('workflows', {
        type: 'workflow.fail',
        data: {
          workflowId,
          runId,
          executionPath,
          resume,
          parentWorkflow,
          stepResults,
          prevResult,
          resumeData,
          activeSteps,
        },
      });

      return;
    } else if (prevResult.status === 'suspended') {
      await this.pubsub.publish('workflows', {
        type: 'workflow.suspend',
        data: {
          workflowId,
          runId,
          executionPath,
          resume,
          parentWorkflow,
          stepResults,
          prevResult,
          resumeData,
          activeSteps,
        },
      });

      return;
    } else if (prevResult.status === 'waiting') {
      await this.pubsub.publish('workflows', {
        type: 'workflow.bail',
        data: {
          workflowId,
          runId,
          executionPath,
          resume,
          parentWorkflow,
          stepResults,
          prevResult,
          resumeData,
          activeSteps,
        },
      });

      return;
    }

    step = workflow.stepGraph[executionPath[0]!];
    if ((step?.type === 'parallel' || step?.type === 'conditional') && executionPath.length > 1) {
      let actualStep: { type: 'step'; step: Step } = step.steps[executionPath[1]!] as { type: 'step'; step: Step };

      const newStepResults = await this.mastra.getStorage()?.updateWorkflowResults({
        workflowName: workflow.id,
        runId,
        stepId: actualStep.step.id,
        result: prevResult,
      });

      if (!newStepResults) {
        return;
      }

      let skippedCount = 0;
      const allResults: Record<string, any> = step.steps.reduce(
        (acc, step) => {
          if (step.type === 'step') {
            const res = newStepResults?.[step.step.id];
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

      console.dir({ parallel: { status: 'success', output: allResults } }, { depth: null });
      await this.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        data: {
          parentWorkflow,
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1),
          resume,
          stepResults: newStepResults,
          prevResult: { status: 'success', output: allResults },
          resumeData,
          activeSteps,
        },
      });
    } else if (executionPath[0]! >= workflow.stepGraph.length - 1) {
      await this.pubsub.publish('workflows', {
        type: 'workflow.end',
        data: {
          workflowId,
          runId,
          executionPath,
          resume,
          parentWorkflow,
          stepResults,
          prevResult,
          resumeData,
          activeSteps,
        },
      });
    } else {
      await this.pubsub.publish('workflows', {
        type: 'workflow.step.run',
        data: {
          workflowId,
          runId,
          executionPath: executionPath.slice(0, -1).concat([executionPath[executionPath.length - 1]! + 1]),
          resume,
          parentWorkflow,
          stepResults,
          prevResult,
          resumeData,
          activeSteps,
        },
      });
    }
  }

  async saveData({
    workflow,
    runId,
    stepResults,
  }: {
    workflow: Workflow;
    runId: string;
    stepResults: Record<string, StepResult<any, any, any, any>>;
  }) {
    await this.mastra.getStorage()?.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId,
      snapshot: {
        activePaths: [],
        suspendedPaths: {},
        serializedStepGraph: workflow.serializedStepGraph,
        timestamp: Date.now(),
        runId,
        status: 'running',
        context: stepResults,
        value: {},
      },
    });
  }

  async loadData({
    workflowId,
    runId,
    stepResults,
  }: {
    workflowId: string;
    runId: string;
    stepResults: Record<string, StepResult<any, any, any, any>>;
  }): Promise<Record<string, StepResult<any, any, any, any>>> {
    const snapshot = await this.mastra.getStorage()?.loadWorkflowSnapshot({
      workflowName: workflowId,
      runId,
    });
    return { ...(snapshot?.context ?? {}), ...stepResults };
  }

  getNestedWorkflow({ workflowId, executionPath, parentWorkflow }: ParentWorkflow): Workflow | null {
    let workflow: Workflow | null = null;

    if (parentWorkflow) {
      const nestedWorkflow = this.getNestedWorkflow(parentWorkflow);
      if (!nestedWorkflow) {
        return null;
      }

      workflow = nestedWorkflow;
    }

    workflow = workflow ?? this.mastra.getWorkflow(workflowId);
    const stepGraph = workflow.stepGraph;
    let parentStep = stepGraph[executionPath[0]!];
    if (parentStep?.type === 'parallel' || parentStep?.type === 'conditional') {
      parentStep = parentStep.steps[executionPath[1]!];
    }

    if (parentStep?.type === 'step' || parentStep?.type === 'loop') {
      return parentStep.step as Workflow; // TODO: this is wrong
    }

    return null;
  }

  async process(event: Event) {
    const { type, data } = event;

    const workflowData = data as Omit<ProcessorArgs, 'workflow'>;

    // workflowData.stepResults = await this.loadData({
    //   workflowId: workflowData.workflowId,
    //   runId: workflowData.runId,
    //   stepResults: workflowData.stepResults,
    // });

    const workflow = workflowData.parentWorkflow
      ? this.getNestedWorkflow(workflowData.parentWorkflow)
      : this.mastra.getWorkflow(workflowData.workflowId);

    if (!workflow) {
      return this.errorWorkflow(
        workflowData.workflowId,
        workflowData.runId,
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Workflow not found: ${workflowData.workflowId}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    switch (type) {
      case 'workflow.start':
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
      case 'workflow.resume':
        await this.processWorkflowStart({
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
        break;
      case 'workflow.bail':
        break;
      case 'workflow.fail':
        break;
      default:
        break;
    }
  }
}
