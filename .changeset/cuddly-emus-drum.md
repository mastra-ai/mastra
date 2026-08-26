---
'@mastra/core': patch
---

Fixed missing observability spans for the processLLMRequest and processLLMResponse processor hooks. These hooks now emit processor_run spans like every other processor hook, so they appear in traces and in the automatic processor duration metrics, and tripwire aborts from them are recorded on the span. Fixes #22342.
