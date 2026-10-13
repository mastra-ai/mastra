---
'@mastra/core': patch
---

Fixed durable agents returning empty step data in callbacks and results. `onStepFinish`, `onFinish` and `output.steps` now include each step's response messages and model id, the same as a regular agent. A `model` passed to a durable agent's `stream()` call is now the model that actually runs, instead of the agent's default model. (#26780)
