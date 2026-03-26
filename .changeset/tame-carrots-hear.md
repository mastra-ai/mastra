---
'@mastra/client-js': minor
'@mastra/playground-ui': patch
'@mastra/react': patch
'mastra': patch
---

Added `telemetryBaseUrl` option to `ClientOptions`. When set, observability/telemetry requests are routed to a separate base URL while all other resources continue using the main `baseUrl`. This enables reading telemetry data from a remote telemetry service.

**Usage:**

```ts
const client = new MastraClient({
  baseUrl: 'http://localhost:4111',
  telemetryBaseUrl: 'https://your-telemetry-service.com',
});
```
