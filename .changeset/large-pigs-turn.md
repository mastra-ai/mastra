---
'@mastra/playground-ui': minor
---

Added a full-width histogram of counts and errors over time to the Traces and Spans pages, between the filter bar and the list. It follows the list's filters and time range, and only appears when the server supports trace or span aggregates.

Drag across the histogram to zoom in: the list and the chart switch to a custom time range covering the selected bars. `MetricsStackedBarChart` exposes this as an opt-in `onZoom({ start, end })` prop that reports the first and last selected column.

Other charts can reuse the same drag-to-select behavior from `@mastra/playground-ui/primitives/charts/drag-selection`. It works with bar and line charts (pass `layout="point"` to `DragSelectionBand` for line charts).

```tsx
const selection = useDragSelection({ onSelect: ({ start, end }) => zoomTo(start, end) });

<ComposedChart
  className={selection.className}
  onMouseDown={selection.onMouseDown}
  onMouseMove={selection.onMouseMove}
  onClick={state => {
    if (selection.consumeReleaseClick()) return;
    // regular point click
  }}
>
  <DragSelectionBand selection={selection} count={data.length} />
  {/* series */}
</ComposedChart>;
```

When the Traces, Spans, or Threads time range differs from the default, the Time chip shows a × that resets it to the last 7 days. `TraceTimeRangeChip` exposes this as an opt-in `defaultPreset` prop.

Chart tooltips now render above the page, so a short chart (like the histogram above a list) or a clipping container no longer cuts them off.

The Columns picker is now an icon button with a "Columns" tooltip, placed before the filters.

```tsx
<TracesExplorer.Body toolbar={toolbar} chart={<TracesExplorer.Histogram />}>
  {content}
</TracesExplorer.Body>
```
