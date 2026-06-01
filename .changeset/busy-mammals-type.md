---
'@mastra/core': minor
---

Added state and workspace context support to Harness v1. Sessions can now read and update harness state and resolve workspace tools from request context.

**Example**

```ts
const harness = new Harness({
  agents,
  modes,
  defaultModeId: 'build',
  stateSchema,
  initialState: { projectPath: process.cwd() },
  workspace,
});

const state = harness.getState();
await harness.setState({ projectPath: '/repo' });
```
