---
'@mastra/otel-bridge': minor
---

Added `tracerProvider` and `loggerProvider` options to `OtelBridgeConfig`, allowing spans and logs to be routed to non-global OpenTelemetry providers.

```ts
import { OtelBridge } from '@mastra/otel-bridge';

const bridge = new OtelBridge({
  tracerProvider: myLangfuseTracerProvider,
  loggerProvider: myCustomLoggerProvider,
});
```

Both fields are optional and default to the global provider when omitted — no breaking changes.
