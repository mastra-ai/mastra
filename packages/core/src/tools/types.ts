import { ZodSchema, z } from 'zod';

import { IAction, IExecutionContext } from '../action';
import { Agent } from '../agent';
import { MastraEngine } from '../engine';

export type CoreTool = {
  description: string;
  parameters: ZodSchema;
  execute: (params: any) => Promise<any>;
};

export interface ToolExecutionContext<TSchemaIn extends z.ZodSchema> extends IExecutionContext<z.infer<TSchemaIn>> {
  engine?: MastraEngine;
  agents?: Record<string, Agent>;
}

export interface ToolAction<
  TId extends string,
  TSchemaIn extends z.ZodSchema,
  TSchemaOut extends z.ZodSchema,
  TContext extends ToolExecutionContext<TSchemaIn>,
> extends IAction<TId, TSchemaIn, TSchemaOut, TContext> {
  engine?: MastraEngine;
  agents?: Record<string, Agent>;
}
