---
'@mastra/core': patch
---

Knowledge page and note writes now retry a failed embed or vector write a few times over about 10 seconds before giving up. That gives a cold scale-to-zero database (Neon, Lakebase) time to wake, so its pages aren't silently left out of semantic search. If every try fails, the write still succeeds and the warning names the page, for example `Knowledge couldn't embed page "docs:acme#guides/cli" after retrying; it is findable by keyword search only until it is rewritten`. Errors the embedding provider marks as not retryable, such as an input over its limit, are not retried.
