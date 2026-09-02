---
'@mastra/factory': patch
---

Audit log range picking moves off the chart and onto a ruler below it.

**The chart is display-only.** Marks outside the selected range fade instead of being framed by a drag rectangle, gridlines follow the day ticks and fade out top and bottom, and dashed guides mark the selected limits.

**The ruler under it carries a single translucent lens.** Drag its sides to resize, drag its body to slide the window; the day and time of each edge read above and below it. Selection is continuous down to the minute rather than snapped, so a window of a few minutes is as reachable as one of several days, and the exact range also reads out next to the event count. Arrow keys nudge an edge, Escape returns to the full range.

**On narrow screens the lens gives way to 1h/6h/24h/7d chips.** A full-width drag surface left no room for precise handles and blocked vertical scrolling.

**The axis stops moving under the marks.** It now spans everything loaded rather than the current category filter, so toggling a category no longer rescales it, and the chart holds a fixed height at any width instead of squashing its lanes on a narrow screen. Each category lane carries a faint dotted rule, so a mark reads as sitting on its lane and a chart with nothing to plot still shows its shape rather than going blank.

**An empty log says so** instead of drawing a chart over an invented seven-day window — filtering to a category with no events used to shift the axis onto dates where nothing had happened — and the empty states now say what is missing and how to get back.
