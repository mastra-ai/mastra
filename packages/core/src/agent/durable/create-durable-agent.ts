/**
 * Factory function to create a DurableAgent that wraps an existing Agent.
 *
 * This is the recommended way to add durable execution capabilities to an agent.
 * The factory creates a DurableAgent instance with resumable streams.
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createDurableAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createDurableAgent({ agent });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 * ```
 */

import type { MastraServerCache } from '../../cache/base';
import type { PubSub } from '../../events/pubsub';
import type { Agent } from '../agent';

import { DurableAgent } from './durable-agent';
import type { DurableAgentConfig } from './durable-agent';
import type { WorkflowExecutor } from './executors';

/**
 * Options for createDurableAgent factory function.
 */
export interface CreateDurableAgentOptions<
  TAgentId extends string = string,
  TTools extends Record<string, any> = Record<string, any>,
  TOutput = undefined,
> {
  /** The Agent to wrap with durable execution capabilities */
  agent: Agent<TAgentId, TTools, TOutput>;

  /** Optional ID override (defaults to agent.id) */
  id?: TAgentId;

  /** Optional name override (defaults to agent.name) */
  name?: string;

  /**
   * Cache instance for storing stream events.
   * Enables resumable streams - clients can disconnect and reconnect
   * without missing events.
   *
   * - If not provided: Inherits from Mastra instance, or uses InMemoryServerCache
   * - If provided: Uses the provided cache backend (e.g., Redis)
   * - If set to `false`: Disables caching (streams are not resumable)
   */
  cache?: MastraServerCache | false;

  /**
   * PubSub instance for streaming events.
   * Optional - if not provided, defaults to EventEmitterPubSub.
   */
  pubsub?: PubSub;

  /**
   * Workflow executor for running the durable workflow.
   * Defaults to LocalWorkflowExecutor (direct execution).
   */
  executor?: WorkflowExecutor;

  /** Maximum steps for agentic loop */
  maxSteps?: number;
}

/**
 * Create a DurableAgent that wraps an existing Agent.
 *
 * This factory function is the recommended way to add durable execution
 * capabilities to an agent. It creates a DurableAgent instance with
 * resumable streams.
 *
 * @param options - Configuration options
 * @returns A DurableAgent instance
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are helpful',
 *   model: openai('gpt-4'),
 * });
 *
 * const durableAgent = createDurableAgent({ agent });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: durableAgent },
 * });
 * ```
 */
export function createDurableAgent<
  TAgentId extends string = string,
  TTools extends Record<string, any> = Record<string, any>,
  TOutput = undefined,
>(options: CreateDurableAgentOptions<TAgentId, TTools, TOutput>): DurableAgent<TAgentId, TTools, TOutput> {
  const { agent, id, name, cache, pubsub, executor, maxSteps } = options;

  return new DurableAgent({
    agent,
    id,
    name,
    cache,
    pubsub,
    executor,
    maxSteps,
  } as DurableAgentConfig<TAgentId, TTools, TOutput>);
}

/**
 * Check if an object is a DurableAgent
 */
export function isDurableAgent(obj: any): obj is DurableAgent {
  return obj instanceof DurableAgent;
}

/**
 * Alias for isDurableAgent for backwards compatibility
 * @deprecated Use isDurableAgent instead
 */
export const isLocalDurableAgent = isDurableAgent;

// Re-export types for convenience
export type { DurableAgentConfig, DurableAgentStreamOptions, DurableAgentStreamResult } from './durable-agent';

// Backwards compatibility type aliases
export type LocalDurableAgent<
  TAgentId extends string = string,
  TTools extends Record<string, any> = Record<string, any>,
  TOutput = undefined,
> = DurableAgent<TAgentId, TTools, TOutput>;
