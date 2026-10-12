---
'@internal/playground': patch
---

Fixed the experiment page header status getting stuck on "Pending" or "Running" until a reload. The header now updates live as the run moves from queued to in progress to completed, and its tooltip uses the same "Run queued" / "Run in progress" wording as the experiments list. While a run is queued or in progress, the empty results list now says so instead of showing "No results yet".

Reworked the experiment page layout. The side panel is gone. Its run numbers (average score, items, duration, tokens, latency) are now metric cards above the results table. Rerun and the actions menu moved to the top-right of the page header, at the same compact size as on other pages. The separate "Review queue" button was removed because the sidebar already links to the review queue.

Reworked the experiment results table. A "N selected" button above the table clears the selection, and "Flag for review" and "Add tag" appear next to it once at least one result is selected. Rows that errored are now highlighted in red instead of showing an error icon. The Status column was removed. The Output column now also shows output for results without a target type, as text or compact JSON.
