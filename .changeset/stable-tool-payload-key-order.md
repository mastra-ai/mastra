---
'@mastra/core': patch
---

Fixed prompt caching after a suspended or tool-approval run resumes from Postgres storage.

Tool-call arguments and JSON tool results in model prompts now use sorted object keys, so the same content produces the same request after a run resumes. Stored messages are unchanged.
