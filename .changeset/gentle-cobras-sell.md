---
'mastracode': patch
---

Extracted TUI state into a dedicated TUIState interface and createTUIState factory. Moves ~60 private fields from MastraTUI into a structured type in tui/state.ts, making the TUI more composable for external consumers. No behavior changes.
