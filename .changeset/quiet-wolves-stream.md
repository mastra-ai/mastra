---
'@mastra/islo': patch
---

Added `@mastra/islo`, a new sandbox provider for Mastra workspaces backed by islo.dev. It supports foreground command execution with live streamed output, lifecycle management, and pause/resume semantics via `stop()`/`start()`.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { IsloSandbox } from '@mastra/islo';

const workspace = new Workspace({
  sandbox: new IsloSandbox({
    apiKey: process.env.ISLO_API_KEY,
    image: 'docker.io/library/ubuntu:24.04',
  }),
});
```
