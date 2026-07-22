---
'@mastra/core': patch
---

Cap the LLM-provided delegation `maxSteps` at the sub-agent's own `defaultOptions.maxSteps`. Previously a supervisor's model could silently raise a sub-agent's step budget past its configured default via the delegation tool's optional `maxSteps` argument. The supervisor's model can still reduce the budget, and `onDelegationStart`'s `modifiedMaxSteps` (developer code) still overrides the cap. A warning is logged when a value is capped.
