---
'@mastra/core': patch
---

Fixed `requireApproval` being silently ignored for tools loaded dynamically via `ToolSearchProcessor`. The approval gate now fires a `tool-call-approval` event and pauses execution before running, matching the behaviour of tools registered directly on the agent.
