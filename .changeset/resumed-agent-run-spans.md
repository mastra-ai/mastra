---
'@mastra/core': patch
'@mastra/inngest': patch
'@mastra/server': patch
---

Fixed traces of durable agent runs that suspend and resume, or recover after a crash. Each part of the run now has its own agent run and model generation spans in the run's trace, ended with that part's real outcome by whichever process or Inngest worker finishes it. A recovered run whose final step was already saved ends with that saved outcome instead of `unknown`.
