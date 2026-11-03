---
'@mastra/core': patch
---

Fixed dataset experiments that target an evented workflow (`createEventedWorkflow`) so they show up in Studio like standard workflow experiments. Evented runs now pass `tracingOptions` from `run.start()` and `run.resume()` to their traces, so every span carries the experiment ID and the experiment page shows total cost and tokens. Evented runs also now return `traceId` and `spanId`, like standard workflows already do, so each experiment item shows its own cost, tokens and trace link.
