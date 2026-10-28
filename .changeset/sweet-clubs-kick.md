---
'@mastra/core': minor
---

Added `AgentController.getDefaultMode()`, which returns the mode new sessions start in. It follows `defaultModeId`, then a mode marked as default, then the first mode, so you can read the starting model without creating a session.

```ts
const mode = controller.getDefaultMode();
console.log(mode.id, mode.defaultModelId);
```
