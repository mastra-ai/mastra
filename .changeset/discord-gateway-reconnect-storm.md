---
'@mastra/discord': patch
---

Fixed a Discord Gateway reconnect storm that could trip Discord's connection abuse limit (>1000 connects in a short window) and get the bot token force-reset. The provider now owns the Gateway reconnection loop: failed connects (invalid token, Message Content privileged intent not enabled) back off exponentially instead of retrying instantly, a revoked token parks reconnection until new credentials arrive, and exactly one loop runs per installation — credential rotations and `disconnect()` now stop the previous loop instead of leaking it.
