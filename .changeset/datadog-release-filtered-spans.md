---
'@mastra/datadog': patch
---

Released bridge state for spans that end without being exported.

Spans dropped by `excludeSpanTypes`, a `spanFilter`, or a span output processor previously kept the span map entry and open-span count that `createSpan()` allocated for them, because that state was only freed when a span was exported. Both are now released when such a span ends.

The dd span is not finished, so filtered spans are still not sent to Datadog.

Fixes [#20368](https://github.com/mastra-ai/mastra/issues/20368).
