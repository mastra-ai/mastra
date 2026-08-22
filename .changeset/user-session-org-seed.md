---
'@mastra/factory': patch
'@mastra/code-sdk': patch
---

Fix knowledge captured in factory sessions being stored in the wrong tenant.

Knowledge captured during a factory session is now always stored under the organization
that owns the session, so it is visible in that organization's knowledge graph. A session
whose organization cannot be determined no longer stores knowledge somewhere it could
never be read back from; it stops capturing and reports why. Local (TUI/studio) use is
unaffected and captures under a dedicated local scope.
