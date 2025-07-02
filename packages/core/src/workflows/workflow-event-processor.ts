import type { Mastra } from '..';
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

  async process(event: Event) {
    const { type, data } = event;

    switch (type) {
      case 'workflow.start':
        break;
      case 'workflow.end':
        break;
      case 'workflow.suspend':
        break;
      case 'workflow.bail':
        break;
      case 'workflow.fail':
        break;
      case 'workflow.resume':
        break;
      case 'workflow.step.run':
        break;
      default:
        break;
    }
  }
}
