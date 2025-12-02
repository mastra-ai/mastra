import type { ToolSet } from 'ai-v5';
import type { ProcessInputStepArgs, ProcessInputStepResult, Processor } from '..';

type PrepareStepFunction<TOOLS extends ToolSet = ToolSet> = (
  args: ProcessInputStepArgs<TOOLS>,
) => Promise<ProcessInputStepResult<TOOLS> | undefined> | ProcessInputStepResult<TOOLS> | undefined;

export class PrepareStepProcessor<TOOLS extends ToolSet = ToolSet> implements Processor<'prepare-step'> {
  readonly id = 'prepare-step';
  readonly name = 'Prepare Step Processor';

  private prepareStep: PrepareStepFunction<TOOLS>;

  constructor(options: { prepareStep: PrepareStepFunction<TOOLS> }) {
    this.prepareStep = options.prepareStep;
  }

  async processInputStep(args: ProcessInputStepArgs<TOOLS>) {
    const result = await this.prepareStep(args);
    if (!result) {
      return {};
    }
    return result;
  }
}
