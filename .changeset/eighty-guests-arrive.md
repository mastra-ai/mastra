---
'@mastra/playground-ui': patch
---

Fixed three issues on the Logs and Traces pages:

- Column widths now stay stable while scrolling — they no longer jump as different rows scroll into view.
- Scrolling far down the Logs list no longer scrambles rows (duplicates, gaps, or empty rows after additional pages load).
- Changing a filter or the date range now scrolls the list back to the top, instead of leaving an empty band above the new data until you nudge the scroll. Logs and Traces now behave the same way on filter changes.
