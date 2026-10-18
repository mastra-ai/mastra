---
'@mastra/code-sdk': patch
---

Lazy-load storage backends (@mastra/libsql, @mastra/pg, @mastra/duckdb), @mastra/observability, and @mastra/github-signals in the code-sdk. These packages — native DB drivers among them — were statically imported at the top of the SDK entry, so every cold start paid for all of them even though a session only ever uses one storage backend and the rest are feature-gated. They are now imported dynamically at their construction sites, cutting SDK import time and keeping unused backends off the startup path entirely.
