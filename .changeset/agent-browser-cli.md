---
'@mastra/agent-browser': minor
'@mastra/browser-firecrawl': minor
---

`@mastra/agent-browser` now drives Chrome with Playwright alone and no longer depends on the `agent-browser` package. This drops webdriverio and its vulnerable transitive dependencies (basic-ftp, extract-zip). The tools and config are unchanged.

Local launches run Chrome as a child of your Node.js process. The browser exits when that process does. Playwright's Chromium is used when installed, otherwise an installed Google Chrome. If neither is found, run `npx playwright install chromium` or set `executablePath`. Snapshot refs inside iframes (for example `@f1e2`) now resolve like any other ref.

A ref from the last snapshot still targets an element after the page re-renders it, when its role and name stay the same. After the page navigates, that ref is rejected immediately instead of waiting out the action timeout.

`BrowserManager` is now exported from `@mastra/agent-browser`, and `@mastra/browser-firecrawl` imports it from there instead of depending on `agent-browser` directly. `@mastra/browser-firecrawl` therefore needs the `@mastra/agent-browser` release from this change (peer `>=0.7.0-0`) and no longer has an `agent-browser` peer dependency.

```typescript
import { BrowserManager } from '@mastra/agent-browser';

const manager = new BrowserManager();
await manager.launch({ headless: true });
await manager.getPage().goto('https://example.com');
const { tree } = await manager.getSnapshot({ interactive: true });
await manager.close();
```
