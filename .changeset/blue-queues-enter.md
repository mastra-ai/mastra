---
'mastracode': patch
---

Improved Mastra Code terminal message queueing while the agent is busy.

- Press `Enter` to send a message normally, or queue a follow-up while the current run is still streaming.
- Queued follow-up messages and slash commands now drain in the same FIFO order they were entered.
- `/help` and the Mastra Code docs now describe the updated shortcut behavior.
