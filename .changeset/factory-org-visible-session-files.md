---
'@mastra/factory': patch
---

Fixed 403 errors in a session's file and changes panels when an org member opens an org-visible session that someone else started. The pending changes, patches, rendered `.artifacts` listing, file tree and file reads now follow the same visibility rule as the rest of the Factory: anyone in the org can see an org-visible session, and only the owner can see a private one.
