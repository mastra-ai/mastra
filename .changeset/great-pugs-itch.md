---
'mastracode': patch
---

Fixed two bugs in Mastra Code tool handling:

**extraTools not merged** — The `extraTools` parameter in `createMastraCode` was accepted but never passed through to the dynamic tool builder. Extra tools are now correctly merged into the tool set (without overwriting built-in tools).

**Denied tools still advertised** — Tools with a per-tool `deny` policy in `permissionRules` were still included in the tool set and system prompt guidance, causing the model to attempt using them only to be blocked at execution time. Denied tools are now filtered from both the tool set and the tool guidance, so the model never sees them.
