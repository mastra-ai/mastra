---
'@mastra/observability': patch
'@mastra/core': patch
---

Fixed output stream processors losing their observability data after the first step of a multi-step agent run. Tripwire aborts from processors like `TokenLimiterProcessor` (`strategy: 'abort'`) that fire in a later step now show up on the `processor_run` span instead of an empty span.
