---
'@mastra/core': minor
'@mastra/observability': minor
---

Added DualLogger that transparently forwards all infrastructure logger calls (debug, info, warn, error, trackException) to the observability system (loggerVNext). This means all internal Mastra logs now automatically appear in your observability storage (e.g. DuckDB) without any code changes.

**trackException** now extracts structured error data (errorId, domain, category, details, cause) and forwards it as an error-level log to observability storage, so exceptions are queryable alongside regular logs.

Added `logging` config option to ObservabilityInstance for controlling which logs reach observability storage:

```ts
new Observability({
  instance: new MastraObservability({
    logging: {
      enabled: true, // set to false to disable log forwarding
      level: 'info', // minimum level: 'debug' | 'info' | 'warn' | 'error' | 'fatal'
    },
  }),
});
```
