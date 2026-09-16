---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed span output processors that return a copy of the span instead of the same instance. Previously this threw `TypeError: processedSpan?.exportSpan is not a function` out of `startSpan()` for started/updated spans, and silently dropped every ended span. Now the span is dropped with a logged processor error naming the processor, and the `SensitiveDataFilter.process()` docstring correctly states that it mutates the span in place. Fixes #23796
