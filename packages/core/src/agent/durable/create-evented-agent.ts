/**
 * Factory function to create an EventedAgent that wraps an existing Agent.
 *
 * This creates a durable agent that runs its agentic loop on the built-in
 * evented workflow engine: execution is fire-and-forget (the run is started
 * without being awaited) and driven by events on the Mastra host's pubsub.
 *
 * The returned agent must be registered on a `Mastra` instance (with storage)
 * before use; calling it unregistered fails with a clear `MastraError`.
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

  /**
   * Per-topic opt-out of the replay cache.
   *
   * Return `false` to publish a topic straight through to the underlying
   * PubSub without recording it in the cache. Subscribers of that topic then
   * receive live events only and cannot resume from an offset. Use this to
   * trade replay for minimum publish latency on hot topics when the cache is
   * remote (e.g. cross-region Redis). Run-local topics are always excluded,
   * regardless of this option.
   */
  shouldCache?: (topic: string) => boolean;
}

/**
 * Create an EventedAgent that wraps an existing Agent.
 *
 * This factory function creates an EventedAgent instance with fire-and-forget
 * execution via the built-in evented workflow engine. Runs survive process
 * death: over the same storage, a fresh process can resume in-flight runs via
 * `recover(runId)` / `recoverActiveRuns()`.
 *
 * @param options - Configuration options
 * @returns An EventedAgent instance (register it on a `Mastra` host before use)
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
  const { agent, pubsub, cache, maxSteps, shouldCache } = options;

  return new EventedAgent({
    agent,
    pubsub,
    cache,
    maxSteps,
    shouldCache,
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
