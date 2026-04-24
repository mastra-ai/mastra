---
'@mastra/playground-ui': minor
'mastra': minor
---

Make the Studio metrics dashboard actionable — drill from a chart or row into Traces / Logs with the right filters applied.

- **Card header icons** on Latency, Trace Volume, Token Usage by Agent, Model Usage & Cost, and Scores open the Traces page pre-filtered to that card's active dimensions. Trace Volume also exposes a "View errors in Logs" icon.
- **Clickable bar rows** on Token Usage by Agent, Trace Volume, and Model Usage & Cost drill into traces scoped to the clicked entity (`entityName` + `rootEntityType`). Trace Volume's "Errors" segment additionally applies `status=error`.
- **Clickable table rows** on Memory (Threads + Resources) and Scores open traces filtered to the clicked `threadId` / `resourceId` / scorer.
- **Clickable chart nodes** on the Latency line chart narrow the traces window to the clicked point's hourly bucket (for example, clicking the 14:00 point on the Agents tab opens `traces?rootEntityType=agent&dateFrom=14:00&dateTo=15:00`).
- **Dashboard context is preserved.** Active dimensional filters and the selected date range are carried through every drilldown URL.

The `@mastra/playground-ui` primitives `MetricsLineChart`, `HorizontalBars`, and `MetricsDataTable` gained optional interactivity props (`onPointClick`, per-row `href` / per-segment `hrefs`, `getRowHref`). `MetricsCard` gained an `Actions` slot for top-bar icon links. All additions are optional and existing call sites are unchanged.
