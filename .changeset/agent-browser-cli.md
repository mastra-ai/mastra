---
'@mastra/agent-browser': minor
'@mastra/browser-firecrawl': patch
---

`@mastra/agent-browser` now drives Chrome with Playwright alone and no longer depends on the `agent-browser` package. This drops webdriverio and its vulnerable transitive dependencies (basic-ftp, extract-zip). The tools and config are unchanged.

Local launches run Chrome as a child of your Node.js process, so the browser exits with it. Playwright's Chromium is used when installed, otherwise an installed Google Chrome. If neither is found, run `npx playwright install chromium` or set `executablePath`. Snapshot refs inside iframes (for example `@f1e2`) now resolve like any other ref.

`BrowserManager` is now exported from `@mastra/agent-browser`, and `@mastra/browser-firecrawl` imports it from there instead of depending on `agent-browser` directly.

```typescript
import { BrowserManager } from '@mastra/agent-browser';

const manager = new BrowserManager();
await manager.launch({ headless: true });
await manager.getPage().goto('https://example.com');
const { tree } = await manager.getSnapshot({ interactive: true });
await manager.close();
```
