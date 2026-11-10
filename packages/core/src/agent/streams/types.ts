import type { MastraServerCache } from '../../cache/base';
import type { PubSub } from '../../events/pubsub';

/**
 * Event types emitted via pubsub for agent streaming
 */
export type AgentStreamEventType =
  | 'chunk'
  | 'step-start'
  | 'step-finish'
  | 'finish'
  | 'error'
  | 'suspended'
  | 'abort'
  | 'iteration-complete'
  | 'ownership-claimed';

/**
 * Event emitted via pubsub for agent streaming
 */
export interface AgentStreamEvent<T = unknown> {
  /** Event type */
  type: AgentStreamEventType;
  /** Run identifier */
  runId: string;
  /** Event payload */
  data: T;
  /** Epoch ms at which a `chunk` event's chunk was produced. */
  producedAt?: number;
  /** Claim generation of the execution that published the event. See {@link Event.generation}. */
  generation?: number;
  /**
   * Position of this event in its run topic's log. Only present on events read
   * back from the topic; it is stripped before an event reaches an `observe()`
   * consumer.
   */
  index?: number;
  /**
   * The `chunk` or `step-start` event's chunk already ran through the run's output processors
   * before it was published, so the stream consumer must not run them again.
   */
  outputProcessed?: boolean;
}

/**
 * Configuration of an agent's resumable run streams: the transport run events
 * are published on and the replay cache that lets readers reconnect.
 */
export interface AgentStreamsConfig {
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

  /**
   * Timeout in milliseconds before automatic cleanup of registry entries
   * after a stream finishes or errors. This provides a grace period for
   * late observers to access the stream.
   *
   * Defaults to 30000 (30 seconds).
   * Set to 0 to disable auto-cleanup (manual cleanup() required).
   */
  cleanupTimeoutMs?: number;
}
