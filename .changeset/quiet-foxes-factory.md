---
'@mastra/factory': patch
---

Fixed session resume after a host restart failing with `Sandbox not found` on the platform sandbox provider. Factory no longer persists the session's own id as the sandbox's reattach id when the provider exposes no physical id; the provider resumes through its own recovery key instead.
