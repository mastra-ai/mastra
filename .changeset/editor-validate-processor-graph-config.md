---
'@mastra/editor': patch
---

Processor graph hydration now validates each stored step configuration against the selected provider's `configSchema` before instantiating the processor, matching the documented `ProcessorProvider` contract.

Previously `resolveStep()` passed the raw stored config straight to `createProcessor()`. Malformed stored/API config could construct a broken processor that failed later during request execution, and schema `.default()`/transform outputs were skipped.

Now invalid configuration throws at hydration time with an error identifying the provider and graph step, and the validated config (including defaults and transforms) is what reaches `createProcessor()`.
