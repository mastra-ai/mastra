---
'@mastra/claude': patch
'@mastra/cursor': patch
'@mastra/acp': patch
---

Moved the Claude, Cursor, and ACP agent-SDK packages from `packages/` to a new top-level `agent-sdks/` folder. Package names are unchanged; only the repository layout and each package's `repository.directory` metadata were updated.
