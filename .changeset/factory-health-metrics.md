---
'@mastra/factory': minor
'@mastra/redis-streams': minor
---

Added opt-in health metrics to Factory, sent through `mastra.metrics`. Pick the groups you want, since every record counts towards observability usage:

```ts
new MastraFactory({
  // ...
  metrics: { groups: ['process', 'postgres', 'redis', 'sandbox', 'sessions', 'intake'] }, // or 'all'
});
```

Or set `FACTORY_METRICS=all` (or a list like `sandbox,intake`). `FACTORY_METRICS_INTERVAL_MS` (default 60s, minimum 15s) and `FACTORY_METRICS_MAX_PER_MIN` (default 500) tune how often records are sent and cap their volume. Metrics are named `mastra_factory_*` and labeled with `service` (`api`, `worker` or `all`) so split deployments can be told apart.

`RedisStreamsPubSub` gains `createMonitorClient()` and `streamKey()` so health checks can use their own connection.
