/**
 * EventedAgent - A durable agent that executes steps through event workers.
 *
 * EventedAgent extends DurableAgent and overrides the execution strategy to use
 * the evented workflow engine. stream() returns without awaiting execution,
 * while the run's completion promise is tracked for safe suspension/resume.
 * Events are streamed via pubsub as the workflow executes.
 */

import type { ToolsInput } from '../types';

import { DurableAgent } from './durable-agent';
import type { DurableAgentConfig } from './types';

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
 * - You need runs to survive process death: an active run can be picked up by
 *   a fresh process over the same storage via `recover(runId)` /
 *   `recoverActiveRuns()` (running step state is persisted before execution)
 *
 * The key difference from DurableAgent is the execution strategy:
 * - DurableAgent: Runs workflow steps in-process via createRun + start.
 * - EventedAgent: Steps execute via events on `mastra.pubsub`, so any worker
 *   sharing that bus can process them. The agent's stream follows
 *   `mastra.pubsub`, so streaming, suspend/resume, and finish events work even
 *   when the agent was constructed with its own pubsub. Execution is tracked
 *   in the background so resume waits for suspension persistence.
 *
 * Register the EventedAgent on a `Mastra` instance (with storage) to get
 * evented execution — the evented engine needs the host's pubsub, storage,
 * and event workers. Without a host, the agent falls back to the default
 * in-process engine (with a warning), preserving the released behavior of a
 * standalone evented agent. Recovery entry points (`recover`,
 * `listActiveRuns`, `recoverActiveRuns`) still require a host and throw
 * directly without one.
 *
 * @example
 * ```typescript
 * import { Mastra } from '@mastra/core';
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
 * // Register on a Mastra host to get evented execution (a hostless agent
 * // falls back to the default in-process engine).
 * const mastra = new Mastra({
 *   agents: { myAgent: eventedAgent },
 *   storage: new LibSQLStore({ url: 'file:mastra.db' }),
 * });
 *
 * const { output, runId, cleanup } = await eventedAgent.stream('Hello!');
 * const text = await output.text;
 * cleanup();
 *
 * // After a crash/restart, a fresh process over the same storage can resume:
 * // await eventedAgent.recoverActiveRuns();
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
   * EventedAgent runs the durable agentic loop on the evented execution
   * engine (pubsub + WorkflowEventProcessor) instead of the default
   * in-process engine.
   * @internal
   */
  protected static override readonly executionEngine = 'evented' as const;
}

/**
 * Check if an object is an EventedAgent class instance
 */
export function isEventedAgentClass(obj: any): obj is EventedAgent {
  return obj instanceof EventedAgent;
}
