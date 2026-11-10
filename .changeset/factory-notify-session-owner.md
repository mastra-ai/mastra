---
'@mastra/factory': patch
---

Fixed Factory rule notifications waking an idle work-item session with no signed-in user. The woken run now runs as the session's owner, so it no longer fails with "Tenant model credential policy could not be resolved: the request has no authenticated user".
