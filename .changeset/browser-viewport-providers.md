---
'@mastra/agent-browser': patch
'@mastra/browser-viewer': patch
'@mastra/stagehand': patch
'@mastra/browser-firecrawl': patch
---

Honor a `'window'` viewport where the provider can support it. Agent Browser and the browser viewer disable viewport emulation so the page tracks the real window; Stagehand does the same when connecting over CDP and falls back to the default size for a locally launched browser, which always applies its own viewport.
