---
'@mastra/observability': patch
'@mastra/core': patch
---

Documented the `SpanOutputProcessor.process()` contract: mutate the span you receive and return the same instance, or return `undefined` to drop it. Returning a copy is not supported because `exportSpan()` and `isValid` are instance members of the live span. Related to #23796
