# Tool Execution Interface Comparison

This document compares the tool execution interfaces between the `main` branch and the `feat/tool-input-validation` branch.

## 1. Tool Class Execute Method

### On Main Branch
```typescript
// packages/core/src/tools/tool.ts
export class Tool<...> {
  execute?: ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'];
  
  // No execute method implementation - just a property
}
```

### On This Branch
```typescript
// packages/core/src/tools/tool.ts
export class Tool<...> {
  private _execute?: ToolAction<TSchemaIn, TSchemaOut, TContext>['execute'];
  
  async execute(
    context: TContext,
    options?: ToolExecutionOptions,
  ): Promise<TSchemaOut extends z.ZodSchema ? z.infer<TSchemaOut> : unknown> {
    if (!this._execute) {
      throw new Error(`Tool ${this.id} does not have an execute function`);
    }

    // Validate input if schema exists
    const { data, error } = validateToolInput(this.inputSchema, context, this.id);
    if (error) {
      return error as any;
    }

    return this._execute(data as TContext, options);
  }
}
```

**Key Difference**: On main, `execute` is just a public property. On this branch, we've made it a method that wraps the original execute function with validation.

## 2. MCP Server Tool Validation

### On Main Branch
```typescript
// packages/mcp/src/server/server.ts
if (tool.parameters instanceof z.ZodType && typeof tool.parameters.safeParse === 'function') {
  const validation = tool.parameters.safeParse(args ?? {});
  if (!validation.success) {
    const errorMessages = validation.error.errors
      .map((e: z.ZodIssue) => `${e.path.join('.')}: ${e.message}`)
      .join(', ');
    this.logger.warn(`ExecuteTool: Invalid tool arguments for '${toolId}': ${errorMessages}`, {
      errors: validation.error.format(),
    });
    throw new z.ZodError(validation.error.issues);  // THROWS ERROR
  }
  validatedArgs = validation.data;
}
```

### On This Branch
```typescript
// packages/mcp/src/server/server.ts
if (tool.parameters instanceof z.ZodType && typeof tool.parameters.safeParse === 'function') {
  const validation = tool.parameters.safeParse(args ?? {});
  if (!validation.success) {
    const errorMessages = validation.error.errors
      .map((e: z.ZodIssue) => `- ${e.path?.join('.') || 'root'}: ${e.message}`)
      .join('\n');
    this.logger.warn(`ExecuteTool: Invalid tool arguments for '${toolId}'`, {
      errors: validation.error.format(),
      args,
    });
    
    // Return graceful error instead of throwing
    return {
      content: [
        {
          type: 'text',
          text: `Tool validation failed for ${toolId}. Please fix the following errors and try again:\n${errorMessages}\n\nProvided arguments: ${JSON.stringify(args, null, 2)}`,
        },
      ],
      isError: true,  // MCP spec: indicates error should be shown to LLM
    };
  }
  validatedArgs = validation.data;
}
```

**Key Difference**: On main, validation errors throw exceptions. On this branch, they return structured error responses with `isError: true`.

## 3. CoreToolBuilder Validation

### On Main Branch
```typescript
// packages/core/src/tools/tool-builder/builder.ts
// No validation in createExecute - just passes args through
const execFunction = async (args: any, execOptions: ToolExecutionOptions) => {
  if (isVercelTool(tool)) {
    return tool?.execute?.(args, execOptions) ?? undefined;
  }

  return (
    tool?.execute?.({
      context: args,
      threadId: options.threadId,
      // ... other properties
    }, execOptions) ?? undefined
  );
};
```

### On This Branch
```typescript
// packages/core/src/tools/tool-builder/builder.ts
return async (args: unknown, execOptions?: ToolExecutionOptions) => {
  let logger = options.logger || this.logger;
  try {
    logger.debug(start, { ...rest, args });

    // Validate input parameters if schema exists
    const parameters = this.getParameters();
    const { data, error } = validateToolInput(parameters, args, options.name);
    if (error) {
      logger.warn(`Tool input validation failed for '${options.name}'`, {
        toolName: options.name,
        errors: error.validationErrors,
        args,
      });
      return error as any;  // Return error instead of throwing
    }
    // Use validated/transformed data
    args = data;

    // ... rest of execution
  } catch (err) {
    // ... error handling
  }
};
```

**Key Difference**: On main, no validation. On this branch, we validate and return errors instead of throwing.

## 4. Tool Execution Context

### Tool Context Structure
```typescript
// When called from agents/normal usage:
{
  context: data,
  threadId: string,
  resourceId: string,
  mastra: Mastra,
  memory: Memory,
  runId: string,
  runtimeContext: RuntimeContext,
  writer: ToolStream
}

// When called from workflows (StepExecutionContext):
{
  context: {
    steps: { [stepId]: { status, output } },
    triggerData: {},
    attempts: { [stepId]: number },
    inputData: { ...resolvedVariables },  // THIS IS THE ACTUAL DATA
    getStepResult: (stepId) => any
  },
  runId: string,
  emit: (event, data) => void,
  suspend: (payload) => Promise<void>,
  mastra?: Mastra,
  runtimeContext: RuntimeContext
}
```

## 5. Validation Function

### validateToolInput Implementation
```typescript
export function validateToolInput<T = any>(
  schema: z.ZodSchema<T> | undefined,
  input: unknown,
  toolId?: string,
): { data: T | unknown; error?: ValidationError<T> } {
  if (!schema || !('safeParse' in schema)) {
    return { data: input };
  }

  // Extract the actual input data from various context formats
  let actualInput = input;
  
  // Handle ToolExecutionContext format { context: data, ... }
  if (input && typeof input === 'object' && 'context' in input) {
    actualInput = (input as any).context;
  }
  
  // Handle StepExecutionContext format { context: { inputData: data, ... }, ... }
  if (actualInput && typeof actualInput === 'object' && 'inputData' in actualInput) {
    actualInput = (actualInput as any).inputData;
  }

  const validation = schema.safeParse(actualInput);
  if (!validation.success) {
    // ... create error
    return { data: input, error };
  }

  // Return the original input structure with validated data in the right place
  if (input && typeof input === 'object' && 'context' in input) {
    if ((input as any).context && typeof (input as any).context === 'object' && 'inputData' in (input as any).context) {
      return { data: { ...input, context: { ...(input as any).context, inputData: validation.data } } };
    }
    return { data: { ...input, context: validation.data } };
  }

  return { data: validation.data };
}
```

## Issues and Recommendations

### 1. Tool Class Execute Method - RESOLVED
**Initial Issue**: On main, tools don't have an execute method - `execute` is just a public property that tools/workflows access directly:
```typescript
// On main - workflow.ts
const { payload = {}, execute = async () => {} } = targetStep.step;
```

**Solution Implemented**: We wrap the execute function in the Tool constructor:
```typescript
constructor(opts: ToolAction<TSchemaIn, TSchemaOut, TContext>) {
  // ... other properties
  
  // Wrap the execute function with validation if it exists
  if (opts.execute) {
    const originalExecute = opts.execute;
    this.execute = async (context: TContext, options?: ToolExecutionOptions) => {
      // Validate input if schema exists
      const { data, error } = validateToolInput(this.inputSchema, context, this.id);
      if (error) {
        return error as any;
      }

      return originalExecute(data as TContext, options);
    };
  }
}
```

**Why This Works**:
1. `tool.execute` remains a property (not a method), preserving API compatibility
2. Workflows can still destructure `execute` and call it directly
3. Our wrapper adds validation transparently
4. Tests that mock execute need to mock the original function passed to createTool, not the wrapped version

### 2. Workflow Integration
**Current Behavior**: Our validation handles the workflow context structure correctly, extracting data from `context.inputData`.

**Verification Needed**: Need to ensure tools work correctly in both:
- Direct usage (agents, etc): `tool.execute({ context: data, ... })`
- Workflow usage: `tool.execute({ context: { inputData: data, ... }, ... })`

### 3. Error Handling Consistency
**Good**: We're consistently returning errors instead of throwing across all implementations.

**Consider**: Should we use a consistent error format across MCP and regular tools?