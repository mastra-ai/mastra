---
'@mastra/core': patch
---

Durable and evented agents now save the same turn as other agents when a total timeout ends the run. The text a step was streaming when it was cut off is saved as its own message after the step processors run over it, data parts that processors write are kept, a tool call that finished before the deadline keeps its result, and read-only runs or callers without write access to the thread save nothing.
