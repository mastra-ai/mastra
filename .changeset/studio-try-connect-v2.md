---
'@internal/playground': patch
---

Studio's "Try connect" probe for stored MCP clients now sends a single self-contained 2026-07-28 `tools/list` request instead of the legacy `initialize` handshake, so the probe result matches what `@mastra/mcp` v2 will do at runtime.
