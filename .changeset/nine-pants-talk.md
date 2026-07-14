---
'@internal/playground': patch
---

Fixed the scorer detail page layout so the Input column no longer stretches far wider than the screen. The column now has a sensible maximum width and truncates long inputs, keeping the table within the viewport. Also fixed the score details pane collapsing to an unusable sliver when opened with the Input column visible — the table now cedes space so the pane keeps its half of the layout.
