---
'@mastra/temporal': patch
'@mastra/inngest': patch
'@mastra/core': patch
---

The run-level `modelSettings.timeout.totalMs` budget is now enforced on durable agents (ports #21724 to the durable agent loop). Previously only the per-call budget applied, so a hanging provider or a long tool chain could run forever. The total budget now bounds the whole run, is re-armed with the original value on cold resume and recovery, and expiry surfaces as a run error rather than a silent stop.
