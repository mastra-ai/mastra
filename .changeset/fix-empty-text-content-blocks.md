---
'@mastra/core': patch
---

Fixed Anthropic API rejection errors caused by empty text content blocks in assistant messages. During streaming with web search citations, empty text parts could be persisted to the database and then rejected by Anthropic's API with 'text content blocks must be non-empty' errors. The fix filters out these empty text blocks before persistence, ensuring stored conversation history remains valid for Anthropic models. Fixes `#12553`.
