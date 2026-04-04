# @mastra/agent-browser

## 0.1.0

### Minor Changes

- Add browser automation support with screencast streaming, input injection, and thread isolation ([#14938](https://github.com/mastra-ai/mastra/pull/14938))

  **New Features:**
  - Browser tools for web automation (navigate, click, type, scroll, extract, etc.)
  - Real-time screencast streaming via WebSocket
  - Mouse and keyboard input injection
  - Thread-scoped browser isolation (`scope: 'thread'`)
  - State persistence and restoration across sessions
  - Support for cloud providers (Browserbase, Browser-Use, Browserless)

  **Configuration:**

  ```typescript
  import { AgentBrowser } from '@mastra/agent-browser';

  const browser = new AgentBrowser({
    headless: true,
    scope: 'thread', // Each thread gets isolated browser
    viewport: { width: 1280, height: 720 },
  });

  const agent = mastra.getAgent('my-agent', { browser });
  ```

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`81e4259`](https://github.com/mastra-ai/mastra/commit/81e425939b4ceeb4f586e9b6d89c3b1c1f2d2fe7), [`951b8a1`](https://github.com/mastra-ai/mastra/commit/951b8a1b5ef7e1474c59dc4f2b9fc1a8b1e508b6), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`2b4ea10`](https://github.com/mastra-ai/mastra/commit/2b4ea10b053e4ea1ab232d536933a4a3c4cba999), [`a0544f0`](https://github.com/mastra-ai/mastra/commit/a0544f0a1e6bd52ac12676228967c1938e43648d), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054), [`c8c86aa`](https://github.com/mastra-ai/mastra/commit/c8c86aa1458017fbd1c0776fdc0c520d129df8a6)]:
  - @mastra/core@1.22.0

## 0.1.0-alpha.0

### Minor Changes

- Add browser automation support with screencast streaming, input injection, and thread isolation ([#14938](https://github.com/mastra-ai/mastra/pull/14938))

  **New Features:**
  - Browser tools for web automation (navigate, click, type, scroll, extract, etc.)
  - Real-time screencast streaming via WebSocket
  - Mouse and keyboard input injection
  - Thread-scoped browser isolation (`scope: 'thread'`)
  - State persistence and restoration across sessions
  - Support for cloud providers (Browserbase, Browser-Use, Browserless)

  **Configuration:**

  ```typescript
  import { AgentBrowser } from '@mastra/agent-browser';

  const browser = new AgentBrowser({
    headless: true,
    scope: 'thread', // Each thread gets isolated browser
    viewport: { width: 1280, height: 720 },
  });

  const agent = mastra.getAgent('my-agent', { browser });
  ```

### Patch Changes

- Updated dependencies [[`cb15509`](https://github.com/mastra-ai/mastra/commit/cb15509b58f6a83e11b765c945082afc027db972), [`80c5668`](https://github.com/mastra-ai/mastra/commit/80c5668e365470d3a96d3e953868fd7a643ff67c), [`3d478c1`](https://github.com/mastra-ai/mastra/commit/3d478c1e13f17b80f330ac49d7aa42ef929b93ff), [`6039f17`](https://github.com/mastra-ai/mastra/commit/6039f176f9c457304825ff1df8c83b8e457376c0), [`06b928d`](https://github.com/mastra-ai/mastra/commit/06b928dfc2f5630d023467476cc5919dfa858d0a), [`6a8d984`](https://github.com/mastra-ai/mastra/commit/6a8d9841f2933456ee1598099f488d742b600054)]:
  - @mastra/core@1.22.0-alpha.2
