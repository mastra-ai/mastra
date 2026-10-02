---
'@mastra/core': patch
---

Preserve nested field paths when a Standard Schema validator rejects tool input, so MCP tool validation errors tell the caller which argument to fix. Each issue now renders as `path: message` (`items[0].tags: expected array, received string` instead of a bare `expected array, received string`). Rejection behavior is unchanged; only the diagnostic improves.
