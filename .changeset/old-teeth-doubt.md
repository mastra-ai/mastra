---
'mastracode': patch
---

Improved responsiveness during streaming: reduced animation and text input lag by eliminating remaining event-loop blockers. The TUI now uses async operations for dynamic instruction building and system reminder file reads, preventing freezes during tool calls.
