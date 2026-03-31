---
'@mastra/core': patch
---

Streaming traces now end correctly when a model call fails or a request is aborted, so they no longer remain stuck "in progress" in observability tools.
