---
'@mastra/code-sdk': minor
---

Added explicit project-level MCP enable overrides so a project can opt into a server that is disabled globally. MCP statuses expose the global default and all-server kill-switch state so clients can explain the effective setting. The global all-server kill switch remains absolute.

```ts
await mcpManager.setServerDisabled('notion', false);
await mcpManager.inheritServer('notion');
```
