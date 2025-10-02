---
'@mastra/core': patch
---

Fixes two issues, one where finish chunks were passed to output processors after every step, and the other where the processorState would get reset after every step, meaning that the final StructuredOutput process prompt was missing lots of context from the previous steps.
