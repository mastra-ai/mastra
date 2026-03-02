---
'mastracode': minor
---

Added Command Palette (Ctrl+K) — a fuzzy-searchable overlay for all slash commands, custom commands, and keyboard shortcuts. Replaces the need to remember commands or scroll through /help output.

**New features:**

- **Command Palette**: Press Ctrl+K to open an interactive, filterable list of all available commands and shortcuts. Commands execute on Enter; keyboard shortcuts are shown for reference.
- **SearchableListOverlay base class**: Extracted common overlay patterns (search input, fuzzy filtering, scrollable list with keyboard navigation) into a reusable base, reducing duplication across model selector, thread selector, and the new command palette.
