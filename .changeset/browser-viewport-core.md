---
'@mastra/core': patch
---

Allow the browser `viewport` to be set to `'window'` so the page matches the real browser window instead of a fixed size. Adds `resolveViewportSize` and `resolveLaunchViewport` helpers plus a `DEFAULT_BROWSER_VIEWPORT` constant for providers to resolve the setting consistently.
