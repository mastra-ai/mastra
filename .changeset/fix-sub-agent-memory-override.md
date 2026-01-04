---
"@mastra/core": patch
---

Sub-agents with `defaultOptions.memory` configurations were having their memory settings overridden when called as tools from a parent agent. The parent unconditionally passed its own `memory` option (with newly generated thread/resource IDs), which replaced the sub-agent's intended memory configuration due to shallow object merging.

This fix checks if the sub-agent has its own `defaultOptions.memory` before applying parent-derived memory settings. Sub-agents without their own memory config continue to receive parent-derived IDs as a fallback.

No code changes required for consumers - sub-agents with explicit `defaultOptions.memory` will now work correctly when used via the `agents: {}` option.

