---
'mastra': patch
---

Fixed the Studio browser viewer never mounting for CLI browser providers like @mastra/browser-viewer. Studio now gates the browser session probe and screencast stream on the agent's `hasBrowser` capability instead of the SDK browser tool count. Fixes https://github.com/mastra-ai/mastra/issues/22535
