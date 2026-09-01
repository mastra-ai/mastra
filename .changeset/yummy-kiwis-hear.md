---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed per-call tracing metadata with undefined values erasing span metadata. A key passed in tracingOptions.metadata whose value is undefined (for example from optional chaining) no longer removes the value the span already has; keys with real values still take precedence.
