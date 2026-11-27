---
'@mastra/hono': patch
---

Fixed custom routes holding large request bodies in memory. Requests that don't reach a custom route are no longer copied at all, and when one does, the adapter releases its copy as soon as the route starts handling the request instead of keeping it until garbage collection. ([#31191](https://github.com/mastra-ai/mastra/issues/31191))
