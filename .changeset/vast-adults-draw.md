---
'@mastra/core': minor
---

Added an optional computer-use capability for workspace sandboxes. Providers can expose `SandboxComputer` to give agents screenshot, mouse, keyboard, screen information, and wait tools automatically.

```typescript
const workspace = new Workspace({ sandbox });

if (supportsComputer(sandbox)) {
  const screenshot = await sandbox.computer.screenshot();
}
```

Computer action tools return a follow-up screenshot by default and support the existing workspace tool approval and enablement settings.
