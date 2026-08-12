---
'@mastra/core': minor
---

Fixed traces that start under an OpenTelemetry parent span not appearing in Mastra Studio, and kept resumed agent and workflow runs linked to the suspended run's trace.

Tracing now distinguishes a parent Mastra created within the trace from a parent that belongs to an external tracing system (an OpenTelemetry or Datadog span your app already started). Pass an external parent through `tracingOptions.parentSpanId` as before. It correlates your Mastra trace into the external system and no longer hides the trace in Studio:

```ts
import { trace } from '@opentelemetry/api';

const spanContext = trace.getActiveSpan()?.spanContext();

await agent.generate('Analyze this data', {
  tracingOptions: {
    traceId: spanContext?.traceId,
    parentSpanId: spanContext?.spanId,
  },
});
```
