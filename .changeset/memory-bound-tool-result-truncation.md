---
'@mastra/memory': patch
---

Fixed Observational Memory freezing the event loop for seconds when a tool result is very large. Cutting a multi-megabyte tool result to the observer's token budget used to tokenize the whole text about 25 times (about 6 seconds for 30 MB). Text over about 32 characters per token of budget is now scanned once and only a bounded window at its start is tokenized (about 130 ms for 30 MB). Smaller results are cut exactly as before. For larger ones, the kept text is the same on ordinary text, the "~N tokens" figure in the truncation notice is approximate, and a result that opens with a very long run of whitespace may keep less text than the budget allows.
