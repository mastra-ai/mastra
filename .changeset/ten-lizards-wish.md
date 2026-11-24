---
'mastra': patch
---

Changed CLI analytics to only send a fixed list of known options. `mastra init` and `mastra start` no longer report other options, and URLs in reported errors no longer include credentials or query strings.
