---
'@mastra/core': patch
---

Fixed duplicate OpenAI item ID errors when using web search. When OpenAI streams responses with web search citations, it interleaves source chunks with text, causing multiple message parts to share the same item ID. This resulted in 'Duplicate item found' errors on subsequent requests. The fix prevents text flushing on source chunks and merges any existing duplicate parts.
