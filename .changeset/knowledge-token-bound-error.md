---
'@mastra/core': patch
---

Knowledge now throws a named `KnowledgeTokenBoundError` when a page description or note text is over its token limit. Hosts can map it to a 400 by `error.name` instead of matching the message text. The message is unchanged and it is still an `Error`.
