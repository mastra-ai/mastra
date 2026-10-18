---
'@mastra/mcp': patch
---

Fixed `tools.onListChanged()`, `prompts.onListChanged()` and `resources.onListChanged()` rejecting for MCP servers on an older protocol revision (for example `2025-11-25`). The handlers now register and fire on those servers, and reconnecting no longer logs a `subscriptions/listen` failure. Resource subscriptions still require the `2026-07-28` revision.
