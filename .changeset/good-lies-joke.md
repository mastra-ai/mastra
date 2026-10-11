---
'@mastra/server': patch
'@mastra/core': patch
---

Netlify AI Gateway now reuses its provider list for 5 minutes and gives up after 5 seconds, so loading the model list no longer calls Netlify on every request or hangs when Netlify is slow or unreachable.
