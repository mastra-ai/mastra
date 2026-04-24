---
'@mastra/browser-viewer': patch
'@mastra/agent-browser': patch
'@mastra/stagehand': patch

---

Standardized `headless` default to `true` across all browser providers. Each provider now resolves `headless` once in its constructor and passes it through to the thread manager via the base class getter, removing duplicate fallback logic. Removed unused `userDataDir` config option from `BrowserViewerConfig`.
