import type { z } from 'zod';

import type { Step } from './step';
import { Workflow as BaseWorkflow } from './workflow';

export * from './index';

export class Workflow<
  TSteps extends Step<any, any, any>[] = any,
  TTriggerSchema extends z.ZodType<any> = any,
> extends BaseWorkflow<TSteps, TTriggerSchema> {}
