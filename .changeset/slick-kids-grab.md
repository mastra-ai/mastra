---
'@mastra/observability': patch
---

Added support for costs supplied by external SDK agent integrations.

When an SDK agent records an estimated cost on its model generation span, observability now carries that cost onto the auto-extracted model token metric. This lets storage-backed metric queries and dashboards display costs reported by external agent SDKs, even when Mastra cannot calculate the cost from its own pricing registry.
