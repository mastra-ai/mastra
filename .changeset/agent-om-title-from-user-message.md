---
'@mastra/core': patch
---

An Agent with observational memory now titles a new thread from the user's question instead of from a system reminder such as observational memory's continuation reminder. This applies to both `generate`/`stream` and the legacy `generateLegacy`/`streamLegacy` path. System reminders are left out of the title transcript. When observational memory has already dropped the question from the run's context mid-turn, the title comes from the thread's saved messages, looking back through at most the newest 200 of them; a first turn longer than that gets no title.
