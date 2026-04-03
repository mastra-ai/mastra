# @mastra/stagehand

## 0.1.0-alpha.0

### Minor Changes

- Add AI-powered browser automation with Stagehand SDK integration ([#14938](https://github.com/mastra-ai/mastra/pull/14938))

  **New Features:**
  - AI-powered browser automation using Stagehand's act/extract/observe primitives
  - Native Browserbase integration for cloud browser sessions
  - Real-time screencast streaming via WebSocket
  - Mouse and keyboard input injection
  - Thread-scoped browser isolation (`scope: 'thread'`)
  - State persistence and restoration across sessions

  **Configuration:**

  ```typescript
  import { StagehandBrowser } from '@mastra/stagehand';

  // Local browser
  const browser = new StagehandBrowser({
    headless: true,
    scope: 'thread',
  });

  // Browserbase cloud
  const browser = new StagehandBrowser({
    env: 'BROWSERBASE',
    apiKey: process.env.BROWSERBASE_API_KEY,
    projectId: process.env.BROWSERBASE_PROJECT_ID,
  });

  const agent = mastra.getAgent('my-agent', { browser });
  ```

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054)]:
  - @mastra/core@1.22.0-alpha.2
