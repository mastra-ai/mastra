import type { Mastra, Workflow } from '..';
import { MastraBase } from '../base';
import type { RuntimeContext } from '../di';
import type { PubSub } from '../events';
import { RegisteredLogger } from '../logger';

export class StepExecutor extends MastraBase {
  protected mastra?: Mastra;
  constructor({ mastra }: { mastra?: Mastra }) {
    super({ name: 'StepExecutor', component: RegisteredLogger.WORKFLOW });
    this.mastra = mastra;
  }

  async execute(params: {
    workflow: Workflow;
    runId: string;
    input?: any;
    resume?: boolean;
    emitter: { runtime: PubSub; events: PubSub };
    runtimeContext: RuntimeContext;
  }): Promise<void> {
    const { workflow } = params;
    const { id, stepGraph, serializedStepGraph } = workflow;
    console.dir({ id, stepGraph, serializedStepGraph }, { depth: null });
  }
}
