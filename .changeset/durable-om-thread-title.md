---
'@mastra/core': patch
---

Durable and evented agents now generate a thread title for observational-memory runs, as a regular Agent does. The title comes from the thread's saved messages, so it reflects the user's request even after observational memory has dropped that request from the run's context mid-turn. It looks back through at most the newest 200 saved messages for that request; a first turn longer than that gets no title. A title is only written to a thread that already exists, so an observational-memory run never creates a thread holding just a title.
