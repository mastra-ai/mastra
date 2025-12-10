import type { PrepareStepFunction } from '../../loop/types';
import type { ProcessInputStepArgs, ProcessInputStepResult, Processor } from '../index';

export class PrepareStepProcessor implements Processor<'prepare-step'> {
  readonly id = 'prepare-step';
  readonly name = 'Prepare Step Processor';

  private prepareStep: PrepareStepFunction;

  constructor(options: { prepareStep: PrepareStepFunction }) {
    this.prepareStep = options.prepareStep;
  }

  async processInputStep(args: ProcessInputStepArgs): Promise<ProcessInputStepResult | undefined | void> {
    return this.prepareStep(args);
  }
}
