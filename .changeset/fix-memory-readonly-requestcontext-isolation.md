---
'@mastra/core': patch
---

Fixed memory readOnly option not being respected when agents share a RequestContext. Previously, when output processors were resolved, the readOnly check happened too early - before the agent could set its own MastraMemory context. This caused child agents to inherit their parent's readOnly setting when sharing a RequestContext.

The readOnly check is now only done at execution time in each processor's processOutputResult method, allowing proper isolation.
