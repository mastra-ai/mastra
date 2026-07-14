---
'@mastra/e2b': minor
---

Add `E2BCodeModeTransport` for running Code Mode in an `E2BSandbox`.

The default `StdioCodeModeTransport` writes the runner/program to the host tmpdir and spawns `node <hostPath>`, which only works when the sandbox shares the host filesystem (e.g. `LocalSandbox`). E2B runs the program in a remote micro-VM, so those host paths don't exist there. `E2BCodeModeTransport` writes the program and runner into the sandbox via the E2B files API, strips TypeScript on the host with esbuild (no `--experimental-strip-types`, no Node-version dependency), auto-starts the sandbox when needed, surfaces captured stderr in timeout/no-result errors, and cleans up the sandbox directory afterwards.

```ts
import { createCodeMode } from '@mastra/core/tools';
import { E2BSandbox, E2BCodeModeTransport } from '@mastra/e2b';

const { tool, instructions } = createCodeMode(
  { tools, sandbox: new E2BSandbox() },
  new E2BCodeModeTransport(),
);
```
