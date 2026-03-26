---
'@mastra/playground-ui': patch
---

Added cost metrics to the Metrics dashboard.
- Added a **Total Model Cost** KPI card.
- Added a **Cost** column in the **Model Usage** table.
- Added a **Cost** view in **Token Usage by Agent**.
- Improved `ScrollArea` to support horizontal and vertical scrolling together.

**Example**
```tsx
<ScrollArea orientation="both" maxHeight="20rem">
  <MetricsDataTable ... />
</ScrollArea>
```
