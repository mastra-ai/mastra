import { slimNestedAgentChunks } from '../stream/strip-model-snapshots';

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

/**
 * How long a run's stream log (`agent.stream.<runId>`) is retained after its
 * last append, by default.
 *
 * This MUST match `AGENT_RUN_RECORD_TTL_MS` (`agent/streams/run-records.ts`;
 * events cannot import from agent). A run parked on a tool approval appends
 * nothing while it waits, so its retention is never refreshed — and its
 * ownership record authorizes `observe()` for 24 hours. A log that expires
 * sooner leaves that window authorized but empty: the observer hangs without
 * ever receiving the approval request it is waiting to act on. The two
 * lifetimes expire together, so an authorized run always still has its
 * events.
 *
 * The log is a delivery buffer, not the system of record: messages and
 * suspension snapshots live in storage. An expired log is recreated on the
 * next append with indices past every index it could have issued before (see
 * `MastraServerCache.listPushIndexed`), so attached observers resynchronise
 * instead of dropping frames. Run cleanup deletes the log when the run ends;
 * this retention bounds it when cleanup never runs.
 */
export const DEFAULT_RUN_LOG_TTL_MS = 24 * 60 * 60 * 1000;

/** @deprecated Use {@link DEFAULT_RUN_LOG_TTL_MS}, or configure `runLogTtlMs` on `CachingPubSub`. */
export const RUN_LOG_TTL_MS = DEFAULT_RUN_LOG_TTL_MS;

/**
 * How long a thread's event stream (`agent.thread-stream.<key>`) is retained
 * after its last append, by default. Active threads re-stamp it on every
 * publish; storage holds a thread's saved runs, and the runtime trims saved
 * output off the topic, so an idle thread's leftover tail only needs to
 * survive a reconnect window.
 */
export const DEFAULT_THREAD_STREAM_LOG_TTL_MS = 60 * 60 * 1000;

const RUN_LOG_TOPIC_PREFIX = 'agent.stream.';

/**
 * `agent.control.<runId>` and `agent.control.<runId>.ack` carry one run's
 * abort handshake. Mirrors AGENT_CONTROL_TOPIC / abortAckTopic in
 * `agent/streams/`; events cannot import from agent.
 */
const RUN_CONTROL_TOPIC_PREFIX = 'agent.control.';

/** Mirrors AGENT_THREAD_STREAM_TOPIC_PREFIX in `agent/thread-stream-topic.ts`; events cannot import from agent. */
const THREAD_STREAM_TOPIC_PREFIX = 'agent.thread-stream.';

/** Per-topic retention used when stamping a cached log's TTL on append. */
export interface CachedLogTtls {
  /** Retention for `agent.stream.<runId>` logs. Defaults to {@link DEFAULT_RUN_LOG_TTL_MS}. */
  runLogTtlMs?: number;
  /** Retention for `agent.thread-stream.<key>` logs. Defaults to {@link DEFAULT_THREAD_STREAM_LOG_TTL_MS}. */
  threadStreamLogTtlMs?: number;
}

/** Minimum retention for a topic's cached log, or `undefined` for the cache default. */
export function cachedLogTtlMs(topic: string, ttls?: CachedLogTtls): number | undefined {
  if (topic.startsWith(RUN_LOG_TOPIC_PREFIX)) return ttls?.runLogTtlMs ?? DEFAULT_RUN_LOG_TTL_MS;
  if (topic.startsWith(THREAD_STREAM_TOPIC_PREFIX))
    return ttls?.threadStreamLogTtlMs ?? DEFAULT_THREAD_STREAM_LOG_TTL_MS;
  return undefined;
}

/**
 * Idle retention for a topic that belongs to a single run or thread, or
 * `undefined` for a topic a transport should bound with its own backstop.
 *
 * A persistent transport (Redis/Valkey Streams) needs a long idle backstop
 * for work-queue topics, whose grouped consumers must still find their
 * backlog after an outage. A run's topics have no such consumer: they are
 * fan-out, their replay history is bounded by {@link cachedLogTtlMs} in the
 * server cache, and the run record that authorizes reading them expires in a
 * day. So they share the retention of the cached log they mirror — a day for
 * run topics, matching the record (a run parked on an approval must stay
 * readable for as long as it is authorizable), and an hour for thread
 * streams. Holding them for the transport's multi-day backstop instead just
 * leaves finished runs in the store for days.
 *
 * Run cleanup deletes these topics promptly when the owning process survives;
 * this retention is what bounds them when it does not.
 */
export function streamTopicIdleTtlMs(topic: string, ttls?: CachedLogTtls): number | undefined {
  if (topic.startsWith(RUN_LOG_TOPIC_PREFIX) || topic.startsWith(RUN_CONTROL_TOPIC_PREFIX))
    return ttls?.runLogTtlMs ?? DEFAULT_RUN_LOG_TTL_MS;
  if (topic.startsWith(THREAD_STREAM_TOPIC_PREFIX))
    return ttls?.threadStreamLogTtlMs ?? DEFAULT_THREAD_STREAM_LOG_TTL_MS;
  return undefined;
}

/**
 * The copy of `event` a run's cached log keeps.
 *
 * A delegated sub-agent's chunks are forwarded on the run stream inside
 * `tool-output` / `workflow-step-output`, and each nested step-start,
 * step-finish and finish carries the sub-agent's full prompt, history and
 * steps. Stored as-is, every delegated run grows the log by megabytes. The log
 * keeps them slimmed; live subscribers still receive the event as published,
 * so a caller reading its own run sees the same chunks as a plain Agent's
 * caller (see #29035).
 */
export function toCachedLogFrame<E extends { type: string; data?: unknown }>(topic: string, event: E): E {
  if (event.type !== 'chunk' || !topic.startsWith(RUN_LOG_TOPIC_PREFIX)) return event;
  const data = slimNestedAgentChunks(event.data);
  return data === event.data ? event : { ...event, data };
}
