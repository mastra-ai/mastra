---
'@mastra/otel-bridge': patch
---

Fixed OtelBridge returning invalid all-zero span and trace IDs when no OpenTelemetry SDK is registered.

**What was broken**

`@mastra/otel-bridge` declares `@opentelemetry/sdk-node` as an optional peer dependency, so it is expected to work without an SDK wired up. In that case the OTEL API hands back a no-op tracer whose span contexts carry all-zero IDs. The bridge was forwarding those IDs to Mastra's core spans instead of falling through to the default ID generator.

The result: every span collapsed onto the same `spanId="0000000000000000"`, downstream exporters like Braintrust silently dropped traces, and `TrackingExporter`'s parent-matching queue kept rescheduling via `setImmediate` looking for a parent that could never resolve — pegging CPU at 100%.

**The fix**

The bridge now checks `isSpanContextValid` on the OTEL span context and returns `undefined` when it is the no-op all-zero context, letting `DefaultSpan` generate its own valid IDs. The same guard is applied when resolving parent span IDs.

Fixes #15589.
