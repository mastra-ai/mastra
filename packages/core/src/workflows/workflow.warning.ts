import type { z } from 'zod';

import type { Step } from './step';
import type { WorkflowConfig } from './workflow';
import { Workflow as BaseWorkflow } from './workflow';

export * from './index';

export class Workflow<
  TSteps extends Step<string, any, any, any, any>[] = Step<string, any, any, any, any>[],
  TWorkflowId extends string = string,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends BaseWorkflow<TSteps, TWorkflowId, TInput, TOutput, TPrevSchema> {
  constructor(args: WorkflowConfig<TWorkflowId, TInput, TOutput, TSteps>) {
    super(args);

    this.logger.warn('Please import "Workflow" from "@mastra/core/workflows" instead of "@mastra/core"');
  }
}
