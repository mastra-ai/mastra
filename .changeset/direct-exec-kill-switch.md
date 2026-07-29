---
'@mastra/platform-workspace': patch
---

Fix direct-exec fallback loop: when the WebSocket transport fails on a sandbox (Railway rejects the handshake, mid-stream drop, etc.), disable direct-exec permanently for that sandbox instead of re-minting a fresh lease on every subsequent exec. Also surface WebSocket close code, reason, and `opened` state in `DirectExecResult` and emit a diagnostic warning on transport failure so we can see why Railway is refusing the upgrade in production.
