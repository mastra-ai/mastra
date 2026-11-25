---
'@mastra/core': patch
---

Include `stepResult.warnings: []` in durable agents' `step-finish` events when the provider rejects the request before streaming, matching regular agents. Mid-stream failures are unchanged.
