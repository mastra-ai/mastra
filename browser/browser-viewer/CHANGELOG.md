# @mastra/browser-viewer

## 0.1.1

### Patch Changes

- Remove unused `userDataDir` config option from `BrowserViewerConfig`. ([#15696](https://github.com/mastra-ai/mastra/pull/15696))

- Standardize `headless` default to `true` across all browser providers. Each provider now resolves `headless` once in its constructor and passes it to the thread manager via the base class getter, removing duplicate fallback logic. ([#15696](https://github.com/mastra-ai/mastra/pull/15696))

- Updated dependencies [[`733bf53`](https://github.com/mastra-ai/mastra/commit/733bf53d9352aedd3ef38c3d501edb275b65b43c), [`5405b3b`](https://github.com/mastra-ai/mastra/commit/5405b3b35325c5b8fb34fc7ac109bd2feb7bb6fe), [`45e29cb`](https://github.com/mastra-ai/mastra/commit/45e29cb5b5737f3083eb3852db02b944b9cf37ed), [`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9), [`c321127`](https://github.com/mastra-ai/mastra/commit/c3211275fc195de9ad1ead2746b354beb8eae6e8), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1), [`696694e`](https://github.com/mastra-ai/mastra/commit/696694e00f29241a25dd1a1b749afa06c3a626b4), [`b084a80`](https://github.com/mastra-ai/mastra/commit/b084a800db0f82d62e1fc3d6e3e3480da1ba5a53), [`82b7a96`](https://github.com/mastra-ai/mastra/commit/82b7a964169636c1d1e0c694fc892a213b0179d5), [`df97812`](https://github.com/mastra-ai/mastra/commit/df97812bd949dcafeb074b80ecab501724b49c3b), [`8bbe360`](https://github.com/mastra-ai/mastra/commit/8bbe36042af7fc4be0244dffd8913f6795179421), [`f6b8ba8`](https://github.com/mastra-ai/mastra/commit/f6b8ba8dbf533b7a8db90c72b6805ddc804a3a72), [`a07bcef`](https://github.com/mastra-ai/mastra/commit/a07bcefea77c03d6d322caad973dca49b4b15fa1)]:
  - @mastra/core@1.28.0

## 0.1.1-alpha.0

### Patch Changes

- Remove unused `userDataDir` config option from `BrowserViewerConfig`. ([#15696](https://github.com/mastra-ai/mastra/pull/15696))

- Standardize `headless` default to `true` across all browser providers. Each provider now resolves `headless` once in its constructor and passes it to the thread manager via the base class getter, removing duplicate fallback logic. ([#15696](https://github.com/mastra-ai/mastra/pull/15696))

- Updated dependencies [[`750b4d3`](https://github.com/mastra-ai/mastra/commit/750b4d3d8231f92e769b2c485921ac5a8ca639b9)]:
  - @mastra/core@1.28.0-alpha.1

## 0.1.0

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

- Updated dependencies [[`f112db1`](https://github.com/mastra-ai/mastra/commit/f112db179557ae9b5a0f1d25dc47f928d7d61cd9), [`21d9706`](https://github.com/mastra-ai/mastra/commit/21d970604d89eee970cbf8013d26d7551aff6ea5), [`0a0aa94`](https://github.com/mastra-ai/mastra/commit/0a0aa94729592e99885af2efb90c56aaada62247), [`ed07df3`](https://github.com/mastra-ai/mastra/commit/ed07df32a9d539c8261e892fc1bade783f5b41a6), [`01a7d51`](https://github.com/mastra-ai/mastra/commit/01a7d513493d21562f677f98550f7ceb165ba78c)]:
  - @mastra/core@1.27.0

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
