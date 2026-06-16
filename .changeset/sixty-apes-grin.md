---
'mastracode': patch
---

Fixed TUI chat spacing so message layout stays stable while the assistant streams. Chat spacing now runs through a single boundary-spacing pass, preventing flicker from dynamic spacer recomputation, avoiding stacked or missing blank lines, and keeping custom slash command previews consistently spaced as responses begin.
