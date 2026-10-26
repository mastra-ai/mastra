---
'@mastra/core': patch
---

Fixed durable agent HTTP observations closing during silent execution by checking producer liveness before releasing the subscription. Added `server.agentSseHeartbeatMs` to configure the default 25-second keepalive interval or set it to `0` to disable comments; the value must be an integer from `0` through `2_147_483_647`.
