---
"mastracode": patch
---

Extract TUI state into a dedicated `TUIState` interface and `createTUIState` factory

Moves ~60 private mutable fields from the `MastraTUI` class into a structured `TUIState` type and factory function in `tui/state.ts`. This is the first step toward making the TUI composable for external consumers. No behavior changes.
