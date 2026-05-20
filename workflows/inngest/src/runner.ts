/**
 * Inngest WorkflowRunner - transparent runner adapter for standard Mastra workflows.
 *
 * This module provides the `InngestRunner` adapter that allows standard Mastra workflows
 * to be executed on Inngest without requiring the InngestWorkflow class or rewrites.
 *
 * Usage:
 * ```typescript
 * import { Inngest } from 'inngest';
 * import { InngestRunner } from '@mastra/workflows/inngest';
 * import { createWorkflow } from '@mastra/core/workflows';
 * import { z } from 'zod';
 *
 * const inngest = new Inngest({ id: 'my-app' });
 * const runner = new InngestRunner({ inngest });
 *
 * // Create a standard workflow with transparent Inngest execution
 * const workflow = createWorkflow({
 *   id: 'example',
 *   inputSchema: z.object({ message: z.string() }),
 *   outputSchema: z.object({ result: z.string() }),
 *   runner,  // ← Transparent runner
 *   steps: [
 *     // ... steps
 *   ]
 * });
 *
 * // workflow is now an InngestWorkflow and can be executed with Inngest
 * ```
 */

import type { WorkflowRunner, Step, Workflow } from '@mastra/core/workflows';
import type { Inngest } from 'inngest';
import type { InngestWorkflowConfig } from './types';
import { InngestWorkflow } from './workflow';

export interface InngestRunnerOptions {
  /** The Inngest client instance to use for execution */
  inngest: Inngest;

  /**
   * Optional Inngest flow control configuration.
   * Applied to all workflows using this runner.
   */
  concurrency?: number;
  rateLimit?: {
    limit: number;
    period: string;
  };
  throttle?: {
    limit: number;
    period: string;
  };
  debounce?: {
    limit: number;
    period: string;
  };
  priority?: {
    run: number;
  };
}

/**
 * InngestRunner - Transparent runner adapter for executing standard Mastra workflows on Inngest.
 *
 * This runner allows you to pass a standard workflow to Inngest without:
 * - Changing your workflow definition code
 * - Using the InngestWorkflow class
 * - Rewriting workflows when switching runners
 *
 * The runner transparently adapts the standard workflow to use Inngest's execution engine.
 */
export class InngestRunner implements WorkflowRunner {
  private inngest: Inngest;
  private concurrency?: number;
  private rateLimit?: { limit: number; period: string };
  private throttle?: { limit: number; period: string };
  private debounce?: { limit: number; period: string };
  private priority?: { run: number };

  constructor(options: InngestRunnerOptions) {
    this.inngest = options.inngest;
    this.concurrency = options.concurrency;
    this.rateLimit = options.rateLimit;
    this.throttle = options.throttle;
    this.debounce = options.debounce;
    this.priority = options.priority;
  }

  /**
   * Adapts a standard Workflow to execute on Inngest.
   *
   * This method:
   * 1. Takes a standard Workflow instance
   * 2. Extracts its configuration and steps
   * 3. Creates an InngestWorkflow with the same configuration
   * 4. Returns the InngestWorkflow (which is API-compatible with the original)
   *
   * The adapted workflow inherits the runner's flow control configuration.
   */
  adaptWorkflow<
    TEngineType,
    TSteps extends Step<string, any, any, any, any, any, TEngineType>[],
    TWorkflowId extends string,
    TState,
    TInput,
    TOutput,
    TPrevSchema,
    TRequestContext extends Record<string, any> | unknown,
  >(
    workflow: Workflow<TEngineType, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema, TRequestContext>,
  ): Workflow<any, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema, TRequestContext> {
    // Build the InngestWorkflowConfig from the standard workflow
    const inngestConfig: InngestWorkflowConfig<TWorkflowId, TState, TInput, TOutput, TSteps> = {
      id: workflow.id,
      description: workflow.description,
      inputSchema: workflow.inputSchema,
      outputSchema: workflow.outputSchema,
      stateSchema: workflow.stateSchema,
      requestContextSchema: workflow.requestContextSchema,
      steps: workflow.stepDefs,
      retryConfig: workflow.retryConfig,
      options: workflow.options,
      type: workflow.type,
      mastra: workflow.mastra,
      // Apply runner's flow control configuration
      concurrency: this.concurrency,
      rateLimit: this.rateLimit,
      throttle: this.throttle,
      debounce: this.debounce,
      priority: this.priority,
    };

    // Create and return an InngestWorkflow with the configuration
    const inngestWorkflow = new InngestWorkflow<any, TSteps, TWorkflowId, TState, TInput, TOutput>(
      inngestConfig,
      this.inngest,
    );

    // Copy over any steps that were added after workflow instantiation
    // (e.g., via .then(), .branch(), .parallel() etc.)
    inngestWorkflow.setStepFlow(workflow.stepGraph);
    if (workflow.committed) {
      inngestWorkflow.commit();
    }

    return inngestWorkflow as Workflow<any, TSteps, TWorkflowId, TState, TInput, TOutput, TPrevSchema, TRequestContext>;
  }
}

/**
 * Factory function for creating an Inngest runner.
 * Provides a convenient way to instantiate the runner with options.
 *
 * @example
 * ```typescript
 * import { createInngestRunner } from '@mastra/workflows/inngest';
 * import { Inngest } from 'inngest';
 *
 * const inngest = new Inngest({ id: 'my-app' });
 * const runner = createInngestRunner({
 *   inngest,
 *   concurrency: 10,
 * });
 * ```
 */
export function createInngestRunner(options: InngestRunnerOptions): InngestRunner {
  return new InngestRunner(options);
}
