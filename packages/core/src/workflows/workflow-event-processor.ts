import type { Mastra, StepFlowEntry, Workflow } from '..';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { Event, PubSub } from '../events';
import { EventProcessor } from '../events/processor';
import { StepExecutor } from './step-executor';

export class WorkflowEventProcessor extends EventProcessor {
  protected mastra: Mastra;
  private stepExecutor: StepExecutor;

  constructor({ pubsub, mastra }: { pubsub: PubSub; mastra: Mastra }) {
    super({ pubsub });
    this.mastra = mastra;
    this.stepExecutor = new StepExecutor({ mastra });
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

  async process(event: Event) {
    const { type, data } = event;

    const { workflowId, runId, executionPath, resume, parentWorkflow } = data;

    const workflow = this.mastra.getWorkflow(workflowId);

    let stepGraph: StepFlowEntry[] = workflow.stepGraph;
    let step: StepFlowEntry | undefined;
    for (let i = 0; i < executionPath.length; i++) {
      const stepIdx = executionPath[i];
      if (stepIdx === undefined || !stepGraph) {
        return this.errorWorkflow(
          data.runId,
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
          data.runId,
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
      } else if (step.type === 'step') {
        const asWorkflow = step.step as Workflow;
        await this.pubsub.publish('workflows', {
          type: resume ? 'workflow.resume' : 'workflow.start',
          data: {
            parentWorkflow: { workflowId, runId, executionPath, resume },
            workflowId: asWorkflow.id,
            runId,
          },
        });
        return;
      }
    }

    if (!step) {
      return this.errorWorkflow(
        data.runId,
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
        data.runId,
        new MastraError({
          id: 'MASTRA_WORKFLOW',
          text: `Step is not executable: ${step.type} -- ${JSON.stringify(executionPath)}`,
          domain: ErrorDomain.MASTRA_WORKFLOW,
          category: ErrorCategory.SYSTEM,
        }),
      );
    }

    switch (type) {
      case 'workflow.start':
        await this.pubsub.publish('workflows', {
          type: 'workflow.step.run',
          data: {
            workflowId,
            runId,
            executionPath: [0],
            resume: false,
          },
        });
        break;
      case 'workflow.end':
        if (parentWorkflow) {
          await this.pubsub.publish('workflows', {
            type: 'workflow.nested-end',
            data: {
              runId: parentWorkflow.runId,
              workflowId: parentWorkflow.workflowId,
              executionPath: parentWorkflow.executionPath,
              resume,
            },
          });
        }
        break;
      case 'workflow.suspend':
        break;
      case 'workflow.bail':
        break;
      case 'workflow.fail':
        break;
      case 'workflow.resume':
        break;
      case 'workflow.nested-end':
        break;
      case 'workflow.step.run':
        break;
      default:
        break;
    }
  }
}
