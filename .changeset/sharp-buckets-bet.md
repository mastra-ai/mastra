---
'@mastra/code-sdk': minor
---

Added opt-in process memory diagnostics for SDK process adapters. The service records process and V8 heap-space samples, naturally occurring garbage collection events, and periodic allocation profiles without forcing garbage collection or writing heap snapshots.

Start diagnostics before creating Mastra Code, then await the final capture after work-producing services stop:

```ts
import {
  createProcessMemoryDiagnosticsFromEnvironment,
  startConfiguredProcessMemoryDiagnostics,
} from '@mastra/code-sdk/process-memory-diagnostics';

const setup = createProcessMemoryDiagnosticsFromEnvironment(process.env);
const diagnostics = await startConfiguredProcessMemoryDiagnostics(setup, console.warn);

try {
  // Create and run the process adapter.
} finally {
  await diagnostics.stop();
}
```

Allocation profiles remain local and may contain prompts, credentials, file contents, and tool arguments. Keep them private and delete them after analysis.
