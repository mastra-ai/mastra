---
'@internal/playground': patch
---

Fixed Studio's workflow Request Context dialog running the workflow when clicking Save. Saving request context values now only stores them, and the next run includes the saved values. Fixes https://github.com/mastra-ai/mastra/issues/22482
