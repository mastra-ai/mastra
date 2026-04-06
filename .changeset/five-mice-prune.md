---
'mastracode': patch
---

Fixed mastracode TUI memory usage during long sessions by pruning older rendered chat components after each agent turn.

The chat view now keeps recent conversation history available while preventing unbounded growth from rendered messages, tool outputs, slash command boxes, and system reminders.
