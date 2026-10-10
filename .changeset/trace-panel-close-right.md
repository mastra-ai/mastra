---
'@mastra/playground-ui': patch
---

Moved the trace panel close button to the top-right, next to the previous/next trace arrows, matching the span panel.

Added a `tooltipPosition` prop to `Button` to choose which side its tooltip opens on. The span tree / timeline toggle in the trace panel now shows its tooltips below the buttons, so they no longer cover the other button.
