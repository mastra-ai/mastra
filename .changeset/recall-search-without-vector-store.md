---
'@mastra/memory': patch
---

The recall tool no longer advertises mode="search" unless observational-memory vector retrieval, a vector store, and an embedder are all configured. Previously the tool description and input schema invited the model to call search when the semantic retrieval pipeline could not run. The search mode and query parameter are now omitted from the tool surface when search cannot succeed, and a stale search call (e.g. on a resumed run that skips input validation) returns the existing "Search is not configured" guidance instead of throwing.
