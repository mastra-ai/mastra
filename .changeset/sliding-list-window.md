---
'@mastra/playground-ui': patch
---

Fixed live updates in the Spans and Threads lists stopping after the tab stays open for a while. With a preset range such as "Last 7 days", each poll now asks for a window of the same length ending now, instead of stretching the original window, so a server cap on the window length (such as the 7-day limit on word search) no longer refuses the poll. A custom start date with no end date is kept as picked.

`useListAnchor` now returns `anchorWindow` instead of `anchorTo`, and `reanchor` takes the selected window (`ListWindow`, now exported along with `windowEndingAt`). Its new second argument, `fixedStart`, keeps the start of the window in place.
