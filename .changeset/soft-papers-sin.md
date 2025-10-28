---
'@mastra/core': patch
---

Fix network loop iteration counter and usage promise handling:

- Fixed iteration counter in network loop that was stuck at 0 due to falsy check. Properly handled zero values to ensure maxSteps is correctly enforced.
- Fixed usage promise resolution in RunOutput stream by properly resolving or rejecting the promise on stream close, preventing hanging promises when streams complete.
