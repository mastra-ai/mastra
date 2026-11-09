---
'@mastra/playground-ui': patch
---

Fixed the KPI row on dashboards being narrower than the cards around it when it can be moved, pinned, or turned into an alert. Its move, alert, and pin buttons now float over the top edge of the row instead of sitting beside the figures, so the row lines up with the rest of the dashboard. Like on chart cards, the buttons stay visible while the dashboard is being rearranged or the row is pinned, and otherwise show on hover or keyboard focus.
