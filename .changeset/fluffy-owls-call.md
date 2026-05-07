---
'@mastra/core': patch
'mastracode': minor
---

Added persistent goal support and more ways to start goals in Mastra Code.

Mastra Code now supports `/goal` with configurable judge defaults, persisted goal state, input locking while the judge evaluates, and safer continuation handling so user follow-ups and pause actions take priority over judge decisions. Goal reminders and terminal judge results are persisted as system reminders.

Plans can now be accepted as goals directly from the inline plan approval UI. Slash commands can opt into goal mode with `goal: true`, and skills can opt into goal mode with `metadata.goal: true`. `/goal` also supports objectives that span multiple lines.

The Harness system-reminder message shape now preserves goal metadata used by Mastra Code goal reminders.
