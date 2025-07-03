import EventEmitter from 'events';
import type { Mastra, StepFlowEntry, StepResult, Workflow } from '..';
import { ErrorCategory, ErrorDomain, MastraError } from '../error';
import type { Event, PubSub } from '../events';
import { EventProcessor } from '../events/processor';
import { RuntimeContext } from '../runtime-context';
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

    const { workflowId, runId, executionPath, stepResults, resume, prevResult, resumeData, parentWorkflow } = data as {
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
      };
    };

    const workflow = this.mastra.getWorkflow(workflowId);

    switch (type) {
      case 'workflow.start':
        await this.pubsub.publish('workflows', {
          type: 'workflow.step.run',
          data: {
            workflowId,
            runId,
            executionPath: [0],
            resume,
            stepResults: {},
            prevResult,
            resumeData,
          },
        });
        break;
      case 'workflow.end':
        if (parentWorkflow) {
          // TODO: add workflow result here
          await this.pubsub.publish('workflows', {
            type: 'workflow.step.end',
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
      case 'workflow.step.end':
        if (prevResult.status === 'failed') {
          await this.pubsub.publish('workflows', {
            type: 'workflow.fail',
            data: {
              runId,
              executionPath,
              resume,
              parentWorkflow,
              stepResults,
              prevResult,
              resumeData,
            },
          });

          break;
        } else if (prevResult.status === 'suspended') {
          await this.pubsub.publish('workflows', {
            type: 'workflow.suspend',
            data: {
              runId,
              executionPath,
              resume,
              parentWorkflow,
              stepResults,
              prevResult,
              resumeData,
            },
          });

          break;
        } else if (prevResult.status === 'waiting') {
          await this.pubsub.publish('workflows', {
            type: 'workflow.bail',
            data: {
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

        // TODO: check if there is more steps
        await this.pubsub.publish('workflows', {
          type: 'workflow.end',
          data: {
            runId,
            executionPath,
            resume,
            parentWorkflow,
            stepResults,
            prevResult,
            resumeData,
          },
        });

        break;
      case 'workflow.step.run':
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
                executionPath: executionPath.slice(i + 1),
                workflowId: asWorkflow.id,
                runId: '', // TODO: generate runId
                resume,
                stepResults: {},
                prevResult: prevResult.status === 'success' ? prevResult.output : undefined,
                resumeData,
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

        const stepResult = await this.stepExecutor.execute({
          step,
          runId,
          stepResults,
          emitter: new EventEmitter() as any, // TODO
          runtimeContext: new RuntimeContext(), // TODO
          input: prevResult.status === 'success' ? prevResult.output : undefined,
          resumeData,
        });

        stepResults[step.step.id] = stepResult;

        await this.pubsub.publish('workflows', {
          type: 'workflow.step.end',
          data: {
            runId,
            executionPath,
            resume,
            parentWorkflow,
            stepResults,
            prevResult: stepResult,
            resumeData,
          },
        });

        break;
      default:
        break;
    }
  }
}
