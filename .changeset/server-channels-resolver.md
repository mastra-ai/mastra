---
'@mastra/server': patch
---

Channel API routes now resolve providers at request time when the Mastra instance is configured with a channel resolver, so platform connections added after boot are usable immediately. Static channel configurations behave as before.
