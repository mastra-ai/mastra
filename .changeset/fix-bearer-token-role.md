---
"@mastra/auth-studio": patch
---

Fix Bearer token authentication to extract role from /auth/verify response. Previously, CLI tokens created via `mastra auth token create` would fail permission checks because the role was not being extracted, causing MastraRBACStudio to fall back to empty default permissions.
