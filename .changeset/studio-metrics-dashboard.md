---
'mastra': minor
---

Updated the Studio observability UI with a filterable metrics dashboard and saved filter persistence.

**Metrics dashboard filters**

The metrics page now includes a dimensional filter toolbar for `rootEntityType`, `entityName`, `entityId`, `tags`, `serviceName`, `environment`, and common identity/correlation IDs such as `threadId`, `resourceId`, `userId`, `organizationId`, `runId`, `sessionId`, `requestId`, and `experimentId`. Active metrics filters are reflected in the URL and can be saved to the Metrics page's own localStorage key.

**Memory card**

A new **Memory** card shows thread and resource activity in one tabbed card. Rows include run counts, token usage, and cost for the active date range and filters. The dashboard also restores the Total Threads and Total Resources KPI cards.

**Drilldowns**

Metrics cards can now link into Traces or Logs while preserving the active date range and relevant filters:

- Latency, Trace Volume, Token Usage by Agent, and Model Usage & Cost expose header drilldown actions.
- Token Usage by Agent, Trace Volume, and Model Usage & Cost rows/bars drill into Traces scoped to the clicked entity.
- Trace Volume error segments can drill into Logs with `level=error`.
- Memory rows drill into Traces scoped to the clicked `threadId` or `resourceId`.
- Latency chart points narrow Traces to the clicked time bucket.

Metrics-to-Traces drilldowns open the branch-oriented trace list so nested agent, workflow, and tool spans are visible. KPI cards remain non-clickable.
