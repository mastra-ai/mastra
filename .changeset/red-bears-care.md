---
'@mastra/core': patch
---

Fixed background tasks advertising the `_background` override to every tool. Previously, enabling `backgroundTasks` on the Mastra instance injected the `_background` field into every tool's input schema and listed every tool as background-eligible in the system prompt, even when neither the agent nor the tool opted in. Now only tools that are actually background-eligible — via the agent's `backgroundTasks.tools` config or the tool's own `background: { enabled: true }` — advertise the override, matching the runtime dispatch behavior. This removes roughly 2,000 characters of prompt overhead per ineligible tool and stops the model from being told it can background tools it cannot. Fixes [#22724](https://github.com/mastra-ai/mastra/issues/22724).
