---
'@mastra/core': minor
---

Added support for Code Mode transports that provide their own execution boundary. A transport can now declare `requiresSandbox: false` and `createCodeMode()` will run it without a workspace sandbox, which enables in-process transports such as `IsolatedVmCodeModeTransport` from `@mastra/isolated-vm`:

```typescript
import { createCodeMode } from '@mastra/core/tools';
import { IsolatedVmCodeModeTransport } from '@mastra/isolated-vm';

// No sandbox needed — the V8 isolate is the execution boundary
const { tool, instructions } = createCodeMode({ tools }, new IsolatedVmCodeModeTransport());
```

Also fixed the generated Code Mode instructions to describe isolation accurately instead of always claiming the program runs fully sandboxed, since the actual boundary depends on the configured sandbox and transport. The `sanitizeToolId` helper used for `external_*` naming is now exported from `@mastra/core/tools` so transports can reuse it instead of duplicating it.
