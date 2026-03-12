---
'mastracode': patch
---

Improved Mastra Code terminal queueing and slash-command behavior while the agent is busy.

- Press `Enter` to send a message normally, or queue a follow-up while the current run is still streaming.
- Queued follow-up messages and slash commands now drain in the same FIFO order they were entered.
- Custom slash commands use `//command` so they stay distinct from built-in `/command` entries, including when names overlap.
- Slash-command autocomplete now defaults to the first visible matching entry instead of jumping to a later custom command match.
- `/help` and related shortcut text now reflect the updated behavior.
