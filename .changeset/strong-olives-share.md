---
'@mastra/core': patch
---

Channels now show connection requests from `@mastra/connect` in chat. The reason appears with a **Connect {Provider}** link button, or as a plain link on adapters without interactive buttons (`approvalButtons: false`).

In a shared channel, anyone who clicks the link adds a connection for the whole project, so use `requestConnections.allow(ctx)` to limit who can trigger a request from a channel.
