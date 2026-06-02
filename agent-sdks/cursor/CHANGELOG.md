# @mastra/cursor

## 0.1.0-alpha.1

### Minor Changes

- Added `@mastra/cursor`, a package for running Cursor SDK agents through Mastra. ([#16906](https://github.com/mastra-ai/mastra/pull/16906))

  Create a Cursor SDK agent, register it with Mastra, and call `generate()` or `stream()` with Mastra-compatible outputs. Runs keep Cursor SDK usage and observability data available to Mastra.

  ```ts
  import { CursorSDKAgent } from '@mastra/cursor';

  export const cursorAgent = new CursorSDKAgent({
    id: 'cursor-sdk-agent',
    description: 'Use Cursor Agent SDK through Mastra.',
    sdkOptions: {
      apiKey: process.env.CURSOR_API_KEY,
      model: { id: process.env.CURSOR_MODEL_ID! },
      local: {
        cwd: process.cwd(),
      },
    },
  });
  ```

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.38.0-alpha.7

## 0.1.0-alpha.0

Initial release.
