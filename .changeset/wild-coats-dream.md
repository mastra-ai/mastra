---
'@mastra/observability': minor
---

Added cost estimation for observability metrics.

- Added embedded pricing data and runtime cost estimation for auto-extracted model token metrics.
- Added cost context propagation through observability metrics and exporters.

**Breaking / Upgrade Notes**

- This version adds metric cost estimation and requires the newer observability fields and hooks provided by `@mastra/core >=1.17.0-0`.
