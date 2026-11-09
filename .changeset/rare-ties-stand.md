---
'@mastra/core': patch
---

Fixed duplicate assistant messages after resuming a thread with memory. When a sealed assistant message ended in whitespace, such as a trailing newline, contained working memory, or contained a tool call that was still streaming when it was saved, the copy loaded back from memory was added again under a new id. OpenAI Responses requests then failed with `Duplicate item found with id rs_...`. The stored copy is now recognized as the same message. Fixes #29380.
