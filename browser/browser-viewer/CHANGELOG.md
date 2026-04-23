# @mastra/browser-viewer

## 0.1.0-alpha.0

### Minor Changes

- Initial release of @mastra/browser-viewer ([#15415](https://github.com/mastra-ai/mastra/pull/15415))

  Playwright-based browser viewer for CLI providers that enables screencast visualization in Studio. Supports thread-isolated browser sessions and automatic CDP connection management.

  ```typescript
  import { BrowserViewer } from '@mastra/browser-viewer';

  const workspace = new Workspace({
    sandbox: new LocalSandbox({ cwd: './workspace' }),
    browser: new BrowserViewer({
      cli: 'agent-browser',
      headless: false,
    }),
  });
  ```

### Patch Changes

- Updated dependencies [[`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0-alpha.1
