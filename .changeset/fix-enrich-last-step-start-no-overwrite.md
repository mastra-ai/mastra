---
'@mastra/core': patch
---

Prevent `enrichLastStepStart` from overwriting a step-start that has already been attributed with a model. This protects against mis-attribution when the last assistant message contains a step-start from a prior iteration or a re-used message loaded from memory that already has its model stamped.
