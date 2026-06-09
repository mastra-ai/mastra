---
'@mastra/playground-ui': patch
'@internal/playground': patch
---

Fixed the Studio Metrics **Latency** card drilldown, which was a silent no-op on all three tabs (Agents, Workflows, Tools). The view-level click guard and the container-level navigation handler both read a `rawTimestamp` field that the hook never produces; the only timestamp on a `LatencyPoint` is `tsMs`. Clicking a chart point now correctly navigates to the Traces page filtered to the 1-hour bucket and the entity type of the active tab.
