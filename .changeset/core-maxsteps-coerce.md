---
'@mastra/core': patch
---

Fixed sub-agent delegation failing when an LLM sends `maxSteps` as a numeric string (e.g. `"10"` instead of `10`). Delegation now accepts valid numeric strings and continues to reject invalid values such as non-integers or numbers below 3.
