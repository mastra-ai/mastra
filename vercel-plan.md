# Vercel Execution Engine Implementation Plan

## Overview

This document outlines the implementation plan for `@mastra/vercel`, a package that enables Mastra workflows to run with Vercel's durable execution capabilities using the `"use workflow"` and `"use step"` directives.

## Background

### Vercel Workflow SDK

Vercel's Workflow SDK provides durable execution through compile-time directives:

```typescript
async function myWorkflow() {
  'use workflow';
  const result = await myStep(input);
  return result;
}

async function myStep(input: Data) {
  'use step';
  return await doWork(input);
}
```

Key characteristics:

- **Compile-time extraction**: Functions with directives are extracted via static analysis at build time
- **Step identity**: Each step is identified by its source location (file path + function name)
- **Isolated execution**: Steps run in isolated contexts (like serverless invocations)
- **Serialization requirement**: All arguments to `"use step"` functions must be serializable
- **Automatic memoization**: Completed steps are cached; resumed workflows skip completed steps
- **Retry support**: `RetryableError` triggers automatic retries

### Mastra's Execution Engine Architecture

Mastra uses an extensible execution engine pattern:

- `ExecutionEngine` - Abstract base class defining the interface
- `DefaultExecutionEngine` - Synchronous, in-process execution with override hooks
- `InngestExecutionEngine` - Extends DefaultExecutionEngine for Inngest's durable execution

Key hooks in `DefaultExecutionEngine` that can be overridden:

- `wrapDurableOperation(operationId, fn)` - Wrap operations for durability
- `executeStepWithRetry(stepId, runStep, params)` - Handle step execution with retries
- `executeSleepDuration(duration, sleepId, workflowId)` - Sleep for a duration
- `executeSleepUntilDate(date, sleepUntilId, workflowId)` - Sleep until a date
- `getEngineContext()` - Provide engine-specific context to steps
- `isNestedWorkflowStep(step)` - Detect nested workflows
- `executeWorkflowStep(params)` - Execute nested workflows
- `requiresDurableContextSerialization()` - Whether context needs serialization

### The Challenge

Mastra's API is **runtime-based** (functions passed as config), while Vercel's is **compile-time-based** (directives must be statically analyzable).

**Key constraint**: `"use step"` must be in a module-level, statically-defined function. You cannot:

- Pass functions as arguments to a `"use step"` function (not serializable)
- Put `"use step"` inside dynamically created closures (not statically analyzable)

### The Solution

Use a **singleton registration pattern** combined with **ID-based step lookup**:

1. User registers their Mastra instance at module load time
2. Module-level `runStep` function has `"use step"` directive
3. `runStep` receives only serializable args (workflowId, stepId, input, context)
4. Inside `runStep`, look up the step via `mastra.getWorkflowById(workflowId).steps[stepId]`
5. Execute the step with reconstructed execution context

---

## Package Structure

```
workflows/vercel/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts                    # Public exports
│   ├── singleton.ts                # Mastra singleton registration
│   ├── execution-engine.ts         # VercelExecutionEngine
│   ├── workflow.ts                 # VercelWorkflow
│   ├── run.ts                      # VercelRun
│   ├── runtime.workflow.ts         # "use workflow" / "use step" functions
│   ├── context.ts                  # Context serialization/deserialization
│   └── types.ts                    # Vercel-specific types
```

---

## Core Components

### 1. Singleton Registration (`singleton.ts`)

Provides a way for users to register their Mastra instance at module load time.

```typescript
import type { Mastra } from '@mastra/core';

let _mastra: Mastra | null = null;

/**
 * Register the Mastra instance for use in Vercel workflows.
 * This MUST be called at module load time (top-level of a module).
 */
export function registerMastra(mastra: Mastra): void {
  _mastra = mastra;
}

/**
 * Get the registered Mastra instance.
 * Throws if registerMastra() was not called.
 */
export function getMastra(): Mastra {
  if (!_mastra) {
    throw new Error(
      'Mastra instance not registered. ' +
        'Call registerMastra(mastra) at module load time before using Vercel workflows.',
    );
  }
  return _mastra;
}

/**
 * Check if a Mastra instance has been registered.
 */
export function hasMastra(): boolean {
  return _mastra !== null;
}
```

### 2. Runtime Functions (`runtime.workflow.ts`)

Module-level functions with Vercel directives. These are the ONLY places where `"use workflow"` and `"use step"` appear.

```typescript
import { RequestContext } from '@mastra/core/di';
import { getMastra } from './singleton';
import { VercelExecutionEngine } from './execution-engine';
import {
  deserializeStepContext,
  buildExecutionParams,
  type SerializedStepContext,
  type MainWorkflowParams,
} from './context';

/**
 * Execute a single step with Vercel durability.
 * This function has "use step" and is statically analyzable.
 */
export async function runStep(
  workflowId: string,
  stepId: string,
  input: unknown,
  serializedContext: SerializedStepContext,
): Promise<unknown> {
  'use step';

  const mastra = getMastra();
  const workflow = mastra.getWorkflowById(workflowId);
  const step = workflow.steps[stepId];

  if (!step) {
    throw new Error(`Step "${stepId}" not found in workflow "${workflowId}"`);
  }

  // Reconstruct execution params from serialized context
  const execParams = buildExecutionParams({
    input,
    serializedContext,
    mastra,
    step,
  });

  return step.execute(execParams);
}

/**
 * Main workflow entry point with Vercel durability.
 * This function has "use workflow" and orchestrates the entire workflow execution.
 */
export async function mainWorkflow(params: MainWorkflowParams): Promise<unknown> {
  'use workflow';

  const mastra = getMastra();
  const workflow = mastra.getWorkflowById(params.workflowId);

  // Create emitter for workflow events
  const emitter = {
    emit: async (event: string, data: any) => {
      // TODO: Implement event publishing if Vercel supports it
    },
    on: () => {},
    off: () => {},
    once: () => {},
  };

  // Create the execution engine
  const engine = new VercelExecutionEngine(mastra, {
    validateInputs: params.validateInputs ?? true,
    shouldPersistSnapshot: () => true, // Configure as needed
  });

  // Execute the workflow
  return engine.execute({
    workflowId: params.workflowId,
    runId: params.runId,
    resourceId: params.resourceId,
    graph: workflow.executionGraph,
    serializedStepGraph: workflow.serializedStepGraph,
    input: params.input,
    initialState: params.initialState,
    resume: params.resume,
    timeTravel: params.timeTravel,
    requestContext: new RequestContext(Object.entries(params.requestContext ?? {})),
    emitter,
    retryConfig: params.retryConfig,
    abortController: new AbortController(),
    format: params.format,
    outputOptions: params.outputOptions,
  });
}
```

### 3. Execution Engine (`execution-engine.ts`)

Extends `DefaultExecutionEngine` to route step execution through Vercel's durable `runStep` function.

```typescript
import type { Mastra } from '@mastra/core/mastra';
import { DefaultExecutionEngine } from '@mastra/core/workflows';
import type {
  ExecutionEngineOptions,
  Step,
  StepResult,
  ExecutionContext,
  Emitter,
  TimeTravelExecutionParams,
} from '@mastra/core/workflows';
import { runStep } from './runtime.workflow';
import { serializeStepContext } from './context';
import { VercelWorkflow } from './workflow';

export class VercelExecutionEngine extends DefaultExecutionEngine {
  constructor(mastra: Mastra, options: ExecutionEngineOptions) {
    super({ mastra, options });
  }

  /**
   * Vercel requires context serialization for durable step execution.
   */
  requiresDurableContextSerialization(): boolean {
    return true;
  }

  /**
   * Execute a step with retry logic using Vercel's durable execution.
   * Routes execution through the module-level runStep function.
   */
  async executeStepWithRetry<T>(
    stepId: string,
    runStepFn: () => Promise<T>,
    params: {
      retries: number;
      delay: number;
      stepSpan?: any;
      workflowId: string;
      runId: string;
    },
  ): Promise<{ ok: true; result: T } | { ok: false; error: { status: 'failed'; error: string; endedAt: number } }> {
    // Parse the operation ID to extract workflow and step IDs
    // Format: `workflow.${workflowId}.step.${stepId}`
    const { workflowId, actualStepId } = this.parseStepOperationId(stepId);

    try {
      // Serialize the current execution context
      const serializedContext = serializeStepContext({
        runId: params.runId,
        workflowId: params.workflowId,
        // ... other context fields
      });

      // Call the durable runStep function
      const result = (await runStep(
        workflowId,
        actualStepId,
        this.getCurrentInput(), // Need to track current input
        serializedContext,
      )) as T;

      return { ok: true, result };
    } catch (e) {
      // Handle errors and retries
      const errorMessage = e instanceof Error ? e.message : String(e);

      params.stepSpan?.error({
        error: e,
        attributes: { status: 'failed' },
      });

      return {
        ok: false,
        error: {
          status: 'failed',
          error: `Error: ${errorMessage}`,
          endedAt: Date.now(),
        },
      };
    }
  }

  /**
   * Parse a step operation ID to extract workflow and step IDs.
   */
  private parseStepOperationId(operationId: string): { workflowId: string; actualStepId: string } {
    // operationId format: `workflow.${workflowId}.step.${stepId}`
    const match = operationId.match(/^workflow\.(.+)\.step\.(.+)$/);
    if (!match) {
      throw new Error(`Invalid step operation ID: ${operationId}`);
    }
    return { workflowId: match[1]!, actualStepId: match[2]! };
  }

  /**
   * Sleep for a duration.
   * TODO: Investigate Vercel scheduling primitives.
   */
  async executeSleepDuration(duration: number, sleepId: string, workflowId: string): Promise<void> {
    // Fallback to setTimeout for now
    // TODO: Use Vercel's scheduling if available
    await new Promise(resolve => setTimeout(resolve, duration < 0 ? 0 : duration));
  }

  /**
   * Sleep until a specific date.
   * TODO: Investigate Vercel scheduling primitives.
   */
  async executeSleepUntilDate(date: Date, sleepUntilId: string, workflowId: string): Promise<void> {
    const duration = date.getTime() - Date.now();
    await new Promise(resolve => setTimeout(resolve, duration < 0 ? 0 : duration));
  }

  /**
   * Detect nested VercelWorkflow instances.
   */
  isNestedWorkflowStep(step: Step<any, any, any>): boolean {
    return step instanceof VercelWorkflow;
  }

  /**
   * Execute a nested VercelWorkflow.
   */
  async executeWorkflowStep(params: {
    step: Step<string, any, any>;
    stepResults: Record<string, StepResult<any, any, any, any>>;
    executionContext: ExecutionContext;
    resume?: { steps: string[]; resumePayload: any; runId?: string };
    timeTravel?: TimeTravelExecutionParams;
    prevOutput: any;
    inputData: any;
    emitter: Emitter;
    startedAt: number;
  }): Promise<StepResult<any, any, any, any> | null> {
    if (!(params.step instanceof VercelWorkflow)) {
      return null;
    }

    // Recursively execute nested workflow via mainWorkflow
    // Similar to InngestExecutionEngine's approach
    // TODO: Implement nested workflow execution

    return null;
  }

  /**
   * Provide Vercel-specific engine context to steps.
   */
  getEngineContext(): Record<string, any> {
    return { engineType: 'vercel' };
  }
}
```

### 4. Workflow Class (`workflow.ts`)

Extends `Workflow` to provide Vercel-specific functionality.

```typescript
import { randomUUID } from 'node:crypto';
import type { Mastra } from '@mastra/core/mastra';
import { Workflow } from '@mastra/core/workflows';
import type { WorkflowConfig, Step, Run } from '@mastra/core/workflows';
import type { z } from 'zod';
import { VercelRun } from './run';
import type { VercelWorkflowConfig, VercelEngineType } from './types';

export class VercelWorkflow<
  TEngineType = VercelEngineType,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TPrevSchema extends z.ZodType<any> = TInput,
> extends Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema> {
  #mastra: Mastra;

  constructor(params: VercelWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>, mastra: Mastra) {
    super(params as WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>);
    this.engineType = 'vercel';
    this.#mastra = mastra;
  }

  /**
   * Register Mastra instance with this workflow.
   */
  __registerMastra(mastra: Mastra) {
    this.#mastra = mastra;
    this.executionEngine.__registerMastra(mastra);
  }

  /**
   * Create a new run instance for this workflow.
   */
  async createRun(options?: {
    runId?: string;
    resourceId?: string;
  }): Promise<Run<TEngineType, TSteps, TState, TInput, TOutput>> {
    const runIdToUse = options?.runId || randomUUID();

    const run = new VercelRun({
      workflowId: this.id,
      runId: runIdToUse,
      resourceId: options?.resourceId,
      executionEngine: this.executionEngine,
      executionGraph: this.executionGraph,
      serializedStepGraph: this.serializedStepGraph,
      mastra: this.#mastra,
      retryConfig: this.retryConfig,
      cleanup: () => this.runs.delete(runIdToUse),
      workflowSteps: this.steps,
      workflowEngineType: this.engineType,
      validateInputs: this.options.validateInputs,
    });

    this.runs.set(runIdToUse, run as any);
    return run as any;
  }
}
```

### 5. Run Class (`run.ts`)

Extends `Run` to trigger the Vercel workflow execution.

```typescript
import { Run } from '@mastra/core/workflows';
import type { WorkflowResult, ResumeParams } from '@mastra/core/workflows';
import { mainWorkflow } from './runtime.workflow';
import type { MainWorkflowParams } from './types';

export class VercelRun</* type params */> extends Run</* type params */> {
  /**
   * Start the workflow execution.
   */
  async start(input: TInput): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    const params: MainWorkflowParams = {
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      input,
      initialState: {},
      requestContext: this.serializeRequestContext(),
      retryConfig: this.retryConfig,
      validateInputs: this.validateInputs,
    };

    return mainWorkflow(params) as Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  }

  /**
   * Resume a suspended workflow.
   */
  async resume(params: ResumeParams): Promise<WorkflowResult<TState, TInput, TOutput, TSteps>> {
    // Load snapshot, construct resume params, call mainWorkflow
    // Similar to InngestRun.resume()

    const snapshot = await this.mastra?.getStorage()?.loadWorkflowSnapshot({
      workflowName: this.workflowId,
      runId: this.runId,
    });

    const workflowParams: MainWorkflowParams = {
      workflowId: this.workflowId,
      runId: this.runId,
      resourceId: this.resourceId,
      input: snapshot?.context?.input,
      initialState: snapshot?.value ?? {},
      resume: {
        steps: params.steps,
        stepResults: snapshot?.context ?? {},
        resumePayload: params.resumeData,
        resumePath: snapshot?.suspendedPaths?.[params.steps[0]] ?? [],
      },
      requestContext: this.serializeRequestContext(),
      retryConfig: this.retryConfig,
      validateInputs: this.validateInputs,
    };

    return mainWorkflow(workflowParams) as Promise<WorkflowResult<TState, TInput, TOutput, TSteps>>;
  }

  /**
   * Serialize request context for passing to mainWorkflow.
   */
  private serializeRequestContext(): Record<string, any> {
    const obj: Record<string, any> = {};
    this.requestContext?.forEach((value, key) => {
      obj[key] = value;
    });
    return obj;
  }
}
```

### 6. Context Serialization (`context.ts`)

Utilities for serializing and deserializing execution context.

```typescript
import type { Mastra } from '@mastra/core';
import type { RequestContext } from '@mastra/core/di';
import type { Step, StepResult, ExecuteFunctionParams } from '@mastra/core/workflows';
import { getStepResult } from '@mastra/core/workflows/step';

/**
 * Serialized step context that can be passed to runStep.
 */
export interface SerializedStepContext {
  runId: string;
  workflowId: string;
  resourceId?: string;
  state: Record<string, any>;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  executionPath: number[];
  retryCount: number;
  requestContext: Record<string, any>;
  resumeData?: any;
  suspendData?: any;
}

/**
 * Params for mainWorkflow function.
 */
export interface MainWorkflowParams {
  workflowId: string;
  runId: string;
  resourceId?: string;
  input: any;
  initialState?: Record<string, any>;
  resume?: {
    steps: string[];
    stepResults: Record<string, StepResult<any, any, any, any>>;
    resumePayload: any;
    resumePath: number[];
    forEachIndex?: number;
    label?: string;
  };
  timeTravel?: any;
  requestContext?: Record<string, any>;
  retryConfig?: { attempts?: number; delay?: number };
  validateInputs?: boolean;
  format?: 'legacy' | 'vnext';
  outputOptions?: { includeState?: boolean; includeResumeLabels?: boolean };
}

/**
 * Serialize step context for passing to runStep.
 */
export function serializeStepContext(params: {
  runId: string;
  workflowId: string;
  resourceId?: string;
  state: Record<string, any>;
  stepResults: Record<string, StepResult<any, any, any, any>>;
  executionPath: number[];
  retryCount: number;
  requestContext: RequestContext;
  resumeData?: any;
  suspendData?: any;
}): SerializedStepContext {
  // Serialize RequestContext Map to plain object
  const serializedRequestContext: Record<string, any> = {};
  params.requestContext.forEach((value, key) => {
    serializedRequestContext[key] = value;
  });

  return {
    runId: params.runId,
    workflowId: params.workflowId,
    resourceId: params.resourceId,
    state: params.state,
    stepResults: params.stepResults,
    executionPath: params.executionPath,
    retryCount: params.retryCount,
    requestContext: serializedRequestContext,
    resumeData: params.resumeData,
    suspendData: params.suspendData,
  };
}

/**
 * Build ExecuteFunctionParams from serialized context.
 * Reconstructs non-serializable parts (functions, mastra reference).
 */
export function buildExecutionParams(params: {
  input: unknown;
  serializedContext: SerializedStepContext;
  mastra: Mastra;
  step: Step<any, any, any>;
}): ExecuteFunctionParams<any, any, any, any, any> {
  const { input, serializedContext, mastra, step } = params;

  // Reconstruct RequestContext from serialized form
  const requestContext = new Map(Object.entries(serializedContext.requestContext)) as unknown as RequestContext;

  // State management
  let currentState = serializedContext.state;
  const setState = (newState: any) => {
    currentState = newState;
  };

  // Suspend tracking
  let suspended: { payload: any } | undefined;
  let bailed: { payload: any } | undefined;

  return {
    runId: serializedContext.runId,
    workflowId: serializedContext.workflowId,
    resourceId: serializedContext.resourceId,
    mastra,
    requestContext,
    inputData: input,
    state: currentState,
    setState,
    retryCount: serializedContext.retryCount,
    resumeData: serializedContext.resumeData,
    suspendData: serializedContext.suspendData,
    tracingContext: { currentSpan: undefined },
    getInitData: () => serializedContext.stepResults?.input as any,
    getStepResult: getStepResult.bind(null, serializedContext.stepResults),
    suspend: async (suspendPayload?: any) => {
      suspended = { payload: suspendPayload };
    },
    bail: (result: any) => {
      bailed = { payload: result };
    },
    abort: () => {
      // TODO: Handle abort
    },
    engine: { engineType: 'vercel' },
    abortSignal: new AbortController().signal,
    writer: undefined as any, // TODO: Handle streaming
  };
}
```

### 7. Types (`types.ts`)

```typescript
import type { Step, WorkflowConfig } from '@mastra/core/workflows';
import type { z } from 'zod';

export type VercelEngineType = {
  engineType: 'vercel';
};

export interface VercelWorkflowConfig<
  TWorkflowId extends string = string,
  TState extends z.ZodObject<any> = z.ZodObject<any>,
  TInput extends z.ZodType<any> = z.ZodType<any>,
  TOutput extends z.ZodType<any> = z.ZodType<any>,
  TSteps extends Step<string, any, any>[] = Step<string, any, any>[],
> extends Omit<WorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps>, 'executionEngine'> {
  // Vercel-specific config options can be added here
}
```

### 8. Public Exports (`index.ts`)

```typescript
export { registerMastra, getMastra, hasMastra } from './singleton';
export { VercelExecutionEngine } from './execution-engine';
export { VercelWorkflow } from './workflow';
export { VercelRun } from './run';
export { mainWorkflow, runStep } from './runtime.workflow';
export type { VercelEngineType, VercelWorkflowConfig, SerializedStepContext, MainWorkflowParams } from './types';
export { serializeStepContext, buildExecutionParams } from './context';
```

---

## User Setup

### Basic Usage

```typescript
// lib/mastra.ts
import { Mastra } from '@mastra/core';
import { registerMastra, VercelWorkflow } from '@mastra/vercel';
import { z } from 'zod';

// Define a workflow
const myWorkflow = new VercelWorkflow({
  id: 'my-workflow',
  inputSchema: z.object({ value: z.number() }),
  outputSchema: z.object({ result: z.number() }),
});

// Build the workflow
myWorkflow.then(stepA).then(stepB).commit();

// Create Mastra instance
export const mastra = new Mastra({
  workflows: { myWorkflow },
});

// IMPORTANT: Register at module load time
registerMastra(mastra);
```

```typescript
// app/api/workflow/route.ts (Next.js API route)
import { mastra } from '@/lib/mastra';

export async function POST(request: Request) {
  const { value } = await request.json();

  const workflow = mastra.getWorkflow('my-workflow');
  const run = await workflow.createRun();
  const result = await run.start({ value });

  return Response.json(result);
}
```

---

## Implementation Order

### Phase 1: Foundation

1. [ ] Create package structure (`workflows/vercel/`)
2. [ ] Set up build configuration (tsup, tsconfig, vitest)
3. [ ] Implement `singleton.ts` - Mastra registration
4. [ ] Implement `types.ts` - Type definitions

### Phase 2: Core Runtime

5. [ ] Implement `context.ts` - Serialization utilities
6. [ ] Implement `runtime.workflow.ts` - `mainWorkflow` and `runStep` with directives
7. [ ] Implement `execution-engine.ts` - `VercelExecutionEngine`

### Phase 3: Workflow Integration

8. [ ] Implement `workflow.ts` - `VercelWorkflow`
9. [ ] Implement `run.ts` - `VercelRun`
10. [ ] Implement `index.ts` - Public exports

### Phase 4: Testing

11. [ ] Test simple linear workflow (stepA → stepB → stepC)
12. [ ] Test memoization (verify steps don't re-run on retry)
13. [ ] Test retry behavior with `RetryableError`

### Phase 5: Advanced Features

14. [ ] Add parallel execution support
15. [ ] Add conditional branching support
16. [ ] Add loop/foreach support
17. [ ] Add suspend/resume support
18. [ ] Add nested workflow support

### Phase 6: Polish

19. [ ] Add proper error handling and messages
20. [ ] Add logging/telemetry integration
21. [ ] Documentation and examples
22. [ ] Performance testing

---

## Open Questions

### 1. Vercel Scheduling Primitives

Does Vercel's Workflow SDK have built-in sleep/scheduling primitives?

- If yes: Override `executeSleepDuration` and `executeSleepUntilDate` to use them
- If no: Fall back to `setTimeout` (non-durable) or external scheduling

### 2. Retry Mechanism

How does `RetryableError` work in Vercel's SDK?

- What's the retry delay format?
- Is there a max retry limit?
- How do we configure retry behavior?

### 3. Event Publishing

Does Vercel support real-time event publishing for workflow progress?

- If yes: Implement emitter integration
- If no: Events will be local only (acceptable for MVP)

### 4. Memoization Granularity

Verify memoization behavior:

- Is it based on `(step location + input arguments)`?
- How does it handle steps called multiple times with different inputs?

### 5. Nested Workflow Invocation

Can we recursively call `mainWorkflow` for nested workflows?

- Or do we need a different pattern like Inngest's `step.invoke()`?

---

## Comparison with Inngest Implementation

| Aspect           | Inngest                     | Vercel                                   |
| ---------------- | --------------------------- | ---------------------------------------- |
| Durable wrapper  | `inngestStep.run(id, fn)`   | Module-level `runStep` with `"use step"` |
| Function passing | Runtime (can pass closures) | Compile-time (ID-based lookup)           |
| Sleep            | `inngestStep.sleep()`       | TBD - may need external scheduling       |
| Nested workflows | `inngestStep.invoke()`      | Recursive `mainWorkflow` call            |
| Retry            | `RetryAfterError`           | `RetryableError`                         |
| Context access   | Passed via closure          | Singleton registration                   |
| Memoization      | Inngest platform handles    | Vercel SDK handles                       |

---

## Success Criteria

1. **Basic workflow execution**: Linear workflows execute correctly with Vercel durability
2. **Memoization works**: Completed steps don't re-execute on retry/resume
3. **Retry behavior**: `RetryableError` triggers proper retries
4. **Suspend/resume**: Workflows can suspend and resume with payload
5. **Control flow**: Parallel, conditional, and loop constructs work
6. **Nested workflows**: Workflows containing other workflows execute correctly
7. **API compatibility**: `VercelWorkflow` has same API as `Workflow` / `InngestWorkflow`
