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

  /** Maximum steps for agentic loop */
  maxSteps?: number;

  /**
   * Auto-cleanup timer for durable stream state (ms).
   * Set to `0` to disable auto-cleanup. Defaults to `30_000` (30 seconds).
   */
  cleanupTimeoutMs?: number;
}

/**
 * Create a DurableAgent that wraps an existing Agent.
 *
 * This factory function is the recommended way to add durable execution
 * capabilities to an agent when you need to customize the cache, pubsub, or
 * other advanced options. For the common case, prefer the `durable` config
 * flag on `AgentConfig` — attaching an agent constructed with `durable: true`
 * (or `durable: { … }`) to a `Mastra` instance auto-wraps it at registration.
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
 *
 * @example
 * ```typescript
 * // Equivalent, using the durable config flag:
 * const agent = new Agent({
 *   id: 'my-agent',
 *   instructions: 'You are helpful',
 *   model: openai('gpt-4'),
 *   durable: true,
 * });
 *
 * const mastra = new Mastra({ agents: { myAgent: agent } });
 * ```
 */
export function createDurableAgent<
  TAgentId extends string = string,
  TTools extends Record<string, any> = Record<string, any>,
  TOutput = undefined,
>(options: CreateDurableAgentOptions<TAgentId, TTools, TOutput>): DurableAgent<TAgentId, TTools, TOutput> {
  const { agent, id, name, cache, pubsub, maxSteps, cleanupTimeoutMs } = options;

  return new DurableAgent({
    agent,
    id,
    name,
    cache,
    pubsub,
    maxSteps,
    cleanupTimeoutMs,
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
