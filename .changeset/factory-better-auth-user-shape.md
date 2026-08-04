---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Fixed signed-in users being treated as somebody else when the app uses a session-based auth provider such as better-auth. Opening a Factory session failed with "Factory session ... is not available to the current user", the GitHub session tools quietly went missing, and per-tenant credentials resolved to nothing. The authenticated user is now read through a normalizer that understands both the flat user shape and the session-wrapped one. See https://github.com/mastra-ai/mastra/issues/20688
