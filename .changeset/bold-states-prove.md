---
'@mastra/server': patch
---

Fixed the browser viewer registry giving up permanently when no browser toolset was available on first connect. It now retries the lookup when the next viewer connects. Related to https://github.com/mastra-ai/mastra/issues/22537
