---
'@mastra/playground-ui': patch
---

Observability lists (traces, logs, and their filters) now keep live polling through a 429 rate-limit response, instead of stopping until the page is reloaded. Other 4xx responses still stop polling.
