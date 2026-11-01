---
'@mastra/memory': patch
---

Fixed Observational Memory merging an agent's final answer into an already-observed message when a durable or evented run is recovered by another worker. The recovered run now starts the answer in a new message, as a run that never crashed does, so the answer is no longer hidden from later prompts as observed content.
