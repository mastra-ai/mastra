---
'@mastra/core': patch
---

Fixed provider-defined tools with custom execute callbacks (e.g. openai.tools.applyPatch) being incorrectly skipped during execution. Previously, all provider-defined tools were assumed to be provider-executed, which meant user-supplied execute functions were never called. Now, provider tools with a custom execute are correctly identified as client-executed.
