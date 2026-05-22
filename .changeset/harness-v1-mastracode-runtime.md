---
'mastracode': patch
---

Moved MastraCode onto the Harness v1 runtime while preserving its existing CLI and TUI behavior.

This is a backward-compatible runtime migration: existing MastraCode callers keep using the same entry points, while threads, signals, permissions, tasks, and display events now flow through Harness v1.
