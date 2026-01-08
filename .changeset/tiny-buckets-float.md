---
'@mastra/core': patch
---

Cache processor instances in MastraMemory to preserve embedding cache across calls
Fixed issue where getInputProcessors() and getOutputProcessors() created new processor instances on each call, causing the SemanticRecall embedding cache to be discarded. Processor instances (SemanticRecall, WorkingMemory, MessageHistory) are now cached and reused, reducing unnecessary embedding API calls and improving latency.
Also added cache invalidation when setStorage(), setVector(), or setEmbedder() are called to ensure processors use updated dependencies.
Fixes #11455
