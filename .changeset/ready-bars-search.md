---
'@mastra/isolated-vm': minor
---

Added `@mastra/isolated-vm`, a new package with `IsolatedVmCodeModeTransport` — a Code Mode transport that runs model-authored programs in an in-process V8 isolate (backed by `isolated-vm`). The isolate is the execution boundary, so no workspace sandbox is required: the program has no filesystem, network, or process access, and its only capabilities are the `external_*` tool functions bridged back to the host.

```typescript
import { createCodeMode } from '@mastra/core/tools';
import { IsolatedVmCodeModeTransport } from '@mastra/isolated-vm';

const { tool, instructions } = createCodeMode({ tools }, new IsolatedVmCodeModeTransport({ memoryLimitMb: 128 }));
```

Note: `isolated-vm` is a native addon, and on Node.js 20+ the host process must be started with `--no-node-snapshot` (for example `NODE_OPTIONS=--no-node-snapshot`). See the docs for setup details. Resolves https://github.com/mastra-ai/mastra/issues/20329.
