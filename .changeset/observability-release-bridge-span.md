---
'@mastra/observability': patch
---

Told bridges when a span ends without being exported, so they can free its state.

A span dropped by `excludeSpanTypes`, a `spanFilter`, or a span output processor emits no span-end event, so bridges such as `@mastra/otel-bridge` and `@mastra/datadog` never learned the span was finished and held the state they created for it until shutdown. Those spans now trigger a `releaseSpan` call on the bridge instead.

Export behavior is unchanged: filtered spans are still not exported, and trace structure is untouched.

Fixes [#20368](https://github.com/mastra-ai/mastra/issues/20368).
