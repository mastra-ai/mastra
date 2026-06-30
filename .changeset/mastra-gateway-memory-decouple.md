---
'@mastra/memory': patch
'@mastra/server': patch
---

Memory handling for gateway-backed agents now follows the gateway's `handlesMemory` capability instead of assuming the Mastra gateway always manages memory.

Agents that route through a gateway only for model selection no longer have their local memory skipped or their "no memory configured" warning suppressed. When the gateway does manage memory, the server still proxies memory operations to it as before.
