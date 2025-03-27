import type { z } from 'zod';

import type { Step } from './step';
import type { WorkflowOptions } from './types';
import { Workflow as BaseWorkflow } from './workflow';

export * from './index';

export class Workflow<
  TSteps extends Step<any, any, any>[] = any,
  TTriggerSchema extends z.ZodObject<any> = any,
> extends BaseWorkflow<TSteps, string, TTriggerSchema> {
  constructor(args: WorkflowOptions<string, TSteps, TTriggerSchema>) {
    super(args);

    this.logger.warn('Please import "Workflow" from "@mastra/core/workflows" instead of "@mastra/core"');
  }
}
