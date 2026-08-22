---
'@mastra/core': patch
---

Reduced how much durable agents write when persisting a run.

A durable run saves its state at every step, and each of those saves re-serialized a copy of the agent's system prompt, so a long turn spent time writing the same prompt over and over. That copy is now left out. Snapshots are smaller, each step writes less, and resume and tracing behave exactly as before.

Measured over 300 production snapshots, this removed about 5% of all persisted snapshot bytes.
