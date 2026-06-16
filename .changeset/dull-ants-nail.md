---
'@mastra/playground-ui': minor
---

Added a `striped` variant to the `DataList` component for a flat, full-bleed table look: zebra-striped rows, a contrasting sticky header with column separators, rounded corners, and edge fade masks via an overlay scrollbar (virtualization preserved). Also added a per-row `error` tone.

Studio now uses this variant on the Observability, Scorers, Agents, Workflows, Tools, Datasets, MCP Servers, Processors, Prompts, Experiments, Schedules, and Logs tables for a consistent, denser browse experience.

```tsx
// Whole-list look
<DataList columns="auto 1fr auto" variant="striped">
  <DataList.Top>…</DataList.Top>

  {/* Per-row tone — error rows get a subtle destructive tint */}
  <DataList.RowButton variant="error">…</DataList.RowButton>
</DataList>
```
