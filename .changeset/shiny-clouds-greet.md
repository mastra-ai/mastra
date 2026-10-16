---
'@mastra/connect': minor
---

Added project-managed provider policies for end-user connections. When `providers` is omitted, `userConnectRoutes()` and the built-in `request_connection` tool now use the project provider list from Mastra Platform. An explicit code allowlist still takes priority.

```typescript
// Use the project policy from Mastra Platform.
userConnectRoutes({});

// Or enforce a code-level override.
userConnectRoutes({ providers: ['linear', 'slack'] });
```
