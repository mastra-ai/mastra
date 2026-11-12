---
'@mastra/factory': minor
---

A card's sandbox now stops as soon as the card is done with that context, instead of idling until the provider times it out.

- When a card moves out of the last phase of a context into a phase that runs in another one, Factory stops that context's sandbox. Triage → Planning stops the triage sandbox; Planning → Building keeps the shared `work` sandbox running. A run still in flight on the session keeps its sandbox until it ends.
- When a card finishes, Factory stops every sandbox it holds, from any Factory process, by identity through the configured sandbox provider. Before, only the process that had opened a sandbox stopped it.
- A card that comes back to a context resumes the same sandbox with its files.

Stopping never fails the move. Sandboxes are stopped, not destroyed; deleting a session still destroys its sandbox.
