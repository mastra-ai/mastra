---
'@mastra/server': minor
---

Studio and other clients can now tell which observability features the configured storage supports, without upgrading older storage packages. `GET /system/packages` now always returns `observabilityStorageCapabilities` when observability storage is configured. It adds per-endpoint `discovery` flags plus `traceQuery`, `threadQuery`, `deltaPolling`, `traceQueryRootDuration` and `traceQueryTenantScope`.

Stores that declare their features with `getFeatures()` are reported exactly as declared. Stores that predate feature declarations are detected by the methods they implement.

On legacy stores such as LibSQL or the default `PostgresStore`, `traceQuery` is `false`. Clients should list traces with `GET /observability/traces/light` instead of `POST /observability/traces/query` on those stores ([#24990](https://github.com/mastra-ai/mastra/issues/24990)).

The same capabilities are also available from the new `GET /observability/capabilities` endpoint, which works on any `@mastra/core` version and reports every flag as `false` when no observability storage is configured.

```ts
const { capabilities } = await client.getObservabilityCapabilities();

if (capabilities.discovery.entityNames) {
  const { names } = await client.getEntityNames({});
}
```

Discovery routes (`/observability/discovery/*`) now return empty results instead of a 500 error when the storage does not support them. This stops the recurring "does not support entity name discovery" errors when opening Studio ([#16304](https://github.com/mastra-ai/mastra/issues/16304)).
