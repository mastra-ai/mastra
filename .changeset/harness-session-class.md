---
"@mastra/core": minor
"mastracode": patch
---

Introduce a `Session` class on the Harness that owns per-session runtime state. As a first step it takes ownership of session-scoped permission grants (the "allow for this session" approvals), which are intentionally in-memory only and reset on restart.

The grant helpers previously re-exposed on the Harness (`grantSessionCategory`, `grantSessionTool`, `getSessionGrants`) are removed in favor of the `harness.session` accessor:

- `harness.getSessionGrants()` → `harness.session.getGrants()`
- `harness.grantSessionCategory({ category })` → `harness.session.grantCategory(category)`
- `harness.grantSessionTool({ toolName })` → `harness.session.grantTool(toolName)`
