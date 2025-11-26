---
'@mastra/mcp': patch
---

Fix MCPClient resource leak causing MaxListenersExceededWarning

Fixes an issue where `InternalMastraMCPClient` registered event listeners to the `process` object for graceful shutdown but failed to remove them upon disconnection. This caused a memory leak after multiple connect/disconnect cycles, triggering the warning:

```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGTERM listeners added to [process].
```

The fix stores references to the exit hook unsubscribe function and SIGTERM handler, then properly cleans them up in `disconnect()`.

Additionally, users can now disable session management by passing `sessionIdGenerator: undefined` in `startHTTP()` options. This enables stateless MCP server deployments, which is useful for serverless environments.

Fixes #10499, #8526
