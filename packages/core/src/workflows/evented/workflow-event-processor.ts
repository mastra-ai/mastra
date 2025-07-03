import EventEmitter from 'events';
import type { Mastra, StepFlowEntry, StepResult, Workflow } from '../..';
import { ErrorCategory, ErrorDomain, MastraError } from '../../error';
import type { Event, PubSub } from '../../events';
import { EventProcessor } from '../../events/processor';
import { RuntimeContext } from '../../runtime-context';
import { StepExecutor } from './step-executor';

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
  }

  private async errorWorkflow(runId: string, e: Error) {
    await this.pubsub.publish('workflows', {
      type: 'workflow.fail',
      data: {
        runId,
        error: e.stack ?? e.message,
      },
    });
  }

  protected async processWorkflowStart({
    workflowId,
    runId,
    resume,
    prevResult,
    resumeData,
  }: {
    workflow: Workflow;
    workflowId: string;
    runId: string;
    executionPath: number[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume: boolean;
    prevResult: StepResult<any, any, any, any>;
    resumeData: any;
    parentWorkflow?: {
      workflowId: string;
      runId: string;
      executionPath: number[];
      resume: boolean;
      stepResults: Record<string, StepResult<any, any, any, any>>;
    };
  }) {
    await this.pubsub.publish('workflows', {
      type: 'workflow.step.run',
      data: {
        workflowId,
        runId,
        executionPath: [0],
        resume,
        stepResults: {
          init: prevResult,
        },
        prevResult,
        resumeData,
      },
    });
  }

  protected async processWorkflowEnd({
    resume,
    prevResult,
    resumeData,
    parentWorkflow,
  }: {
    workflow: Workflow;
    workflowId: string;
    runId: string;
    executionPath: number[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume: boolean;
    prevResult: StepResult<any, any, any, any>;
    resumeData: any;
    parentWorkflow?: {
      workflowId: string;
      runId: string;
      executionPath: number[];
      resume: boolean;
      stepResults: Record<string, StepResult<any, any, any, any>>;
    };
  }) {
    if (parentWorkflow) {
      await this.pubsub.publish('workflows', {
        type: 'workflow.step.end',
        data: {
          runId: parentWorkflow.runId,
          workflowId: parentWorkflow.workflowId,
          executionPath: parentWorkflow.executionPath,
          resume,
          stepResults: parentWorkflow.stepResults,
          prevResult,
          resumeData,
        },
      });
    }

    // TODO
  }

  protected async processWorkflowStepRun({
    workflow,
    workflowId,
    runId,
    executionPath,
    stepResults,
    resume,
    prevResult,
    resumeData,
    parentWorkflow,
  }: {
    workflow: Workflow;
    workflowId: string;
    runId: string;
    executionPath: number[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume: boolean;
    prevResult: StepResult<any, any, any, any>;
    resumeData: any;
    parentWorkflow?: {
      workflowId: string;
      runId: string;
      executionPath: number[];
      resume: boolean;
      stepResults: Record<string, StepResult<any, any, any, any>>;
    };
  }) {
    let stepGraph: StepFlowEntry[] = workflow.stepGraph;
    let step: StepFlowEntry | undefined;
    let i = 0;
    for (i = 0; i < executionPath.length; i++) {
      const stepIdx = executionPath[i];
      if (stepIdx === undefined || !stepGraph) {
        return this.errorWorkflow(
          runId,
          new MastraError({
            id: 'MASTRA_WORKFLOW',
            text: `Step not found in step graph: ${JSON.stringify(executionPath)}`,
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          }),
        );
      }

      step = stepGraph[stepIdx];

      if (!step) {
        return this.errorWorkflow(
          runId,
          new MastraError({
            id: 'MASTRA_WORKFLOW',
            text: `Step not found in step graph: ${JSON.stringify(executionPath)}`,
            domain: ErrorDomain.MASTRA_WORKFLOW,
            category: ErrorCategory.SYSTEM,
          }),
        );
      }

      if (step.type === 'parallel' || step.type === 'conditional') {
        stepGraph = step.steps;
      } else {
        break;
      }
    }

    if (!step) {
      return this.errorWorkflow(
        runId,
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step not found in step graph: ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    if (step.type !== 'step') {
      return this.errorWorkflow(
        runId,
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step is not executable: ${step.type} -- ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    if (i !== executionPath.length - 1) {
      const asWorkflow = step.step as Workflow;
      await this.pubsub.publish('workflows', {
        type: resume ? 'workflow.resume' : 'workflow.start',
        data: {
          workflowId: asWorkflow.id,
          parentWorkflow: { workflowId, runId, executionPath, resume },
          executionPath: executionPath.slice(i + 1),
          runId: '', // TODO: generate runId
          resume,
          stepResults: {},
          prevResult: prevResult?.status === 'success' ? prevResult.output : undefined,
          resumeData,
        },
      });

      return;
    }

    console.log('executing step', step.step.id, prevResult);
    const stepResult = await this.stepExecutor.execute({
      step,
      runId,
      stepResults,
      emitter: new EventEmitter() as any, // TODO
      runtimeContext: new RuntimeContext(), // TODO
      input: prevResult?.status === 'success' ? prevResult.output : undefined,
      resumeData,
    });
    console.log('step result', stepResult);

    stepResults[step.step.id] = stepResult;

    await this.pubsub.publish('workflows', {
      type: 'workflow.step.end',
      data: {
        workflowId,
        runId,
        executionPath,
        resume,
        parentWorkflow,
        stepResults,
        prevResult: stepResult,
        resumeData,
      },
    });
  }

  protected async processWorkflowStepEnd({
    workflowId,
    runId,
    executionPath,
    stepResults,
    resume,
    prevResult,
    resumeData,
    parentWorkflow,
  }: {
    workflow: Workflow;
    workflowId: string;
    runId: string;
    executionPath: number[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resume: boolean;
    prevResult: StepResult<any, any, any, any>;
    resumeData: any;
    parentWorkflow?: {
      workflowId: string;
      runId: string;
      executionPath: number[];
      resume: boolean;
      stepResults: Record<string, StepResult<any, any, any, any>>;
    };
  }) {
    if (!prevResult?.status || prevResult.status === 'failed') {
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
        },
      });

      return;
    }

    // TODO: check if there is more steps
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
      },
    });
  }

  async process(event: Event) {
    const { type, data } = event;

    const workflowData = data as {
      workflowId: string;
      runId: string;
      executionPath: number[];
      stepResults: Record<string, StepResult<any, any, any, any>>;
      resume: boolean;
      prevResult: StepResult<any, any, any, any>;
      resumeData: any;
      parentWorkflow?: {
        workflowId: string;
        runId: string;
        executionPath: number[];
        resume: boolean;
        stepResults: Record<string, StepResult<any, any, any, any>>;
      };
    };

    const workflow = this.mastra.getWorkflow(workflowData.workflowId);

    switch (type) {
      case 'workflow.start':
        await this.processWorkflowStart({
          workflow,
          ...workflowData,
        });
        break;
      case 'workflow.end':
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
