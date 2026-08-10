---
'@mastra/core': patch
---

Corrected the editor documentation for `observation.blockAfter`. The comment said that a synchronous observation runs above this threshold. It does not: above `blockAfter`, buffered activation is only allowed to overshoot the retention target instead of activating fewer chunks. The comment also gave the wrong value range; values from 1 up to (but not including) 100 are multipliers of `messageTokens`, and values of 100 or more are absolute token counts. This change touches comments only, so runtime behavior is unchanged.
