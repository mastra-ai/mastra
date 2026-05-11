---
'@mastra/observability': minor
---

`DefaultExporter` now notifies custom exporters and connected integrations when it cannot persist observability events, such as unsupported storage or retries being exceeded.
