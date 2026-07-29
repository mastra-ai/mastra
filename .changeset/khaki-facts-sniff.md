---
'@mastra/factory': patch
---

Fixed a boot-time provisioning storm where several concurrent requests for the same cold session (for example multiple open browser tabs polling right after a server restart) each provisioned their own sandbox. Concurrent sandbox opens for the same session now share one in-flight provision, so only a single sandbox is created per session.
