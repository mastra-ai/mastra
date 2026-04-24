---
'@mastra/core': patch
'@mastra/memory': patch
---

Fixed observational memory message boundaries so streamed tool results continue in a fresh assistant message instead of being filtered out mid-run, and OM lifecycle markers persist through memory without creating data-only database messages.
