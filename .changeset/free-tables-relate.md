---
'@mastra/server': patch
---

Fixed Responses and Conversations to resolve stored data through the selected agent's memory store instead of assuming Mastra root memory storage.

Responses and conversation retrieval, deletion, and continuation now follow the agent's configured memory storage, while still using Mastra root storage when that agent memory inherits it.
