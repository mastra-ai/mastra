---
'@mastra/quickjs': minor
---

Added `@mastra/quickjs`, a Code Mode transport that runs model-authored programs in an in-process QuickJS runtime compiled to WebAssembly.

**Why**

Running Code Mode in-process previously meant `@mastra/isolated-vm`, which installs a native addon and requires the host process to start with `--no-node-snapshot`. Serverless platforms usually allow neither, leaving a full workspace sandbox as the only option. This transport needs neither, so Code Mode runs on those hosts.

**Usage**

```typescript
import { createCodeMode } from '@mastra/core/tools';
import { QuickJsCodeModeTransport } from '@mastra/quickjs';

const { tool, instructions } = createCodeMode(
  { tools: { getTopProducts, getProductRatings } },
  new QuickJsCodeModeTransport({ memoryLimitMb: 128 }),
);
```

Programs get the same boundary as the isolated-vm transport: no filesystem, network, process, or module access, and the allow-listed tools as their only capability. They run slower than in a V8 isolate, which affects compute-heavy code far more than code that awaits tool calls.

Closes https://github.com/mastra-ai/mastra/issues/20546
