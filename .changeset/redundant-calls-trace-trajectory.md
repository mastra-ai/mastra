---
'@mastra/evals': patch
---

Fixed `noRedundantCalls` on trajectories built from traces. Two identical tool calls in a row are now flagged even when `processor_run` or `model_generation` steps sit between them, so scoring a run from its trace gives the same result as scoring it from its messages.
