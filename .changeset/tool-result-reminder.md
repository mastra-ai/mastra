---
'@mastra/core': minor
'mastracode': minor
---

Add `ToolResultReminderProcessor` that detects when tool arguments reference instruction files (AGENTS.md, CLAUDE.md, CONTEXT.md) and injects a reminder to cite sources. The reminder is rendered in the TUI as a system notice and persisted with the conversation.
