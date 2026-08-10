---
'@mastra/code-sdk': patch
---

Fixed tenant credential resolution for session-based authentication providers. Background Factory runs now resolve the authenticated user and active organization from session-wrapped request context values instead of falling back to an empty credential store.
