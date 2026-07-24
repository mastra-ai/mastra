---
"@mastra/core": minor
---

Added a `readOnly` option to `NativeSandboxConfig` to restrict the local sandbox's working directory to read-only access on macOS (Seatbelt) and Linux (Bubblewrap).

**Usage Example:**

```typescript
import { Workspace, LocalFilesystem, LocalSandbox } from '@mastra/core';

const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace', readOnly: true }),
  sandbox: new LocalSandbox({
    workingDirectory: './workspace',
    isolation: 'bwrap', // or 'seatbelt'
    nativeSandbox: {
      readOnly: true,
    },
  }),
});
```
