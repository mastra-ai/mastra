import type { z } from 'zod';

import type { MastraUnion } from '../action';
import type { Mastra } from '../mastra';
import type { RuntimeContext } from '../runtime-context';
import type { ToolAction, ToolExecutionContext } from './types';

export class Tool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
  TContext = ToolExecutionContext<TSchemaIn>,
> implements ToolAction<TSchemaIn, TSchemaOut, TContext>
{
  id: string;
  description: string;
  inputSchema?: TSchemaIn;
  outputSchema?: TSchemaOut;
  execute?: ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'];
  mastra?: Mastra;

  constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
    this.id = opts.id;
    this.description = opts.description;
    this.inputSchema = opts.inputSchema;
    this.outputSchema = opts.outputSchema;
    this.execute = opts.execute;
    this.mastra = opts.mastra;
  }
}

export function createTool<
  TSchemaIn extends z.ZodSchema | undefined = undefined,
  TSchemaOut extends z.ZodSchema | undefined = undefined,
>(
  opts: {
    id: string;
    description: string;
    inputSchema?: TSchemaIn;
    outputSchema?: TSchemaOut;
    execute?: (context: {
      context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any;
      mastra?: MastraUnion;
      runtimeContext: RuntimeContext;
    }) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
    mastra?: Mastra;
  },
): [TSchemaIn, TSchemaOut] extends [z.ZodSchema, z.ZodSchema]
  ? Tool<TSchemaIn, TSchemaOut, any> & {
      inputSchema: TSchemaIn;
      outputSchema: TSchemaOut;
      execute: (context: {
        context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any;
        mastra?: MastraUnion;
        runtimeContext: RuntimeContext;
      }) => Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown>;
    }
  : Tool<TSchemaIn, TSchemaOut, any> {
  return new Tool(opts as any) as any;
}
