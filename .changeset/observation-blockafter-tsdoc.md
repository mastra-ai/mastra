---
'@mastra/core': patch
---

Corrected the documentation for `observation.blockAfter` on the docs pages and in the editor TSDoc. Above the threshold, buffered activation may overshoot the retention target instead of activating fewer chunks; it does not force a synchronous observation. The docs also give the correct value ranges: values from 1 up to (but not including) 100 are multipliers of `messageTokens`, and values of 100 or more are absolute token counts. No runtime behavior changed.
