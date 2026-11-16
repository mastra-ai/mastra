---
'@mastra/platform': minor
---

Added `PlatformBrowser`, a Stagehand browser backed by a Mastra Platform browser session. By default it provisions a session with `POST /v1/browsers/sessions` on the Platform and connects to the returned CDP URL; pass `cdpUrl` to connect to a session you already provisioned, with no token or API call. The access token falls back to `MASTRA_PLATFORM_ACCESS_TOKEN` / `MASTRA_PLATFORM_SECRET_KEY`, the project to `MASTRA_PROJECT_ID`, and the API URL to `MASTRA_BROWSER_API_URL`. `@mastra/platform` now depends on `@mastra/stagehand` at runtime.

```ts
import { PlatformBrowser } from '@mastra/platform';

const agent = new Agent({ name: 'browser-agent', model, browser: new PlatformBrowser() });
```
