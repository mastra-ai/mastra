---
'@mastra/memory': minor
---

Added config-level `hooks` to Observational Memory so apps can track what OM's background model calls cost. Previously the `ObserveHooks` lifecycle callbacks only fired when calling `observe()` manually — the automatic pipeline (turn-driven observation and fire-and-forget async buffering) computed token `usage` and `providerMetadata` and dropped them. Hooks set on the OM config (including through `Memory`'s `observationalMemory` options) now fire for every observation and reflection cycle, with `threadId`/`resourceId`/`trigger` call context:

```ts
const memory = new Memory({
  storage,
  options: {
    observationalMemory: {
      hooks: {
        onObservationEnd: ({ usage, providerMetadata, error, threadId, trigger }) => {
          recordOmSpend({ usage, providerMetadata, threadId, trigger });
        },
      },
    },
  },
});
```

Failed async-buffered cycles never throw (they are fire-and-forget), so they report through the end hook's `error` field instead. Errors thrown by config-level hooks are caught and logged, never failing the cycle. Per-call `observe()` hooks keep their existing payloads and semantics.
