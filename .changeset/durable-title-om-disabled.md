---
'@mastra/core': patch
---

Fixed agents treating `observationalMemory: { enabled: false }` as if observational memory were on. This now behaves the same as having no observational memory configured, on every engine:

- `agent.stream()` and `agent.generate()` with `savePerStep` save each step before the next one runs.
- Durable and evented agents title the thread, save each step with `savePerStep`, and save the turn when the run finishes.
