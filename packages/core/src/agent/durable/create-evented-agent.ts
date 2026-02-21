/**
 * Factory function to create an EventedAgent that wraps an existing Agent.
 *
 * This creates a durable agent that uses fire-and-forget execution via
 * the built-in workflow engine with startAsync().
 *
 * @example
 * ```typescript
 * import { Agent } from '@mastra/core/agent';
 * import { createEventedAgent } from '@mastra/core/agent/durable';
 *
 * const agent = new Agent({
 *   id: 'my-agent',
 *   name: 'My Agent',
 *   instructions: 'You are a helpful assistant',
 *   model: openai('gpt-4'),
 * });
 *
 * const eventedAgent = createEventedAgent({ agent });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: eventedAgent },
 * });
 * ```
 */

import type { MastraServerCache } from '../../cache/base';
import type { PubSub } from '../../events/pubsub';
import type { Agent } from '../agent';

import { EventedAgent } from './evented-agent';
import type { EventedAgentConfig } from './evented-agent';

/**
 * Options for createEventedAgent factory function.
 */
export interface CreateEventedAgentOptions<
  TAgentId extends string = string,
  TTools extends Record<string, any> = Record<string, any>,
  TOutput = undefined,
> {
  /** The Agent to wrap with evented durable execution capabilities */
  agent: Agent<TAgentId, TTools, TOutput>;

  /**
   * PubSub instance for streaming events.
   * Optional - if not provided, defaults to EventEmitterPubSub.
   */
  pubsub?: PubSub;

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

  /** Maximum steps for agentic loop */
  maxSteps?: number;
}

/**
 * Create an EventedAgent that wraps an existing Agent.
 *
 * This factory function creates an EventedAgent instance with fire-and-forget
 * execution via the built-in workflow engine.
 *
 * @param options - Configuration options
 * @returns An EventedAgent instance
 *
 * @example
 * ```typescript
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are helpful',
 *   model: openai('gpt-4'),
 * });
 *
 * const eventedAgent = createEventedAgent({ agent });
 *
 * const mastra = new Mastra({
 *   agents: { myAgent: eventedAgent },
 * });
 * ```
 */
export function createEventedAgent<
  TAgentId extends string = string,
  TTools extends Record<string, any> = Record<string, any>,
  TOutput = undefined,
>(options: CreateEventedAgentOptions<TAgentId, TTools, TOutput>): EventedAgent<TAgentId, TTools, TOutput> {
  const { agent, pubsub, cache, maxSteps } = options;

  return new EventedAgent({
    agent,
    pubsub,
    cache,
    maxSteps,
  } as EventedAgentConfig<TAgentId, TTools, TOutput>);
}

/**
 * Check if an object is an EventedAgent
 */
export function isEventedAgent(obj: any): obj is EventedAgent {
  return obj instanceof EventedAgent;
}

// Re-export types for convenience
export type { EventedAgentConfig } from './evented-agent';
