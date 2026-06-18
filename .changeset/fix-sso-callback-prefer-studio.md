---
"@mastra/server": patch
---

Fix SSO callback routing for dual auth configurations. OAuth redirects from identity providers now correctly route to studio auth instead of failing with "sso_not_configured" error.
