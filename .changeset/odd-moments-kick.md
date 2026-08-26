---
'@mastra/e2b-desktop': minor
---

Added `@mastra/e2b-desktop`, a computer-use sandbox provider backed by E2B Desktop. It combines E2B command, process, file, and reconnection support with screenshot, mouse, keyboard, screen information, and authenticated noVNC tools.

```typescript
const sandbox = new E2BDesktopSandbox({ resolution: [1280, 720] });
const workspace = new Workspace({ sandbox });
```

The provider also exports the underlying desktop SDK through `sandbox.desktop` for desktop-specific operations.
