---
"@mastra/core": patch
---

Fixed approval ordering for tools added by input processors, such as `ToolSearchProcessor`. Approving one call now releases the next call's approval request instead of leaving the run stuck.

Fixed `foreach` behavior for all evented workflows. Evented workflows now stay suspended until unfinished iterations resume, and queued iterations start only when capacity is available.
