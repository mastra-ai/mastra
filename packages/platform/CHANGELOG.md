# @mastra/platform

## 0.1.0-alpha.1

### Minor Changes

- Added `PlatformBrowser`, a Stagehand browser backed by a Mastra Platform browser session. By default it provisions a session with `POST /v1/browsers/sessions` on the Platform and connects to the returned CDP URL; pass `cdpUrl` to connect to a session you already provisioned, with no token or API call. The access token falls back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`, the project to `MASTRA_PROJECT_ID`, and the API URL to `MASTRA_BROWSER_API_URL`. `@mastra/platform` now depends on `@mastra/stagehand` at runtime. ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  ```ts
  import { PlatformBrowser } from '@mastra/platform';

  const agent = new Agent({ name: 'browser-agent', model, browser: new PlatformBrowser() });
  ```

- Added `@mastra/platform`: hosted Mastra Platform Memory and Knowledge clients, with Platform Sandbox and Filesystem re-exported from `@mastra/platform-workspace`. `PlatformMemory` is a drop-in `memory` for `Agent` that loads observations and recent messages from a Platform Memory instance and saves each turn back; observation and reflection run on the Platform. `PlatformMemoryClient` exposes the same API directly. Credentials fall back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`. `PlatformMemory` uses `MASTRA_MEMORY_INSTANCE_ID`; `PlatformKnowledge` uses `MASTRA_KNOWLEDGE_INSTANCE_ID`. `PlatformKnowledge` takes every scope declaration and access rule from its instance, Memory's and Platform importers' included, and has no `scopes` option. Agents read imported pages when their runs hold the scope an importer's rule grants (for now `imports:all`). ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  ```ts
  import { PlatformMemory, PlatformKnowledge, PlatformSandbox, PlatformFilesystem } from '@mastra/platform';

  const agent = new Agent({ name: 'assistant', model, memory: new PlatformMemory() });
  ```

### Patch Changes

- `PlatformKnowledge` now supports listing pins: `knowledge_pin` with `kind: 'list'` pins a page's listing on hosted Knowledge instead of refusing it as an old storage adapter. ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

- `PlatformMemory` fixes for read-only runs and working memory: ([#29428](https://github.com/mastra-ai/mastra/pull/29428))

  - A read-only run (`memory: { options: { readOnly: true } }`) now sees the thread's observations and unobserved messages, read through the Memory instance's read-only context route. Before, it got no stored context at all. It still saves nothing and starts no observation.
  - The `workingMemory` option now delivers what it says: `readonly` and `tool` add the resource's stored working memory to each run's prompt, read fresh each run; `tool` also tells the agent to update it with `updateWorkingMemory`; `off` leaves it out. Before, stored working memory never reached the prompt in any mode.

- Updated dependencies [[`0eb407e`](https://github.com/mastra-ai/mastra/commit/0eb407ebcce9d87e96cb399df5a3afb265fc2806)]:
  - @mastra/core@1.84.0-alpha.6

See [release notes](https://github.com/mastra-ai/mastra/releases) for published changes.
