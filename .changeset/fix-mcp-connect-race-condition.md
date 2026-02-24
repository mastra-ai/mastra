---
'@mastra/mcp': patch
---

Fix TOCTOU race condition in MCP client `connect()` that caused duplicate connections when called concurrently. The `await this.isConnected` guard yielded the microtask queue before the promise assignment, allowing concurrent callers to both pass the guard and create separate connections — leaking the first one. Changed to a synchronous check that closes the race window.
