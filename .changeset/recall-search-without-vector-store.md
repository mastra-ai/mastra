---
'@mastra/memory': patch
---

The recall tool no longer advertises mode="search" when no vector store is configured. Previously the tool description and input schema invited the model to call search, which always threw `searchMessages requires a vector store`. The search mode and query parameter are now omitted from the tool surface when search cannot succeed, and a stale search call (e.g. on a resumed run that skips input validation) returns the existing "Search is not configured" guidance instead of throwing.
