---
'@mastra/playground-ui': patch
---

Dashboard widgets now keep their saved widths on any screen wide enough for the 12-column grid, so a row of three or four cards no longer wraps onto a second line below 1280px. Cards in a row now share one height, so a card whose title wraps no longer stands taller than its neighbours. Narrow screens still stack every widget.

`DashboardRenderer` accepts an optional `dragHandle` prop that returns the drag props for each widget id. When a widget has them, a grip appears left of its title, including on cards that failed to render and beside KPI groups. Widget kinds receive the same props as `dragHandle`, and `ChartCard` and the new `MetricsCard.DragHandle` render the grip.
