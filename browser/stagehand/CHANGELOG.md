# @mastra/stagehand

## 0.2.0-alpha.0

### Minor Changes

- Added automatic cleanup on browser close: patches `exit_type` to prevent restore dialogs, kills orphaned Chrome child processes, and uses CDP events for reliable disconnect detection in both shared and thread scope. ([#15194](https://github.com/mastra-ai/mastra/pull/15194))

### Patch Changes

- dependencies updates: ([#15209](https://github.com/mastra-ai/mastra/pull/15209))
  - Updated dependency [`@browserbasehq/stagehand@^3.2.1` ↗︎](https://www.npmjs.com/package/@browserbasehq/stagehand/v/3.2.1) (from `^3.2.0`, in `dependencies`)
- Updated dependencies [[`cbdf3e1`](https://github.com/mastra-ai/mastra/commit/cbdf3e12b3d0c30a6e5347be658e2009648c130a), [`8fe46d3`](https://github.com/mastra-ai/mastra/commit/8fe46d354027f3f0f0846e64219772348de106dd), [`18c67db`](https://github.com/mastra-ai/mastra/commit/18c67dbb9c9ebc26f26f65f7d3ff836e5691ef46), [`8dcc77e`](https://github.com/mastra-ai/mastra/commit/8dcc77e78a5340f5848f74b9e9f1b3da3513c1f5), [`aa67fc5`](https://github.com/mastra-ai/mastra/commit/aa67fc59ee8a5eeff1f23eb05970b8d7a536c8ff), [`fa8140b`](https://github.com/mastra-ai/mastra/commit/fa8140bcd4251d2e3ac85fdc5547dfc4f372b5be), [`190f452`](https://github.com/mastra-ai/mastra/commit/190f45258b0640e2adfc8219fa3258cdc5b8f071), [`7e7bf60`](https://github.com/mastra-ai/mastra/commit/7e7bf606886bf374a6f9d4ca9b09dd83d0533372), [`184907d`](https://github.com/mastra-ai/mastra/commit/184907d775d8609c03c26e78ccaf37315f3aa287), [`0c4cd13`](https://github.com/mastra-ai/mastra/commit/0c4cd131931c04ac5405373c932a242dbe88edd6), [`b16a753`](https://github.com/mastra-ai/mastra/commit/b16a753d5748440248d7df82e29bb987a9c8386c)]:
  - @mastra/core@1.25.0-alpha.3

## 0.1.0

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

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0

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
