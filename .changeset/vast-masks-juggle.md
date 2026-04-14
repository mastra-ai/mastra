---
'@mastra/core': patch
---

Fixed Channels not working on Vercel serverless (and other serverless platforms). Webhook handlers now await initialization on cold starts instead of immediately returning 503, and pass the platform's `waitUntil` to the Chat SDK so agent processing survives after the HTTP response is sent. See #15300.
