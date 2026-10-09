---
'@mastra/factory': patch
---

Session resume no longer persists the session's own id as the sandbox's reattach id when the provider exposes no physical id. The provider never issued that id, so resume after a host restart failed with `Sandbox not found` instead of reattaching through the provider's own recovery key.
