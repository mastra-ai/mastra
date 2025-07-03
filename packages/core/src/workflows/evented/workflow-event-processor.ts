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
          input: prevResult?.status === 'success' ? prevResult.output : undefined,
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
          workflowId: parentWorkflow.workflowId,
          runId: parentWorkflow.runId,
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

    const step: StepFlowEntry | undefined = stepGraph[executionPath[0]!];

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

    // TODO: add support for .parallel()
    if (step.type !== 'step') {
      return this.errorWorkflow(
        workflowId,
        runId,
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step is not executable: ${step.type} -- ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    if (executionPath.length > 1) {
      const asWorkflow = step.step as Workflow;
      await this.pubsub.publish('workflows', {
        type: resume ? 'workflow.resume' : 'workflow.start',
        data: {
          workflowId: asWorkflow.id,
          parentWorkflow: { workflowId, runId, executionPath, resume },
          executionPath: executionPath.slice(1),
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

    const stepGraph = workflow.stepGraph;
    if (executionPath[0]! >= stepGraph.length - 1) {
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
        },
      });
    }
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
