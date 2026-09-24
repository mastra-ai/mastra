---
'@mastra/auth-google': patch
---

Fixed Google SSO users being signed out after about an hour. Sessions now last for the configured `session.cookieMaxAge` (24 hours by default) instead of expiring with the short-lived Google ID token.
