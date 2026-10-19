---
'@mastra/evals': patch
---

Fixed `blacklistedSequences` and `maxRetriesPerTool` on trajectories built from traces. Forbidden tool sequences and tool retries are now detected even when `processor_run` or `model_generation` steps sit between the tool calls, so scoring a run from its trace gives the same result as scoring it from its messages.
