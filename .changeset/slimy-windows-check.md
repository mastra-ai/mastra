---
'@mastra/daytona': minor
---

Added computer-use support to `DaytonaSandbox`. Workspaces backed by Daytona can now take screenshots, control the mouse and keyboard, inspect the display, and open a noVNC viewer through the standard computer tools.

```typescript
const sandbox = new DaytonaSandbox();
await sandbox.start();

await sandbox.computer.leftClick(100, 200);
const screenshot = await sandbox.computer.screenshot();
```

Desktop services start lazily on the first computer operation. Set `computerUse: false` to disable the capability or `computerUse: { autoStart: false }` to manage those services directly.
