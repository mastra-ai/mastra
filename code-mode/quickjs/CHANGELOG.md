# @mastra/quickjs

## 0.1.0-alpha.0

### Minor Changes

- Added `@mastra/quickjs`, a Code Mode transport that runs model-authored programs in an in-process QuickJS runtime compiled to WebAssembly. ([#21089](https://github.com/mastra-ai/mastra/pull/21089))

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

### Patch Changes

- Updated dependencies [[`66bbfb5`](https://github.com/mastra-ai/mastra/commit/66bbfb5f05b473d39f88c0e4a481ccac41634f3a)]:
  - @mastra/core@1.58.0-alpha.10
