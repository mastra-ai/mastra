---
'@mastra/core': patch
---

Fixed `DurableAgent.recover()` silently continuing a recovered run without its processors or memory. If processor or memory resolution fails during recovery, `recover()` now rejects with `DurableProcessorRebuildError` before calling the model. The run stays recoverable, so calling `recover()` again once the resolver works resumes it with guardrails and message persistence intact.
