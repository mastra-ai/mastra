---
'@mastra/factory': patch
'@mastra/auth-studio': patch
---

Speed up Factory hot paths:

- Much lower latency on authenticated requests — successful auth verifications are cached briefly instead of hitting the platform on every request, and credential verification requests time out after 15 seconds instead of hanging
- Faster GitHub repository listing and connecting
- Opening the same session concurrently no longer provisions duplicate sandboxes, and stuck sandbox commands now fail with a clear error instead of hanging
- Factory run dispatching stays fast as work-item history grows
