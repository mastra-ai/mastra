---
'@mastra/server': minor
---

Added the `progressiveTokenSearch` observability capability (`false` by default). Hosts whose observability API searches long ranges in chunks report `true` so Studio searches them chunk by chunk.
