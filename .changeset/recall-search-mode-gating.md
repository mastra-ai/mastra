---
'@mastra/memory': patch
---

Hide the recall tool's `mode: "search"` when semantic search is not configured. Previously the tool always advertised search in its schema and description, but calling it without a vector store and embedder threw `searchMessages requires a vector store...` — the "Search is not configured" guidance in `searchMessagesForResource` was unreachable because the standard `Memory` class always has a `searchMessages` method. `listTools` now passes `hasRetrievalSearch()` into `recallTool`, which drops `"search"` from the mode enum, the `query` parameter, and the tool description when search can't work, so the model is never invited to call it. If a model passes `mode: "search"` anyway, input validation rejects it with a self-correcting message, and an execute-level guard returns the not-configured guidance as a final fallback.
