---
'@mastra/memory': patch
---

Fixed observational memory losing context for the agent when background buffering, observation activation, and reflection overlap, including across processes and durable agent steps.

- Observations buffered or activated while a reflection runs are kept in the new generation instead of being dropped and re-observed later in larger batches.
- Activation and sync observation commit only to the current generation. Messages leave the agent's context only after their observations are saved there; otherwise the observation retries against the current generation or the messages stay in context.
- A reflection that was superseded by another one no longer marks itself as completed.
