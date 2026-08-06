import { ExecutionEngine } from '@mastra/core/workflows';

/**
 * Placeholder engine for Workflow SDK-backed workflows.
 *
 * Mastra's other engines walk the graph in process. Here the walk happens
 * inside the Workflow SDK sandbox (`src/workflows/walker.ts`) and individual Mastra
 * callables are invoked from a `"use step"` function, so nothing routes through
 * an in-process engine.
 *
 * The class still exists because `Workflow` requires one, and because reaching
 * it means something bypassed `WorkflowSdkRun` — worth an explicit error rather than
 * silently running a Mastra workflow on the default, non-durable engine.
 */
export class WorkflowSdkExecutionEngine extends ExecutionEngine {
  async execute<TState, TInput, TOutput>(_params: unknown): Promise<TOutput> {
    throw new Error(
      'WorkflowSdkExecutionEngine.execute() was called directly. Workflows created with ' +
        '@mastra/workflow-sdk execute inside the Workflow SDK runtime — start them with ' +
        '`workflow.createRun()` followed by `run.start()`, or with `start(mastraRunner, ...)` ' +
        'from `workflow/api`.',
    );
  }
}
