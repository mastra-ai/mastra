---
'@mastra/mcp': patch
---

Close and clear the previous transport inside `InternalMastraMCPClient`'s `client.onclose` handler so it mirrors the cleanup already done by `forceReconnect()`. Previously the implicit-close path (server restart, network blip, idle timeout) left `this.transport` set, so the underlying `EventSource` kept retrying on its built-in 3-second loop and the next `connect()` overwrote `this.transport` without releasing the previous one. Under sustained server churn the server-side session map could grow to tens of thousands of entries. See #16693.
