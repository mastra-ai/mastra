---
'@mastra/langsmith': patch
---

Model spans keep `timeToFirstTokenMs` out of LangSmith metadata, as with `completionStartTime`, which already drives the `new_token` event.
