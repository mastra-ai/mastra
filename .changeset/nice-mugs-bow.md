---
'@mastra/playground-ui': minor
---

Improved the time range filter on the traces and spans pages.

- Custom ranges now show the date and time, e.g. `Oct 21, 2:05 PM – 4 PM`, instead of the date only.
- Clicking a single histogram bar now zooms into that bar's time span, just like dragging across bars.
- Clearing the time range after zooming into the histogram now returns to the range you had before the zoom (for example "Last 14 days" or a custom range), instead of always jumping to "Last 7 days". Clearing again resets to the default range.
