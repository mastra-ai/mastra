---
'@mastra/playground-ui': patch
---

Improved hover on metrics charts (`MetricsLineChart`, `MetricsStackedBarChart`):

- The tooltip now appears next to the hovered point instead of sliding in from the chart's top-left corner, and moves with the pointer without lag. The hover line and bar dimming are instant too.
- The tooltip can extend past the chart and flips sides only at the window's edge, without jumping back and forth near it.
- Buckets with no readings (for example an hour with no agent runs on the Latency chart) now show a tooltip with dashes instead of none.
