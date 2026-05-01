---
"@mastra/server": patch
---

Fix `GET /tools/:toolId` and `POST /tools/:toolId/execute` to find dynamically-resolved agent tools (provided via `toolsResolver` / function-based `tools`) when they are not in the static tool registry. Errors thrown by an individual agent's `listTools()` during the lookup are now logged as warnings instead of being silently swallowed.
