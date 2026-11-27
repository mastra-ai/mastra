---
'@mastra/core': minor
---

Added `createRecreateSandboxTool()` so agents can recover from a sandbox that stopped responding. The tool destroys the sandbox's environment and leaves the workspace usable: the next command starts a fresh one. Anything not saved elsewhere is lost.

```ts
import { createRecreateSandboxTool } from '@mastra/core/workspace';

const agent = new Agent({
  // ...
  workspace,
  tools: { recreate_sandbox: createRecreateSandboxTool() },
});
```

Sandboxes built on `MastraSandbox` get `_reset()`, which the tool calls. It does not wait on a start that is hung on the dead environment, and treats an environment that is already gone as released. Pass `reset` to the tool to run your own recovery instead.
