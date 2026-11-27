---
'@mastra/core': patch
---

Fixed Gateway customer charges falling back to token price estimates when using native provider adapters.

Requires a Gateway response carrying the customer-cost marker and a matching update to `@mastra/observability`. Unmarked responses keep the existing cost behavior.
