---
'@mastra/playground-ui': minor
---

Added a full-width histogram of counts and errors over time to the Traces and Spans pages, between the filter bar and the list. It follows the list's filters and time range, and only appears when the server supports trace or span aggregates.

The Columns picker is now an icon button with a "Columns" tooltip, placed before the filters.

```tsx
<TracesExplorer.Body toolbar={toolbar} chart={<TracesExplorer.Histogram />}>
  {content}
</TracesExplorer.Body>
```
