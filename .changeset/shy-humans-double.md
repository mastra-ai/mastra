---
'@mastra/browser-viewer': patch
---

Fixed the browser viewer reporting no URL and no tabs. `getCurrentUrl()` and `getBrowserState()` on `BrowserViewer` always returned `null` because they were never wired to the internal tab state. The viewer now returns the current URL and the list of open tabs. Fixes [#22539](https://github.com/mastra-ai/mastra/issues/22539).
