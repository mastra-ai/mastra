---
'@mastra/core': patch
---

Lowered the implicit error-processor retry cap from 10 to 3 and made it visible. Configuring `errorProcessors` without an explicit `maxProcessorRetries` previously allowed a processor that always requests a retry to drive 11 model calls for a single turn, silently and regardless of `maxRetries: 0`. The cap is now 3 (4 model calls worst case) and a one-time warning is logged naming the setting to configure. Every built-in error processor self-limits to at most one retry, so only a processor that never stops asking is affected; callers who need a larger budget can set `maxProcessorRetries` explicitly.

Also aligned the durable execution path with the standard loop: `processAPIError` now runs on the final attempt too, so a processor can observe and report a terminal failure instead of being skipped once the retry budget is spent.
