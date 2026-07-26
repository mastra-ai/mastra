---
'@mastra/core': patch
'@mastra/stagehand': patch
'@mastra/browser-viewer': patch
---

Browser launch options now accept `viewport: null` to disable fixed viewport emulation, so the page follows the real browser window size instead of a fixed size.

```ts
const browser = new MastraBrowser({
  provider: 'stagehand',
  viewport: null, // follow the real window instead of emulating a fixed size
});
```

BrowserViewer now forwards `viewport: null` to Playwright as-is instead of collapsing it back into a fixed 1280x720 viewport, so match-window mode works there too. An absent viewport still falls back to the default size.
