---
'@mastra/mcp': patch
---

Fix MCPClient resource leak causing MaxListenersExceededWarning

Fixes an issue where `InternalMastraMCPClient` registered event listeners to the `process` object for graceful shutdown but failed to remove them upon disconnection. This caused a memory leak after multiple connect/disconnect cycles, triggering the warning:

```
MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGTERM listeners added to [process].
```

The fix stores references to the exit hook unsubscribe function and SIGTERM handler, then properly cleans them up in `disconnect()`.

Fixes #10499
