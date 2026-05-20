/**
 * Temporal WorkflowRunner - transparent runner adapter for standard Mastra workflows.
 *
 * This module provides the `TemporalRunner` adapter that allows standard Mastra workflows
 * to be executed on Temporal without requiring the TemporalWorkflow class or rewrites.
 *
 * Usage:
 * ```typescript
 * import { Client } from '@temporalio/client';
 * import { TemporalRunner } from '@mastra/workflows/temporal';
 * import { createWorkflow } from '@mastra/core/workflows';
 * import { z } from 'zod';
 *
 * const client = new Client();
 * const runner = new TemporalRunner({
 *   client,
 *   taskQueue: 'default',
 * });
 *
 * // Create a standard workflow with transparent Temporal execution
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
 * // workflow is now a TemporalWorkflow and can be executed with Temporal
 * ```
 */

import type { WorkflowRunner, Step, Workflow } from '@mastra/core/workflows';
import type { Client } from '@temporalio/client';
import { TemporalWorkflow } from './workflow';
import type { TemporalWorkflowParams } from './workflow';

export interface TemporalRunnerOptions {
  /** The Temporal client instance to use for execution */
  client: Client;

  /** The task queue for Temporal workflow execution */
  taskQueue: string;

  /**
   * Optional timeout for workflow execution.
   */
  startToCloseTimeout?: string;
}

/**
 * TemporalRunner - Transparent runner adapter for executing standard Mastra workflows on Temporal.
 *
 * This runner allows you to pass a standard workflow to Temporal without:
 * - Changing your workflow definition code
 * - Using the TemporalWorkflow class
 * - Rewriting workflows when switching runners
 *
 * The runner transparently adapts the standard workflow to use Temporal's execution engine.
 */
export class TemporalRunner implements WorkflowRunner {
  private client: Client;
  private taskQueue: string;
  private startToCloseTimeout?: string;

  constructor(options: TemporalRunnerOptions) {
    this.client = options.client;
    this.taskQueue = options.taskQueue;
    this.startToCloseTimeout = options.startToCloseTimeout;
  }

  /**
   * Adapts a standard Workflow to execute on Temporal.
   *
   * This method:
   * 1. Takes a standard Workflow instance
   * 2. Extracts its configuration and steps
   * 3. Creates a TemporalWorkflow with the same configuration
   * 4. Returns the TemporalWorkflow (which is API-compatible with the original)
   *
   * The adapted workflow inherits the runner's task queue and timeout configuration.
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
    // Extract configuration from the standard workflow
    const temporalConfig = {
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
    };

    // Temporal parameters for the runner
    const temporalParams: TemporalWorkflowParams = {
      client: this.client,
      taskQueue: this.taskQueue,
      startToCloseTimeout: this.startToCloseTimeout,
    };

    // Create and return a TemporalWorkflow with the configuration
    const temporalWorkflow = new TemporalWorkflow<
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TPrevSchema,
      TRequestContext
    >(temporalConfig as any, temporalParams);

    // Copy over any steps that were added after workflow instantiation
    // (e.g., via .then(), .branch(), .parallel() etc.)
    temporalWorkflow.setStepFlow(workflow.stepGraph);
    if (workflow.committed) {
      temporalWorkflow.commit();
    }

    return temporalWorkflow as Workflow<
      any,
      TSteps,
      TWorkflowId,
      TState,
      TInput,
      TOutput,
      TPrevSchema,
      TRequestContext
    >;
  }
}

/**
 * Factory function for creating a Temporal runner.
 * Provides a convenient way to instantiate the runner with options.
 *
 * @example
 * ```typescript
 * import { createTemporalRunner } from '@mastra/workflows/temporal';
 * import { Client } from '@temporalio/client';
 *
 * const client = new Client();
 * const runner = createTemporalRunner({
 *   client,
 *   taskQueue: 'default',
 *   startToCloseTimeout: '5 minutes',
 * });
 * ```
 */
export function createTemporalRunner(options: TemporalRunnerOptions): TemporalRunner {
  return new TemporalRunner(options);
}
