---
'@mastra/core': patch
---

Fixed pinned Knowledge pages not reaching an agent's first turns when the store declares the scopes (as Platform's hosted Knowledge does). Pin delivery now loads the store's scope declarations before checking the run's scopes, instead of skipping pins until a Knowledge tool call had loaded them.
