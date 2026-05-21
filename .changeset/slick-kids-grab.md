---
'@mastra/observability': patch
---

Used SDK-provided estimated costs when model generation spans include cost context.

This allows observability exporters and storage-backed metric queries to preserve a vendor SDK's own cost estimate instead of recalculating it from token pricing. For Claude SDK agents, Mastra now reads the SDK's `total_cost_usd` value and exposes it on the auto-extracted model token metric used by cost dashboards.
