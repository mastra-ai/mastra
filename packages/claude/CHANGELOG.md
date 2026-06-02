# @mastra/claude

## 0.1.0-alpha.1

### Minor Changes

- Added `@mastra/claude`, a package for running Claude Agent SDK agents through Mastra. ([#16906](https://github.com/mastra-ai/mastra/pull/16906))

  Create a Claude SDK agent, register it with Mastra, and call `generate()` or `stream()` with Mastra-compatible outputs. Runs keep Claude SDK usage, cost estimates, and observability data available to Mastra.

  ```ts
  import { ClaudeSDKAgent } from '@mastra/claude';

  export const claudeAgent = new ClaudeSDKAgent({
    id: 'claude-sdk-agent',
    description: 'Use Claude Agent SDK through Mastra.',
    sdkOptions: {
      model: process.env.CLAUDE_CODE_MODEL,
      cwd: process.cwd(),
    },
  });
  ```

### Patch Changes

- Updated dependencies:
  - @mastra/core@1.38.0-alpha.7

## 0.1.0-alpha.0

Initial release.
