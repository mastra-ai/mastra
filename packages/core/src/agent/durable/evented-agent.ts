/**
 * EventedAgent - A durable agent that uses fire-and-forget execution.
 *
 * EventedAgent extends DurableAgent and overrides the execution strategy to use
 * fire-and-forget execution via the workflow engine's startAsync() method.
 *
 * Unlike DurableAgent which runs the workflow synchronously, EventedAgent:
 * 1. Uses startAsync() for non-blocking execution
 * 2. Fire-and-forget pattern - execution starts and returns immediately
 * 3. Events are streamed via pubsub as the workflow executes
 */

import type { ToolsInput } from '../types';

import { DurableAgent } from './durable-agent';
import type { DurableAgentConfig } from './durable-agent';
import type { DurableAgenticWorkflowInput } from './types';

/**
 * Configuration for EventedAgent - wraps an existing Agent with fire-and-forget execution
 */
export interface EventedAgentConfig<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends DurableAgentConfig<TAgentId, TTools, TOutput> {}

/**
 * EventedAgent extends DurableAgent to use fire-and-forget execution.
 *
 * This agent type uses the built-in evented workflow engine, which is useful when:
 * - You don't need an external execution engine (like Inngest)
 * - You want fire-and-forget execution with pubsub streaming
 * - You need resumable streams with event caching
 *
 * The key difference from DurableAgent is the execution strategy:
 * - DurableAgent: Runs the workflow synchronously via createRun + start
 * - EventedAgent: Uses run.startAsync() for fire-and-forget execution
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { EventedAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const eventedAgent = new EventedAgent({ agent });
 *
 * const { output, runId, cleanup } = await eventedAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 * ```
 */
export class EventedAgent<
  TAgentId extends string = string,
  TTools extends ToolsInput = ToolsInput,
  TOutput = undefined,
> extends DurableAgent<TAgentId, TTools, TOutput> {
  /**
   * Create a new EventedAgent that wraps an existing Agent
   */
  constructor(config: EventedAgentConfig<TAgentId, TTools, TOutput>) {
    super(config);
  }

  /**
   * Execute the durable workflow using fire-and-forget pattern.
   *
   * Unlike DurableAgent which runs the workflow synchronously, EventedAgent uses
   * the workflow's startAsync() method for non-blocking execution.
   *
   * @param runId - The unique run ID
   * @param workflowInput - The serialized workflow input
   * @internal
   */
  protected override async executeWorkflow(runId: string, workflowInput: DurableAgenticWorkflowInput): Promise<void> {
    try {
      const workflow = this.getWorkflow();
      const run = await workflow.createRun({
        runId,
        pubsub: this.pubsubInternal,
      });
      // Fire and forget - use startAsync for non-blocking execution
      await run.startAsync({ inputData: workflowInput });
    } catch (error) {
      await this.emitError(runId, error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Check if an object is an EventedAgent class instance
 */
export function isEventedAgentClass(obj: any): obj is EventedAgent {
  return obj instanceof EventedAgent;
}
