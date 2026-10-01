---
"@mastra/core": patch
---

Fixed approval ordering for tools added by input processors, such as `ToolSearchProcessor`. Each call now waits for its own approval, including after a durable run resumes, instead of parallel approval requests leaving the run stuck.

Fixed `foreach` behavior for all evented workflows. Evented workflows now stay suspended until unfinished iterations resume, and queued iterations start only when capacity is available.
