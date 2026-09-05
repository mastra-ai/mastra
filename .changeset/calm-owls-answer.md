---
'@mastra/code-sdk': patch
---

Server-started turns on a factory-owned session (a notification wake, a scheduled sweep) can now resolve model credentials. When no signed-in person is on the request, the tenant is read from the session itself: the factory organization stamped on its state, resolved org-first, then its owner's own credentials. A signed-in person on the request is still resolved on their own identity, and a session missing any of project, organization, or owner stays unresolved.
