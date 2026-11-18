---
'@mastra/core': patch
---

Fixed traces of durable agent runs that suspend and resume, or recover after a crash, when another process finishes the run. Each part of the run now has its own agent run and model generation spans, every span ends once, and a recovered run ends with its saved outcome instead of `unknown`.
