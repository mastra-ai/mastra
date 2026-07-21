---
'@mastra/core': patch
---

Fixed DurableAgent throwing ToolNotFoundError when a ToolSearchProcessor meta-tool (search_tools / load_tool) was called. The durable tool-call step now resolves processor-injected per-step tools, matching the regular Agent.
