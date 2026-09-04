/**
 * Topic prefixes whose events are only ever consumed by the process that
 * published them.
 *
 * `workflow.events.v2.<runId>` carries per-run watch events: the execution
 * engine subscribes per-run, in-process, and nothing replays them. The payloads
 * accumulate step results and routinely run to megabytes.
 */
export const RUN_LOCAL_TOPIC_PREFIXES = ['workflow.events.v2.'] as const;

/**
 * Whether a topic is run-local — consumed only by the publishing process.
 *
 * Run-local topics must never be relayed to other instances, nor mirrored into
 * a shared replay cache: no other instance can read them, so caching only grows
 * the store without bound (see issue #20646).
 *
 * This predicate is the single source of truth for that policy. It is consumed
 * both by the `mastra.pubsub` proxy (which tags publishes `localOnly` so the
 * broker skips cross-instance fan-out) and by the durable agent's
 * `CachingPubSub` wiring (which sits *above* that proxy and so cannot observe
 * the `localOnly` flag itself).
 */
export function isRunLocalTopic(topic: string): boolean {
  return RUN_LOCAL_TOPIC_PREFIXES.some(prefix => topic.startsWith(prefix));
}
