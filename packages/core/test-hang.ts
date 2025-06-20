// Test for infinite loop - this should hang TypeScript if the bug exists
import { z } from 'zod';

// Define the problematic types that cause circular dependency
type ToolExecutionContext<TSchemaIn extends z.ZodType<any>> = {
  context: TSchemaIn extends z.ZodSchema ? z.infer<TSchemaIn> : any;
  mastra?: any;
  runtimeContext: any;
};

type Tool<TSchemaIn extends z.ZodType<any>, TSchemaOut extends z.ZodType<any>, TContext> = {
  inputSchema: TSchemaIn;
  outputSchema: TSchemaOut;
  execute: (context: TContext) => Promise<any>;
};

// This is the exact overload that causes the infinite loop
declare function createStep<
  TSchemaIn extends z.ZodType<any>,
  TSchemaOut extends z.ZodType<any>,
  TContext extends ToolExecutionContext<TSchemaIn>, // This creates circular dependency
>(
  tool: Tool<TSchemaIn, TSchemaOut, TContext> & {
    inputSchema: TSchemaIn;
    outputSchema: TSchemaOut;
    execute: (context: TContext) => Promise<any>;
  },
): any;

// Mock tool that matches createVectorQueryTool pattern
declare const vectorTool: Tool<
  z.ZodObject<{
    queryText: z.ZodString;
    topK: z.ZodOptional<z.ZodNumber>;
    filter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
  }>,
  z.ZodObject<{
    relevantContext: z.ZodArray<z.ZodAny>;
    sources: z.ZodArray<z.ZodAny>;  
  }>,
  ToolExecutionContext<z.ZodObject<{
    queryText: z.ZodString;
    topK: z.ZodOptional<z.ZodNumber>;
    filter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
  }>>
> & {
  inputSchema: z.ZodObject<{
    queryText: z.ZodString;
    topK: z.ZodOptional<z.ZodNumber>;
    filter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
  }>;
  outputSchema: z.ZodObject<{
    relevantContext: z.ZodArray<z.ZodAny>;
    sources: z.ZodArray<z.ZodAny>;
  }>;
  execute: (context: ToolExecutionContext<z.ZodObject<{
    queryText: z.ZodString;
    topK: z.ZodOptional<z.ZodNumber>;
    filter: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
  }>>) => Promise<any>;
};

// This line should cause TypeScript to hang in infinite loop
const step = createStep(vectorTool);