---
"@mastra/core": patch
---

Fixed approval ordering for tools added by input processors, such as `ToolSearchProcessor`. Each call now waits for its own approval, including after a durable run resumes, instead of parallel approval requests leaving the run stuck.

Fixed `foreach` scheduling for all evented workflows so suspended iterations retain their concurrency slots and cannot be mistaken for completed work. Evented workflows now remain suspended when every active slot is awaiting resume, start queued iterations only when a slot is genuinely free, and preserve the suspended iteration index used to resume the aggregate `foreach`.
