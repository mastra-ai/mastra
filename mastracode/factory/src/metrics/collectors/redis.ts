import type { MetricsCollector, MetricsLogger } from '../metrics.js';
import { createProbe } from './probe.js';

/** The commands the collector uses, structurally matching a node-redis client. */
export interface RedisMonitorClient {
  connect(): Promise<unknown>;
  info(): Promise<string>;
  xInfoGroups(key: string): Promise<Array<{ name: unknown; pending: unknown; lag?: unknown }>>;
  on(event: 'error', listener: (error: unknown) => void): unknown;
  destroy?(): void;
}

/** What `@mastra/redis-streams`' `RedisStreamsPubSub` offers for monitoring. */
export interface MonitorablePubSub {
  createMonitorClient(): RedisMonitorClient;
  streamKey(topic: string): string;
}

export function asMonitorablePubSub(pubsub: unknown): MonitorablePubSub | undefined {
  if (!pubsub || typeof pubsub !== 'object') return undefined;
  const candidate = pubsub as Partial<MonitorablePubSub>;
  return typeof candidate.createMonitorClient === 'function' && typeof candidate.streamKey === 'function'
    ? (candidate as MonitorablePubSub)
    : undefined;
}

// Topics read through named consumer groups (workflow orchestration and background tasks). Their
// backlog is work that was published but not processed yet. Fan-out subscriptions use throwaway
// groups and are skipped.
const GROUPED_TOPICS = ['workflows', 'background-tasks'];
const FANOUT_GROUP_PREFIX = '__fanout-';

function parseInfo(text: string): Map<string, string> {
  const fields = new Map<string, string>();
  for (const line of text.split('\r\n')) {
    const colon = line.indexOf(':');
    if (colon > 0 && !line.startsWith('#')) fields.set(line.slice(0, colon), line.slice(colon + 1));
  }
  return fields;
}

/** Owns a dedicated monitoring connection, so probes never queue behind pub/sub traffic. */
export function connectMonitor(pubsub: MonitorablePubSub, getLogger: () => MetricsLogger | undefined) {
  const client = pubsub.createMonitorClient();
  let lastErrorLogAt = 0;
  client.on('error', error => {
    if (Date.now() - lastErrorLogAt < 60_000) return;
    lastErrorLogAt = Date.now();
    getLogger()?.warn('[factory:metrics] Redis monitor client error.', {
      error: error instanceof Error ? error.message : String(error),
    });
  });
  void client.connect().catch(() => {
    // Reported through the 'error' listener; node-redis keeps reconnecting.
  });
  return client;
}

/** The `INFO` round trip as the Redis probe, run in every process. */
export function redisProbeCollector(client: RedisMonitorClient, timeoutMs: number): MetricsCollector {
  const probe = createProbe();
  return {
    async collect(sink) {
      await probe(sink, 'redis', timeoutMs, () => client.info());
    },
  };
}

/**
 * Server-wide Redis stats, collected by one process per deployment: memory against `maxmemory`,
 * evictions, clients, and the backlog of the grouped event streams.
 */
export function redisStatsCollector(
  pubsub: MonitorablePubSub,
  client: RedisMonitorClient,
  timeoutMs: number,
): MetricsCollector {
  const probe = createProbe();
  let lastEvicted: number | undefined;
  return {
    async collect(sink) {
      let info = '';
      const result = await probe(sink, 'redis_stats', timeoutMs, async () => {
        info = await client.info();
      });
      if (!result.ok) return;

      const fields = parseInfo(info);
      const number = (key: string) => Number(fields.get(key));
      sink.emit('mastra_factory_redis_memory_bytes', number('used_memory'), { kind: 'used' });
      const maxMemory = number('maxmemory');
      // `maxmemory` is 0 when Redis has no memory limit; then neither the limit nor the ratio is sent.
      if (maxMemory > 0) {
        sink.emit('mastra_factory_redis_memory_bytes', maxMemory, { kind: 'max' });
        sink.emit('mastra_factory_redis_memory_utilization', number('used_memory') / maxMemory);
      }
      sink.emit('mastra_factory_redis_clients', number('connected_clients'));
      // INFO reports evictions since the Redis server started; send the increase per interval.
      const evicted = number('evicted_keys');
      if (Number.isFinite(evicted)) {
        if (lastEvicted !== undefined) {
          sink.emit(
            'mastra_factory_redis_evicted_keys_total',
            evicted >= lastEvicted ? evicted - lastEvicted : evicted,
          );
        }
        lastEvicted = evicted;
      }

      // Bounded like every other call: a Redis that answers INFO and then stalls must not hold up the tick.
      const backlogs: Array<{ topic: string; pending: number; lag: number | undefined }> = [];
      await probe(sink, 'redis_streams', timeoutMs, () =>
        Promise.all(
          GROUPED_TOPICS.map(async topic => {
            // A missing stream (nothing published yet) is not a failure; anything else is.
            const groups = await client.xInfoGroups(pubsub.streamKey(topic)).catch((error: unknown) => {
              if (/no such key/i.test(error instanceof Error ? error.message : String(error))) return undefined;
              throw error;
            });
            if (!groups) return;
            let pending = 0;
            // Redis reports lag as null when it can't compute it; then the topic gets no lag record.
            let lag: number | undefined = 0;
            for (const group of groups) {
              if (String(group.name).startsWith(FANOUT_GROUP_PREFIX)) continue;
              pending += Number(group.pending);
              lag = group.lag == null || lag === undefined ? undefined : lag + Number(group.lag);
            }
            backlogs.push({ topic, pending, lag });
          }),
        ),
      );
      for (const { topic, pending, lag } of backlogs) {
        sink.emit('mastra_factory_redis_stream_backlog', pending, { topic, kind: 'pending' });
        if (lag !== undefined) sink.emit('mastra_factory_redis_stream_backlog', lag, { topic, kind: 'lag' });
      }
    },
  };
}
