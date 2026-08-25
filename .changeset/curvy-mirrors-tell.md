---
'@mastra/core': patch
---

Fixed channel typing statuses staying pinned to the thread after a run ends without posting a message. When a run terminates on a tool call (for example via a stopWhen predicate), errors, or is aborted before any assistant text is posted, the typing status is now cleared instead of showing the last status indefinitely. Fixes #21880
