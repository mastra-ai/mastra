---
'mastra': minor
---

Made the Studio metrics dashboard filterable, memory-aware, and clickable.

**Dimensional filter toolbar**

The metrics page now has a property-filter toolbar mirroring the Traces toolbar. Filters persist in the URL and `localStorage`, and every card re-queries with the active dimensions and date range. Supported fields: `rootEntityType`, `entityName`, `entityId`, `tags`, `serviceName`, `environment`, plus free-text filters for identity and correlation IDs (`threadId`, `resourceId`, `userId`, `organizationId`, `runId`, `sessionId`, `requestId`, `experimentId`).

**Memory card**

A new **Memory** card shows distinct thread and resource activity with tokens and cost per row. Threads and Resources live under tabs in the same card; each row is a TopK over the active date range and filters.

**Drilldowns**

Clicking meaningful data points on the dashboard now navigates to Traces (or Logs) with matching filters and the right time window:

- Card header icons on Latency, Trace Volume, Token Usage by Agent, Model Usage & Cost, and Scores open Traces pre-filtered to the card's active dimensions. Trace Volume also exposes a "View errors in Logs" icon.
- Clickable bar rows on Token Usage by Agent, Trace Volume, and Model Usage & Cost drill into Traces scoped by `entityName` and `rootEntityType`. Trace Volume's "Errors" segment additionally applies `status=error`.
- Clickable table rows on Memory and Scores open Traces filtered to the clicked `threadId` / `resourceId` / scorer.
- Clickable chart nodes on the Latency line chart narrow the Traces window to the clicked point's hourly bucket — for example, clicking 14:00 on the Agents tab opens `?rootEntityType=AGENT&dateFrom=…14:00…&dateTo=…15:00…`.

Dashboard filters and the active date range are preserved through every drilldown. KPI cards stay non-clickable.
